export interface Note {
  id: string;
  title: string;
  content: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  tags: Tag[];
  background_color?: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  category: string;
}

export interface Habit {
  id: string;
  name: string;
  subtext: string;
  icon: string;
  color_hex: string;
  frequency: string;
  frequency_value: string;
  archived: boolean;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date_string: string;
  status: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  color: string;
  status: string;
  created_at: string;
}

export interface Goal {
  id: string;
  project_id: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
}

export interface Task {
  id: string;
  goal_id: string | null;
  project_id: string | null;
  title: string;
  description: string;
  duration_mins: number;
  actual_mins: number;
  priority_score: number;
  quadrant: string;
  status: string;
  tags: string[];
  created_at: string;
}

export interface LifeVision {
  id: string;
  title: string;
  vision_text: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface AuditResult {
  id: string;
  audit_date: string;
  period_label: string;
  summary: string;
  alignment_score: number;
  details: ProjectAlignmentDetail[];
  created_at: string;
}

export interface ProjectAlignmentDetail {
  project_title: string;
  alignment_score: number;
  classification: string;
}

export interface KnowledgeLink {
  id: string;
  source_note_id: string;
  target_note_id: string;
  relationship_type: string;
  strength_score: number;
  created_at: string;
}

export interface FocusSession {
  id: string;
  task_id: string | null;
  duration_mins: number;
  completed_mins: number;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface DashboardStats {
  tasks_pending: number;
  active_projects: number;
  notes_this_week: number;
  focus_score: number;
  top_urgent_tasks: Task[];
  recent_notes: Note[];
  habit_today: HabitWithStatus[];
}

export interface HabitWithStatus {
  habit: Habit;
  done_today: boolean;
  streak: number;
  weekly_logs: HabitLog[];
}

export interface GoalWithProgress {
  goal: Goal;
  project_title: string;
  project_color: string;
  total_tasks: number;
  done_tasks: number;
}

export interface ProjectWithGoals {
  project: Project;
  goals: GoalWithTasks[];
  progress: number;
}

export interface GoalWithTasks {
  goal: Goal;
  tasks: Task[];
  progress: number;
}
