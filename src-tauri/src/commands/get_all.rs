use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use chrono::NaiveDate;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn get_all(db: State<Database>) -> Result<GetAllData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // ── Notes ──
    let mut stmt = conn.prepare(
        "SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get("id")?,
            title: row.get("title")?,
            content: row.get("content")?,
            is_favorite: row.get::<_, i32>("is_favorite")? != 0,
            is_archived: row.get::<_, i32>("is_archived")? != 0,
            is_deleted: false,
            tags: vec![],
            background_color: row.get("background_color").ok(),
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    // ── Tags ──
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
    .collect::<Vec<_>>();

    // ── Habits ──
    let mut stmt = conn.prepare("SELECT * FROM habits_meta ORDER BY archived ASC, name ASC")
        .map_err(|e| e.to_string())?;
    let habits = stmt.query_map([], |row| {
        Ok(Habit {
            id: row.get("id")?,
            name: row.get("name")?,
            subtext: row.get::<_, String>("subtext").unwrap_or_default(),
            icon: row.get::<_, String>("icon").unwrap_or("check_circle".into()),
            color_hex: row.get::<_, String>("color_hex").unwrap_or("#7C3AED".into()),
            frequency: row.get::<_, String>("frequency").unwrap_or("daily".into()),
            frequency_value: row.get::<_, String>("frequency_value").unwrap_or_default(),
            archived: row.get::<_, i32>("archived")? != 0,
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    // ── Habit today status ──
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut habit_today_status = vec![];
    for habit in &habits {
        if habit.archived { continue; }
        let done_today: bool = conn.query_row(
            "SELECT status FROM habit_logs WHERE habit_id = ?1 AND date_string = ?2",
            params![habit.id, today],
            |row| row.get::<_, i32>(0),
        ).ok().map(|v| v != 0).unwrap_or(false);

        let streak = {
            let mut s = 0i64;
            let mut current = NaiveDate::parse_from_str(&today, "%Y-%m-%d").ok();
            loop {
                let ds = match current {
                    Some(d) => d.format("%Y-%m-%d").to_string(),
                    None => break,
                };
                let done: bool = conn.query_row(
                    "SELECT status FROM habit_logs WHERE habit_id = ?1 AND date_string = ?2",
                    params![habit.id, ds],
                    |row| row.get::<_, i32>(0),
                ).ok().map(|v| v != 0).unwrap_or(false);
                if done {
                    s += 1;
                    current = current.and_then(|d| d.pred_opt());
                } else {
                    break;
                }
            }
            s
        };

        let mut stmt2 = conn.prepare(
            "SELECT * FROM habit_logs WHERE habit_id = ?1 ORDER BY date_string DESC LIMIT 7"
        ).map_err(|e| e.to_string())?;
        let weekly_logs = stmt2.query_map(params![habit.id], |row| {
            Ok(HabitLog {
                id: row.get("id")?,
                habit_id: row.get("habit_id")?,
                date_string: row.get("date_string")?,
                status: row.get::<_, i32>("status")? != 0,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

        habit_today_status.push(HabitWithStatus { habit: habit.clone(), done_today, streak, weekly_logs });
    }

    // ── Projects with goals and tasks ──
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE status != 'archived' ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let raw_projects: Vec<Project> = stmt.query_map([], |row| {
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
    .collect::<Vec<_>>();

    let mut projects = vec![];
    for p in &raw_projects {
        let mut gstmt = conn.prepare("SELECT * FROM goals WHERE project_id = ?1 ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let raw_goals: Vec<Goal> = gstmt.query_map(params![p.id], |row| {
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
        let mut total_progress = 0.0f64;
        for g in &raw_goals {
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

            goals_with_tasks.push(GoalWithTasks { goal: g.clone(), tasks, progress });
        }
        let pp = if !goals_with_tasks.is_empty() { total_progress / goals_with_tasks.len() as f64 } else { 0.0 };
        projects.push(ProjectWithGoals { project: p.clone(), goals: goals_with_tasks, progress: pp });
    }

    // ── Tasks (all) ──
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
    .collect::<Vec<_>>();

    // ── Goals with progress ──
    let mut stmt_goals = conn.prepare(
        "SELECT g.*, p.title as ptitle, p.color as pcolor FROM goals g JOIN projects p ON g.project_id = p.id ORDER BY g.created_at DESC"
    ).map_err(|e| e.to_string())?;
    let goal_info: Vec<(String, String, String)> = stmt_goals.query_map([], |row| {
        Ok((row.get::<_, String>("id")?, row.get::<_, String>("ptitle")?, row.get::<_, String>("pcolor")?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

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

    let mut goals = vec![];
    for g in all_goals {
        let (ptitle, pcolor) = goal_info.iter().find(|(id, _, _)| *id == g.id)
            .map(|(_, t, c)| (t.clone(), c.clone()))
            .unwrap_or(("Unknown".into(), "#7C3AED".into()));
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE goal_id = ?1", params![g.id], |r| r.get(0)
        ).unwrap_or(0);
        let done: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE goal_id = ?1 AND status = 'done'", params![g.id], |r| r.get(0)
        ).unwrap_or(0);
        goals.push(GoalWithProgress { goal: g, project_title: ptitle, project_color: pcolor, total_tasks: total, done_tasks: done });
    }

    // ── Visions ──
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

    Ok(GetAllData {
        notes,
        habits,
        habit_today_status,
        projects,
        tasks,
        goals,
        visions,
        tags,
    })
}
