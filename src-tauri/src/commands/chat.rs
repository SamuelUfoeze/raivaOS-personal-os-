use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_chat_threads(db: State<Database>) -> Result<Vec<ChatThread>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM chat_threads ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let threads = stmt.query_map([], |row| {
        Ok(ChatThread {
            id: row.get("id")?,
            title: row.get::<_, String>("title").unwrap_or("New Chat".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(threads)
}

#[tauri::command]
pub fn create_chat_thread(db: State<Database>, title: String) -> Result<ChatThread, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO chat_threads (id, title, created_at) VALUES (?1, ?2, ?3)",
        params![id, title, now],
    ).map_err(|e| e.to_string())?;
    Ok(ChatThread { id, title, created_at: now })
}

#[tauri::command]
pub fn get_chat_messages(db: State<Database>, thread_id: String) -> Result<Vec<ChatMessage>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM chat_messages WHERE thread_id = ?1 ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let messages = stmt.query_map(params![thread_id], |row| {
        Ok(ChatMessage {
            id: row.get("id")?,
            thread_id: row.get("thread_id")?,
            role: row.get("role")?,
            content: row.get("content")?,
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(messages)
}

#[tauri::command]
pub fn save_chat_message(db: State<Database>, thread_id: String, role: String, content: String) -> Result<ChatMessage, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO chat_messages (id, thread_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, thread_id, role, content, now],
    ).map_err(|e| e.to_string())?;
    Ok(ChatMessage { id, thread_id, role, content, created_at: now })
}

#[tauri::command]
pub fn delete_chat_thread(db: State<Database>, thread_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chat_threads WHERE id = ?1", params![thread_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
