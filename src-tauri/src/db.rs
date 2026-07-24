use rusqlite::{Connection, Result};
use std::sync::Mutex;
use std::path::PathBuf;

const SCHEMA_VERSION: i32 = 1;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("raiva.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA cache_size=-65536;")?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn schema_version(&self) -> i32 {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE((SELECT version FROM _schema_version ORDER BY id DESC LIMIT 1), 0)",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
    }

    fn set_schema_version(&self, version: i32) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO _schema_version (version) VALUES (?1)",
            rusqlite::params![version],
        )
        .ok();
    }

    fn migrate(&self) -> Result<()> {
        let current = self.schema_version();
        let conn = self.conn.lock().unwrap();

        if current == 0 {
            conn.execute_batch("
                CREATE TABLE IF NOT EXISTS _schema_version (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version INTEGER NOT NULL,
                    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL DEFAULT '',
                    content_type TEXT DEFAULT 'text',
                    is_favorite INTEGER DEFAULT 0,
                    is_archived INTEGER DEFAULT 0,
                    is_deleted INTEGER DEFAULT 0,
                    background_color TEXT DEFAULT '#ffffff',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tags (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    color TEXT DEFAULT '#9C27B0',
                    category TEXT DEFAULT 'manual',
                    usage_count INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS note_tags (
                    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (note_id, tag_id)
                );
                CREATE TABLE IF NOT EXISTS habits_meta (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    subtext TEXT DEFAULT '',
                    icon TEXT DEFAULT 'check_circle',
                    color_hex TEXT DEFAULT '#7C3AED',
                    frequency TEXT DEFAULT 'daily',
                    frequency_value TEXT DEFAULT '',
                    archived INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS habit_logs (
                    id TEXT PRIMARY KEY,
                    habit_id TEXT NOT NULL REFERENCES habits_meta(id) ON DELETE CASCADE,
                    date_string TEXT NOT NULL,
                    status INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(habit_id, date_string)
                );
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    color TEXT DEFAULT '#7C3AED',
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS goals (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    priority TEXT DEFAULT 'medium',
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
                    title TEXT NOT NULL,
                    duration_mins INTEGER DEFAULT 25,
                    priority_score INTEGER DEFAULT 5,
                    quadrant TEXT DEFAULT 'inbox',
                    status TEXT DEFAULT 'pending',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS focus_sessions (
                    id TEXT PRIMARY KEY,
                    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
                    duration_mins INTEGER NOT NULL DEFAULT 25,
                    completed_mins INTEGER NOT NULL DEFAULT 0,
                    status TEXT DEFAULT 'completed',
                    started_at TEXT NOT NULL,
                    ended_at TEXT
                );
                CREATE TABLE IF NOT EXISTS life_visions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    vision_text TEXT NOT NULL,
                    category TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    audit_date TEXT NOT NULL,
                    period_label TEXT NOT NULL,
                    summary TEXT DEFAULT '',
                    alignment_score REAL DEFAULT 0.0,
                    details TEXT DEFAULT '[]',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS knowledge_links (
                    id TEXT PRIMARY KEY,
                    source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                    target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                    relationship_type TEXT DEFAULT 'related',
                    strength_score REAL DEFAULT 0.0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chat_threads (
                    id TEXT PRIMARY KEY,
                    title TEXT DEFAULT 'New Chat',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            ")?;
            // Future migrations: add elif branches for each new version
            // e.g. `} else if current <= 1 { ... }`
            // Always update SCHEMA_VERSION to the latest
        }

        self.set_schema_version(SCHEMA_VERSION);
        Ok(())
    }
}
