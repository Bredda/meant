use rusqlite::Connection;

/// Ordered schema migrations. The database's `PRAGMA user_version` is the
/// number of migrations already applied; append new files, never edit or
/// reorder an existing one (it has already run on users' machines).
const MIGRATIONS: &[&str] = &[
    include_str!("migrations/0001_init.sql"),
    include_str!("migrations/0002_runs.sql"),
];

/// Applies every pending migration, each in its own transaction together with
/// the `user_version` bump, so a failure leaves the database at the last
/// fully applied version.
pub fn migrate(connection: &mut Connection) -> rusqlite::Result<()> {
    let applied: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    for (version, sql) in (1_i64..).zip(MIGRATIONS).skip(applied.max(0) as usize) {
        let transaction = connection.transaction()?;
        transaction.execute_batch(sql)?;
        transaction.pragma_update(None, "user_version", version)?;
        transaction.commit()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_version(connection: &Connection) -> i64 {
        connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap()
    }

    fn table_exists(connection: &Connection, name: &str) -> bool {
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [name],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            == 1
    }

    #[test]
    fn empty_database_reaches_the_latest_version() {
        let mut connection = Connection::open_in_memory().unwrap();

        migrate(&mut connection).unwrap();

        assert_eq!(user_version(&connection), MIGRATIONS.len() as i64);
        assert!(table_exists(&connection, "threads"));
        assert!(table_exists(&connection, "messages"));
    }

    #[test]
    fn database_from_before_migrations_keeps_its_rows() {
        let mut connection = Connection::open_in_memory().unwrap();
        // What the pre-migration code created, at user_version 0.
        connection
            .execute_batch(include_str!("migrations/0001_init.sql"))
            .unwrap();
        connection
            .execute(
                "INSERT INTO threads (id, title, created_at, updated_at) VALUES ('t1', 'Old', 0, 0)",
                [],
            )
            .unwrap();

        migrate(&mut connection).unwrap();

        assert_eq!(user_version(&connection), MIGRATIONS.len() as i64);
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM threads", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn migrating_twice_is_a_no_op() {
        let mut connection = Connection::open_in_memory().unwrap();

        migrate(&mut connection).unwrap();
        migrate(&mut connection).unwrap();

        assert_eq!(user_version(&connection), MIGRATIONS.len() as i64);
    }
}
