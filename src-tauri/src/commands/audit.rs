use crate::db::Database;
use crate::models::*;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_latest_audit(db: State<Database>) -> Result<Option<AuditResult>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1")
        .map_err(|e| e.to_string())?;
    let audit = stmt.query_map([], |row| {
        let details_str: String = row.get::<_, String>("details").unwrap_or("[]".into());
        let details: Vec<ProjectAlignmentDetail> = serde_json::from_str(&details_str).unwrap_or_default();
        Ok(AuditResult {
            id: row.get("id")?,
            audit_date: row.get("audit_date")?,
            period_label: row.get("period_label")?,
            summary: row.get::<_, String>("summary").unwrap_or_default(),
            alignment_score: row.get::<_, f64>("alignment_score").unwrap_or(0.0),
            details,
            created_at: row.get("created_at")?,
        })
    }).map_err(|e| e.to_string())?;
    let result = audit.filter_map(|r| r.ok()).next();
    Ok(result)
}

#[tauri::command]
pub fn run_audit(db: State<Database>) -> Result<AuditResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();
    let period = now.format("%Y-%m").to_string();

    let mut pstmt = conn.prepare("SELECT * FROM projects WHERE status = 'active'").map_err(|e| e.to_string())?;
    let projects: Vec<Project> = pstmt.query_map([], |row| {
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

    let mut vstmt = conn.prepare("SELECT * FROM life_visions").map_err(|e| e.to_string())?;
    let visions: Vec<LifeVision> = vstmt.query_map([], |row| {
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

    let has_visions = !visions.is_empty();
    let mut details = vec![];
    let total_score: f64;

    if !has_visions || projects.is_empty() {
        total_score = if has_visions { 50.0 } else { 0.0 };
        for p in &projects {
            details.push(ProjectAlignmentDetail {
                project_title: p.title.clone(),
                alignment_score: 50.0,
                classification: "Not Scored".into(),
            });
        }
    } else {
        let mut sum = 0.0;
        for p in &projects {
            let mut goals_text = String::new();
            let mut gstmt = conn.prepare("SELECT title FROM goals WHERE project_id = ?1")
                .map_err(|e| e.to_string())?;
            let goals: Vec<String> = gstmt.query_map(params![p.id], |r| r.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            for g in &goals {
                goals_text.push_str(g);
                goals_text.push(' ');
            }

            let project_text = format!("{} {} {}", p.title, p.description, goals_text);
            let vision_texts: Vec<&str> = visions.iter().map(|v| v.vision_text.as_str()).collect();
            let combined_vision = vision_texts.join(" ");

            let similarity = simple_text_similarity(&project_text, &combined_vision);
            let score = (similarity * 100.0).min(100.0);
            sum += score;

            details.push(ProjectAlignmentDetail {
                project_title: p.title.clone(),
                alignment_score: score,
                classification: if score >= 50.0 { "Essential Component".into() } else { "Distraction".into() },
            });
        }
        total_score = if details.is_empty() { 0.0 } else { sum / details.len() as f64 };
    }

    details.sort_by(|a, b| b.alignment_score.partial_cmp(&a.alignment_score).unwrap_or(std::cmp::Ordering::Equal));

    let summary = if total_score >= 70.0 {
        format!("Strong alignment ({:.0}%). Your projects are well-aligned with your life vision.", total_score)
    } else if total_score >= 40.0 {
        format!("Moderate alignment ({:.0}%). Some projects need realignment with your vision.", total_score)
    } else {
        format!("Low alignment ({:.0}%). Consider reviewing your projects against your life vision.", total_score)
    };

    let details_json = serde_json::to_string(&details).unwrap_or("[]".into());
    let id = Uuid::new_v4().to_string();
    let audit_date = now.to_rfc3339();

    conn.execute("DELETE FROM audit_logs WHERE period_label = ?1", params![period]).ok();
    conn.execute(
        "INSERT INTO audit_logs (id, audit_date, period_label, summary, alignment_score, details, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, audit_date, period, summary, total_score, details_json, audit_date],
    ).map_err(|e| e.to_string())?;

    Ok(AuditResult {
        id,
        audit_date: audit_date.clone(),
        period_label: period,
        summary,
        alignment_score: total_score,
        details,
        created_at: audit_date,
    })
}

fn simple_text_similarity(a: &str, b: &str) -> f64 {
    let a_lower = a.to_lowercase();
    let b_lower = b.to_lowercase();
    let a_words: Vec<&str> = a_lower.split_whitespace().collect();
    let b_words: Vec<&str> = b_lower.split_whitespace().collect();
    if a_words.is_empty() || b_words.is_empty() {
        return 0.0;
    }
    let set_a: std::collections::HashSet<&str> = a_words.into_iter().collect();
    let set_b: std::collections::HashSet<&str> = b_words.into_iter().collect();
    let intersection = set_a.intersection(&set_b).count() as f64;
    let union = set_a.union(&set_b).count() as f64;
    if union == 0.0 { 0.0 } else { intersection / union }
}
