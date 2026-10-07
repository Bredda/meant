// PostToolUse hook (Write|Edit): formats the file Claude just touched.
// - TS/JS/JSON/CSS: Biome (same rules as `pnpm fix`; Biome's own `files.includes`
//   keeps shadcn's components/ui out).
// - Rust: rustfmt, only once the repo has a rustfmt baseline (src-tauri/rustfmt.toml),
//   so editing one line never reformats a whole legacy file.
// Never blocks: formatting problems are reported, not fatal.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let filePath;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  filePath = input.tool_response?.filePath ?? input.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath || !existsSync(filePath)) {
  process.exit(0);
}

const rel = relative(root, filePath).replaceAll("\\", "/");
if (rel.startsWith("..") || rel.startsWith("node_modules/")) {
  process.exit(0);
}

const ext = extname(filePath).toLowerCase();
const shell = process.platform === "win32";

try {
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".jsonc", ".css"].includes(ext)) {
    execFileSync(
      "pnpm",
      ["exec", "biome", "check", "--write", "--no-errors-on-unmatched", "--files-ignore-unknown=true", filePath],
      { cwd: root, stdio: "pipe", shell }
    );
  } else if (ext === ".rs" && existsSync(join(root, "src-tauri", "rustfmt.toml"))) {
    execFileSync("rustfmt", ["--edition", "2021", filePath], { cwd: join(root, "src-tauri"), stdio: "pipe", shell });
  }
} catch (error) {
  // Lint errors Biome cannot fix land here: surface them to Claude without blocking.
  const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-20).join("\n");
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `Formatter reported issues on ${rel}:\n${output}`,
      },
    })
  );
}
process.exit(0);
