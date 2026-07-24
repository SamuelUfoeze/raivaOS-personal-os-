use crate::db::Database;
use crate::models::Tag;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn get_tags_for_note(db: State<Database>, note_id: String) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT t.* FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?1"
    ).map_err(|e| e.to_string())?;
    let tags = stmt.query_map(params![note_id], |row| {
        Ok(Tag {
            id: row.get("id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            category: row.get::<_, String>("category").unwrap_or("manual".into()),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(tags)
}

#[tauri::command]
pub fn get_all_tags(db: State<Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags = stmt.query_map([], |row| {
        Ok(Tag {
            id: row.get("id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            category: row.get::<_, String>("category").unwrap_or("manual".into()),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(tags)
}
