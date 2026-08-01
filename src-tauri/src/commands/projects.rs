use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_all_projects(db: State<Database>) -> Result<Vec<ProjectWithGoals>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE status != 'archived' ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let projects: Vec<Project> = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get::<_, String>("description").unwrap_or_default(),
            color: row.get::<_, String>("color").unwrap_or("#7C3AED".into()),
            status: row.get::<_, String>("status").unwrap_or("active".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let mut result = vec![];
    for p in projects {
        let mut gstmt = conn.prepare("SELECT * FROM goals WHERE project_id = ?1 ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let goals: Vec<Goal> = gstmt.query_map(params![p.id], |row| {
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

        let mut goals_with_tasks = vec![];
        let mut total_progress: f64 = 0.0;
        for g in goals {
            let mut tstmt = conn.prepare("SELECT * FROM tasks WHERE goal_id = ?1 ORDER BY created_at")
                .map_err(|e| e.to_string())?;
            let tasks: Vec<Task> = tstmt.query_map(params![g.id], |row| {
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

            let total = tasks.len() as f64;
            let done = tasks.iter().filter(|t| t.status == "done").count() as f64;
            let progress = if total > 0.0 { done / total * 100.0 } else { 0.0 };
            total_progress += progress;

            goals_with_tasks.push(GoalWithTasks { goal: g, tasks, progress });
        }

        let gp = if !goals_with_tasks.is_empty() { total_progress / goals_with_tasks.len() as f64 } else { 0.0 };
        result.push(ProjectWithGoals { project: p, goals: goals_with_tasks, progress: gp });
    }
    Ok(result)
}

#[tauri::command]
pub fn create_project(db: State<Database>, req: CreateProjectRequest) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO projects (id, title, description, color, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, req.title, req.description, req.color, now],
    ).map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM projects WHERE id = ?1", params![id], |row| {
        Ok(Project {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get::<_, String>("description").unwrap_or_default(),
            color: row.get::<_, String>("color").unwrap_or("#7C3AED".into()),
            status: row.get::<_, String>("status").unwrap_or("active".into()),
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(db: State<Database>, id: String, req: UpdateProjectRequest) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET title=COALESCE(?1, title), description=COALESCE(?2, description), color=COALESCE(?3, color) WHERE id=?4",
        params![req.title, req.description, req.color, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
