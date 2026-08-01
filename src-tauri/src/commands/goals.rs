use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_all_goals(db: State<Database>) -> Result<Vec<GoalWithProgress>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT g.*, p.title as ptitle, p.color as pcolor FROM goals g JOIN projects p ON g.project_id = p.id ORDER BY g.created_at DESC"
    ).map_err(|e| e.to_string())?;
    let goals = stmt.query_map([], |row| {
        let gid: String = row.get("id")?;
        Ok((gid, row.get::<_, String>("ptitle")?, row.get::<_, String>("pcolor")?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    let mut gstmt = conn.prepare("SELECT * FROM goals ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let all_goals: Vec<Goal> = gstmt.query_map([], |row| {
        Ok(Goal {
            id: row.get("id")?,
            project_id: row.get("project_id")?,
            title: row.get("title")?,
            priority: row.get::<_, String>("priority").unwrap_or("medium".into()),
            status: row.get::<_, String>("status").unwrap_or("active".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let mut result = vec![];
    for g in all_goals {
        let (ptitle, pcolor) = goals.iter().find(|(id, _, _)| *id == g.id)
            .map(|(_, t, c)| (t.clone(), c.clone()))
            .unwrap_or(("Unknown".into(), "#7C3AED".into()));

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE goal_id = ?1", params![g.id], |r| r.get(0)
        ).unwrap_or(0);
        let done: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE goal_id = ?1 AND status = 'done'", params![g.id], |r| r.get(0)
        ).unwrap_or(0);

        result.push(GoalWithProgress {
            goal: g,
            project_title: ptitle,
            project_color: pcolor,
            total_tasks: total,
            done_tasks: done,
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn create_goal(db: State<Database>, req: CreateGoalRequest) -> Result<Goal, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO goals (id, project_id, title, priority, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, req.project_id, req.title, req.priority, now],
    ).map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM goals WHERE id = ?1", params![id], |row| {
        Ok(Goal {
            id: row.get("id")?,
            project_id: row.get("project_id")?,
            title: row.get("title")?,
            priority: row.get::<_, String>("priority").unwrap_or("medium".into()),
            status: row.get::<_, String>("status").unwrap_or("active".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_goal(db: State<Database>, id: String, title: Option<String>, status: Option<String>, priority: Option<String>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    if let Some(title) = title {
        conn.execute("UPDATE goals SET title = ?1 WHERE id = ?2", params![title, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(status) = status {
        conn.execute("UPDATE goals SET status = ?1 WHERE id = ?2", params![status, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(priority) = priority {
        conn.execute("UPDATE goals SET priority = ?1 WHERE id = ?2", params![priority, id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_goal(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
