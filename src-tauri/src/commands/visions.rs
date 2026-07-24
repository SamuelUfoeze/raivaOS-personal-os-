use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_all_visions(db: State<Database>) -> Result<Vec<LifeVision>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM life_visions ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let visions = stmt.query_map([], |row| {
        Ok(LifeVision {
            id: row.get("id")?,
            title: row.get("title")?,
            vision_text: row.get("vision_text")?,
            category: row.get("category")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(visions)
}

#[tauri::command]
pub fn upsert_vision(db: State<Database>, req: CreateVisionRequest) -> Result<LifeVision, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let existing: Option<String> = conn.query_row(
        "SELECT id FROM life_visions WHERE category = ?1", params![req.category], |r| r.get(0)
    ).ok();

    let id = if let Some(eid) = existing {
        conn.execute(
            "UPDATE life_visions SET title=?1, vision_text=?2, updated_at=?3 WHERE id=?4",
            params![req.title, req.vision_text, now, eid],
        ).map_err(|e| e.to_string())?;
        eid
    } else {
        let nid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO life_visions (id, title, vision_text, category, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![nid, req.title, req.vision_text, req.category, now, now],
        ).map_err(|e| e.to_string())?;
        nid
    };

    drop(conn);
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM life_visions WHERE id = ?1", params![id], |row| {
        Ok(LifeVision {
            id: row.get("id")?,
            title: row.get("title")?,
            vision_text: row.get("vision_text")?,
            category: row.get("category")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_vision(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM life_visions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
