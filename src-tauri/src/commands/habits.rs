use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use chrono::NaiveDate;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

fn row_to_habit(row: &rusqlite::Row) -> rusqlite::Result<Habit> {
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
}

#[tauri::command]
pub fn get_all_habits(db: State<Database>) -> Result<Vec<Habit>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM habits_meta ORDER BY archived ASC, name ASC")
        .map_err(|e| e.to_string())?;
    let habits = stmt.query_map([], row_to_habit)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(habits)
}

#[tauri::command]
pub fn create_habit(db: State<Database>, req: CreateHabitRequest) -> Result<Habit, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO habits_meta (id, name, subtext, icon, color_hex, frequency, frequency_value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, req.name, req.subtext, req.icon, req.color_hex, req.frequency, req.frequency_value.unwrap_or_default(), now],
    ).map_err(|e| e.to_string())?;
    drop(conn);
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM habits_meta WHERE id = ?1", params![id], row_to_habit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_habit(db: State<Database>, id: String, req: CreateHabitRequest) -> Result<Habit, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE habits_meta SET name=?1, subtext=?2, icon=?3, color_hex=?4, frequency=?5, frequency_value=?6 WHERE id=?7",
        params![req.name, req.subtext, req.icon, req.color_hex, req.frequency, req.frequency_value.unwrap_or_default(), id],
    ).map_err(|e| e.to_string())?;
    drop(conn);
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM habits_meta WHERE id = ?1", params![id], row_to_habit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_habit(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM habits_meta WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn log_habit_tick(db: State<Database>, habit_id: String, date_string: String, done: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR REPLACE INTO habit_logs (id, habit_id, date_string, status) VALUES (?1, ?2, ?3, ?4)",
        params![id, habit_id, date_string, done as i32],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_habit_logs(db: State<Database>, habit_id: String, days: i32) -> Result<Vec<HabitLog>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT * FROM habit_logs WHERE habit_id = ?1 ORDER BY date_string DESC LIMIT ?2"
    ).map_err(|e| e.to_string())?;
    let logs = stmt.query_map(params![habit_id, days], |row| {
        Ok(HabitLog {
            id: row.get("id")?,
            habit_id: row.get("habit_id")?,
            date_string: row.get("date_string")?,
            status: row.get::<_, i32>("status")? != 0,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(logs)
}

#[tauri::command]
pub fn get_habit_today_status(db: State<Database>) -> Result<Vec<HabitWithStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare("SELECT * FROM habits_meta WHERE archived = 0")
        .map_err(|e| e.to_string())?;
    let habits: Vec<Habit> = stmt.query_map([], row_to_habit)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut result = vec![];
    for habit in habits {
        let done_today: bool = conn.query_row(
            "SELECT status FROM habit_logs WHERE habit_id = ?1 AND date_string = ?2",
            params![habit.id, today],
            |row| row.get::<_, i32>(0),
        ).ok().map(|v| v != 0).unwrap_or(false);

        let streak = calculate_streak(&conn, &habit.id, &Utc::now().format("%Y-%m-%d").to_string());

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

        result.push(HabitWithStatus {
            habit,
            done_today,
            streak,
            weekly_logs,
        });
    }
    Ok(result)
}

fn calculate_streak(conn: &rusqlite::Connection, habit_id: &str, today: &str) -> i64 {
    let mut streak: i64 = 0;
    let mut current = NaiveDate::parse_from_str(today, "%Y-%m-%d").ok();
    loop {
        let ds = match current {
            Some(d) => d.format("%Y-%m-%d").to_string(),
            None => break,
        };
        let done: bool = conn.query_row(
            "SELECT status FROM habit_logs WHERE habit_id = ?1 AND date_string = ?2",
            params![habit_id, ds],
            |row| row.get::<_, i32>(0),
        ).ok().map(|v| v != 0).unwrap_or(false);
        if done {
            streak += 1;
            current = current.and_then(|d| d.pred_opt());
        } else {
            break;
        }
    }
    streak
}
