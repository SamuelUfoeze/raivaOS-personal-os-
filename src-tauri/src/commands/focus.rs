use crate::db::Database;
use crate::models::*;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn log_focus_session(
    db: State<Database>,
    task_id: Option<String>,
    duration_mins: i32,
    completed_mins: i32,
    status: String,
    started_at: String,
    ended_at: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO focus_sessions (id, task_id, duration_mins, completed_mins, status, started_at, ended_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, task_id, duration_mins, completed_mins, status, started_at, ended_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_focus_sessions(db: State<Database>, task_id: Option<String>) -> Result<Vec<FocusSession>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    if let Some(tid) = task_id {
        let mut stmt = conn.prepare("SELECT * FROM focus_sessions WHERE task_id = ?1 ORDER BY started_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![tid], map_focus_row).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    } else {
        let mut stmt = conn.prepare("SELECT * FROM focus_sessions ORDER BY started_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], map_focus_row).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }
}

fn map_focus_row(row: &rusqlite::Row) -> rusqlite::Result<FocusSession> {
    Ok(FocusSession {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        duration_mins: row.get::<_, i32>("duration_mins").unwrap_or(0),
        completed_mins: row.get::<_, i32>("completed_mins").unwrap_or(0),
        status: row.get::<_, String>("status").unwrap_or("completed".into()),
        started_at: row.get("started_at")?,
        ended_at: row.get("ended_at")?,
    })
}
