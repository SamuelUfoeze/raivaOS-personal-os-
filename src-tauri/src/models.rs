use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub tags: Vec<Tag>,
    pub background_color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub subtext: String,
    pub icon: String,
    pub color_hex: String,
    pub frequency: String,
    pub frequency_value: String,
    pub archived: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub date_string: String,
    pub status: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub description: String,
    pub color: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub priority: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub goal_id: Option<String>,
    pub title: String,
    pub duration_mins: i32,
    pub priority_score: i32,
    pub quadrant: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifeVision {
    pub id: String,
    pub title: String,
    pub vision_text: String,
    pub category: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub audit_date: String,
    pub period_label: String,
    pub summary: String,
    pub alignment_score: f64,
    pub details: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeLink {
    pub id: String,
    pub source_note_id: String,
    pub target_note_id: String,
    pub relationship_type: String,
    pub strength_score: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: String,
    pub task_id: Option<String>,
    pub duration_mins: i32,
    pub completed_mins: i32,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatThread {
    pub id: String,
    pub title: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub tasks_pending: i64,
    pub active_projects: i64,
    pub notes_this_week: i64,
    pub focus_score: f64,
    pub top_urgent_tasks: Vec<Task>,
    pub recent_notes: Vec<Note>,
    pub habit_today: Vec<HabitWithStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitWithStatus {
    pub habit: Habit,
    pub done_today: bool,
    pub streak: i64,
    pub weekly_logs: Vec<HabitLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalWithProgress {
    pub goal: Goal,
    pub project_title: String,
    pub project_color: String,
    pub total_tasks: i64,
    pub done_tasks: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWithGoals {
    pub project: Project,
    pub goals: Vec<GoalWithTasks>,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalWithTasks {
    pub goal: Goal,
    pub tasks: Vec<Task>,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAllData {
    pub notes: Vec<Note>,
    pub habits: Vec<Habit>,
    pub habit_today_status: Vec<HabitWithStatus>,
    pub projects: Vec<ProjectWithGoals>,
    pub tasks: Vec<Task>,
    pub goals: Vec<GoalWithProgress>,
    pub visions: Vec<LifeVision>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNoteRequest {
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHabitRequest {
    pub name: String,
    pub subtext: String,
    pub icon: String,
    pub color_hex: String,
    pub frequency: String,
    #[serde(default)]
    pub frequency_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub title: String,
    pub description: String,
    pub color: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGoalRequest {
    pub project_id: String,
    pub title: String,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskWithSource {
    pub id: String,
    pub goal_id: Option<String>,
    pub title: String,
    pub duration_mins: i32,
    pub priority_score: i32,
    pub quadrant: String,
    pub status: String,
    pub created_at: String,
    pub source_label: String,
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub goal_id: Option<String>,
    pub title: String,
    pub duration_mins: i32,
    pub quadrant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVisionRequest {
    pub title: String,
    pub vision_text: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditResult {
    pub id: String,
    pub audit_date: String,
    pub period_label: String,
    pub summary: String,
    pub alignment_score: f64,
    pub details: Vec<ProjectAlignmentDetail>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAlignmentDetail {
    pub project_title: String,
    pub alignment_score: f64,
    pub classification: String,
}
