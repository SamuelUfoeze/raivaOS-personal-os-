use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_all_tasks(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM tasks ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get("id")?,
            goal_id: row.get("goal_id")?,
            title: row.get("title")?,
            duration_mins: row.get::<_, i32>("duration_mins").unwrap_or(25),
            priority_score: row.get::<_, i32>("priority_score").unwrap_or(5),
            quadrant: row.get::<_, String>("quadrant").unwrap_or("inbox".into()),
            status: row.get::<_, String>("status").unwrap_or("pending".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(db: State<Database>, req: CreateTaskRequest) -> Result<Task, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO tasks (id, goal_id, title, duration_mins, quadrant, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, req.goal_id, req.title, req.duration_mins, req.quadrant, now],
    ).map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM tasks WHERE id = ?1", params![id], |row| {
        Ok(Task {
            id: row.get("id")?,
            goal_id: row.get("goal_id")?,
            title: row.get("title")?,
            duration_mins: row.get::<_, i32>("duration_mins").unwrap_or(25),
            priority_score: row.get::<_, i32>("priority_score").unwrap_or(5),
            quadrant: row.get::<_, String>("quadrant").unwrap_or("inbox".into()),
            status: row.get::<_, String>("status").unwrap_or("pending".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task_status(db: State<Database>, id: String, status: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE tasks SET status = ?1 WHERE id = ?2", params![status, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_task(
    db: State<Database>,
    id: String,
    title: Option<String>,
    quadrant: Option<String>,
    duration_mins: Option<i32>,
    status: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET title=COALESCE(?1, title), quadrant=COALESCE(?2, quadrant), duration_mins=COALESCE(?3, duration_mins), status=COALESCE(?4, status) WHERE id=?5",
        params![title, quadrant, duration_mins, status, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_all_tasks_with_sources(db: State<Database>) -> Result<Vec<TaskWithSource>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT t.*, g.title as goal_title, g.project_id as goal_project_id, p.title as project_title
         FROM tasks t
         LEFT JOIN goals g ON t.goal_id = g.id
         LEFT JOIN projects p ON g.project_id = p.id
         ORDER BY t.created_at DESC"
    ).map_err(|e| e.to_string())?;
    let tasks = stmt.query_map([], |row| {
        let goal_title: Option<String> = row.get("goal_title").ok();
        let _goal_project_id: Option<String> = row.get("goal_project_id").ok();
        let project_title: Option<String> = row.get("project_title").ok();
        let goal_id: Option<String> = row.get("goal_id").ok();

        let (source_label, source_id) = if let Some(ref gid) = goal_id {
            if let (Some(ref gt), Some(ref pt)) = (&goal_title, &project_title) {
                (format!("{} › {}", pt, gt), Some(gid.clone()))
            } else {
                (goal_title.clone().unwrap_or_default(), Some(gid.clone()))
            }
        } else {
            (String::new(), None)
        };

        Ok(TaskWithSource {
            id: row.get("id")?,
            goal_id,
            title: row.get("title")?,
            duration_mins: row.get::<_, i32>("duration_mins").unwrap_or(25),
            priority_score: row.get::<_, i32>("priority_score").unwrap_or(5),
            quadrant: row.get::<_, String>("quadrant").unwrap_or("inbox".into()),
            status: row.get::<_, String>("status").unwrap_or("pending".into()),
            created_at: row.get("created_at")?,
            source_label,
            source_id,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn get_tasks_by_quadrant(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority_score DESC")
        .map_err(|e| e.to_string())?;
    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get("id")?,
            goal_id: row.get("goal_id")?,
            title: row.get("title")?,
            duration_mins: row.get::<_, i32>("duration_mins").unwrap_or(25),
            priority_score: row.get::<_, i32>("priority_score").unwrap_or(5),
            quadrant: row.get::<_, String>("quadrant").unwrap_or("inbox".into()),
            status: row.get::<_, String>("status").unwrap_or("pending".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(tasks)
}
