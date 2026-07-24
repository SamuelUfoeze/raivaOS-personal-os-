use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        title: row.get("title")?,
        content: row.get("content")?,
        is_favorite: row.get::<_, i32>("is_favorite")? != 0,
        is_archived: row.get::<_, i32>("is_archived")? != 0,
        is_deleted: row.get::<_, i32>("is_deleted")? != 0,
        tags: vec![],
        background_color: row.get("background_color").ok(),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub fn get_all_notes(db: State<Database>) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], row_to_note)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
    Ok(notes)
}

#[tauri::command]
pub fn get_note(db: State<Database>, id: String) -> Result<Option<Note>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM notes WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], row_to_note)
        .map_err(|e| e.to_string())?;
    Ok(rows.next().and_then(|r| r.ok()))
}

#[tauri::command]
pub fn create_note(db: State<Database>, req: CreateNoteRequest) -> Result<Note, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let bg = req.background_color.as_deref().unwrap_or("#ffffff");
    conn.execute(
        "INSERT INTO notes (id, title, content, background_color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, req.title, req.content, bg, now, now],
    ).map_err(|e| e.to_string())?;
    for tag_name in &req.tags {
        let tag_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, '#9C27B0', ?3)",
            params![tag_id, tag_name.to_lowercase(), now],
        ).ok();
        let tid: String = conn.query_row(
            "SELECT id FROM tags WHERE name = ?1", params![tag_name.to_lowercase()], |r| r.get(0)
        ).unwrap_or_default();
        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![id, tid],
        ).ok();
    }
    drop(conn);
    get_note(db, id).map(|n| n.unwrap())
}

#[tauri::command]
pub fn update_note(db: State<Database>, id: String, req: UpdateNoteRequest) -> Result<Note, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let bg = req.background_color.as_deref().unwrap_or("#ffffff");
    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, background_color = ?3, updated_at = ?4 WHERE id = ?5",
        params![req.title, req.content, bg, now, id],
    ).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM note_tags WHERE note_id = ?1", params![id]).ok();
    for tag_name in &req.tags {
        let tag_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, '#9C27B0', ?3)",
            params![tag_id, tag_name.to_lowercase(), now],
        ).ok();
        let tid: String = conn.query_row(
            "SELECT id FROM tags WHERE name = ?1", params![tag_name.to_lowercase()], |r| r.get(0)
        ).unwrap_or_default();
        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![id, tid],
        ).ok();
    }
    drop(conn);
    get_note(db, id).map(|n| n.unwrap())
}

#[tauri::command]
pub fn delete_note(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE notes SET is_deleted = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_favorite(db: State<Database>, id: String, favorite: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET is_favorite = ?1 WHERE id = ?2",
        params![favorite as i32, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
