use rig::completion::Prompt;
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    ai::{agent::runtime::AgentError, provider},
    db::models::StoredThreadMessage,
    error::AppError,
    vault::{secrets::ProviderId, SecretStore},
    AppState,
};

const PREAMBLE: &str = "You name conversations. Reply with the title only: at most six words, \
no quotes, no final punctuation, in the language of the conversation.";

/// How much of each side of the exchange the title call gets: enough to know
/// the topic, not the whole answer.
const EXCERPT_CHARS: usize = 600;

/// Longest title kept, in characters (the sidebar truncates anyway).
const MAX_TITLE_CHARS: usize = 60;

/// The first question and answer of a thread.
#[derive(Debug, PartialEq, Eq)]
pub struct FirstExchange {
    pub question: String,
    pub answer: String,
}

/// The exchange a title is made from, if the thread is still on its first one:
/// exactly one user message, followed by an assistant message with text (an
/// answer that opens with a tool call has none yet, so no title is made).
pub fn first_exchange(messages: &[StoredThreadMessage]) -> Option<FirstExchange> {
    let mut users = messages.iter().filter(|m| m.role == "user");
    let question = users.next()?;
    if users.next().is_some() {
        return None;
    }

    let answer = messages
        .iter()
        .filter(|m| m.role == "assistant" && m.position > question.position)
        .map(|m| m.content.trim())
        .find(|text| !text.is_empty())?;

    Some(FirstExchange {
        question: question.content.clone(),
        answer: answer.to_string(),
    })
}

fn excerpt(text: &str) -> String {
    let mut chars = text.trim().chars();
    let head: String = chars.by_ref().take(EXCERPT_CHARS).collect();
    if chars.next().is_some() {
        format!("{head}…")
    } else {
        head
    }
}

/// The message the title agent answers.
pub fn title_prompt(exchange: &FirstExchange) -> String {
    format!(
        "Name this conversation.\n\nUser:\n{}\n\nAssistant:\n{}",
        excerpt(&exchange.question),
        excerpt(&exchange.answer)
    )
}

/// Turns what the model wrote into a usable title: one line, no wrapping
/// quotes or final dot, bounded. `None` when nothing is left.
pub fn clean_title(raw: &str) -> Option<String> {
    let line = raw.lines().map(str::trim).find(|line| !line.is_empty())?;
    // Quotes may come before or after the final dot ("Title". / "Title.").
    let is_wrapper =
        |c: char| c.is_whitespace() || matches!(c, '"' | '\'' | '“' | '”' | '«' | '»' | '`');
    let line = line
        .trim_start_matches(is_wrapper)
        .trim_end_matches(|c: char| is_wrapper(c) || matches!(c, '.' | '。'));

    if line.is_empty() {
        return None;
    }

    let mut chars = line.chars();
    let title: String = chars.by_ref().take(MAX_TITLE_CHARS).collect();
    Some(if chars.next().is_some() {
        format!("{}…", title.trim_end())
    } else {
        title
    })
}

/// Asks the provider for a title. Costs one extra model call, with the same
/// model as the thread's runs.
pub async fn generate<S: SecretStore>(
    provider_id: ProviderId,
    vault: &S,
    exchange: &FirstExchange,
) -> Result<String, AgentError> {
    let agent = provider::build_title_agent(provider_id, vault, PREAMBLE)?;

    let raw = agent
        .prompt(title_prompt(exchange))
        .await
        .map_err(|e| AgentError::Provider(e.to_string()))?;

    clean_title(&raw).ok_or_else(|| AgentError::Runtime("The model returned no title".into()))
}

/// Event the UI listens to, carrying the updated `Thread`.
pub const TITLE_UPDATED_EVENT: &str = "thread-title-updated";

/// Names a thread in the background once its first answer exists. Never
/// delays or fails the run: a failure is only logged and the provisional title
/// stays.
pub fn spawn_generation(app: AppHandle, thread_id: String, provider: ProviderId) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();

        if let Err(error) = generate_and_store(&app, &state, &thread_id, provider).await {
            eprintln!("could not generate a title for thread {thread_id}: {error}");
        }
    });
}

async fn generate_and_store(
    app: &AppHandle,
    state: &AppState,
    thread_id: &str,
    provider: ProviderId,
) -> Result<(), AppError> {
    if !state.threads.has_provisional_title(thread_id)? {
        return Ok(());
    }
    let Some(exchange) = first_exchange(&state.threads.get_messages(thread_id)?) else {
        return Ok(());
    };

    let title = generate(provider, &state.vault, &exchange).await?;

    // `None`: the user renamed the thread while the model was answering.
    if let Some(thread) = state.threads.set_auto_title(thread_id, &title)? {
        app.emit(TITLE_UPDATED_EVENT, thread)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, role: &str, position: i64, content: &str) -> StoredThreadMessage {
        StoredThreadMessage {
            id: id.into(),
            position,
            created_at: 0,
            thread_id: "t1".into(),
            run_id: None,
            role: role.into(),
            content: content.into(),
            tool_call_id: None,
            tool_name: None,
            is_error: false,
        }
    }

    #[test]
    fn the_first_question_and_its_first_text_answer_make_the_exchange() {
        let rows = [
            row("u1", "user", 0, "How do I sort a Vec?"),
            row("c1", "tool_call", 1, "{}"),
            row("r1", "tool_result", 2, "ok"),
            row("a1", "assistant", 3, "  Use sort().  "),
        ];

        assert_eq!(
            first_exchange(&rows),
            Some(FirstExchange {
                question: "How do I sort a Vec?".into(),
                answer: "Use sort().".into()
            })
        );
    }

    #[test]
    fn no_title_once_the_conversation_went_on_or_before_there_is_an_answer() {
        let two_questions = [
            row("u1", "user", 0, "a"),
            row("a1", "assistant", 1, "b"),
            row("u2", "user", 2, "c"),
        ];
        let unanswered = [row("u1", "user", 0, "a")];
        let only_a_tool_call = [row("u1", "user", 0, "a"), row("c1", "tool_call", 1, "{}")];

        assert_eq!(first_exchange(&two_questions), None);
        assert_eq!(first_exchange(&unanswered), None);
        assert_eq!(first_exchange(&only_a_tool_call), None);
    }

    #[test]
    fn the_prompt_carries_a_bounded_excerpt_of_each_side() {
        let exchange = FirstExchange {
            question: "q".repeat(EXCERPT_CHARS + 50),
            answer: "short".into(),
        };

        let prompt = title_prompt(&exchange);

        assert!(prompt.contains(&format!("{}…", "q".repeat(EXCERPT_CHARS))));
        assert!(!prompt.contains(&"q".repeat(EXCERPT_CHARS + 1)));
        assert!(prompt.contains("Assistant:\nshort"));
    }

    #[test]
    fn a_model_title_is_cleaned_up() {
        assert_eq!(
            clean_title("\"Sorting a Vec\"."),
            Some("Sorting a Vec".into())
        );
        assert_eq!(
            clean_title("\n  Rust lifetimes\nExtra line"),
            Some("Rust lifetimes".into())
        );
        assert_eq!(
            clean_title("« Tri d'un vecteur »"),
            Some("Tri d'un vecteur".into())
        );
        assert_eq!(clean_title(" \"\" "), None);
        assert_eq!(clean_title(""), None);
    }

    #[test]
    fn a_long_title_is_cut_on_a_character_boundary() {
        let title = clean_title(&"é".repeat(100)).unwrap();

        assert_eq!(title.chars().count(), MAX_TITLE_CHARS + 1);
        assert!(title.ends_with('…'));
    }
}
