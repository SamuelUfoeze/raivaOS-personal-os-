import type * as T from "../types";
import {
  initSync,
  loadTable as syncLoadTable,
  saveTable as syncSaveTable,
} from "./sync";

let __isTauri = false;
try {
  __isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
} catch {
  __isTauri = false;
}

export const isTauri = __isTauri;

// Lazy init sync (only on mock path)
let syncInited = false;
function ensureSync() {
  if (!syncInited && !isTauri) {
    initSync();
    syncInited = true;
  }
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: ti } = await import("@tauri-apps/api/core");
    return ti<T>(cmd, args);
  }
  ensureSync();
  return mockInvoke<T>(cmd, args);
}

// ── localStorage-based mock for browser dev ──────────────────────

function mockDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

function genId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadTable<T>(key: string): T[] {
  ensureSync();
  return syncLoadTable<T>(key);
}

function saveTable<T>(key: string, data: T[]) {
  ensureSync();
  syncSaveTable(key, data);
}

// ── Mock implementation ──────────────────────────────────────────

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await mockDelay();

  switch (cmd) {
    // ── Notes ──
    case "get_all_notes": {
      const notes = loadTable("notes");
      return notes.filter((n: any) => !n.is_deleted) as T;
    }
    case "get_note": {
      const notes = loadTable("notes");
      return notes.find((n: any) => n.id === args?.id) as T;
    }
    case "create_note": {
      const notes = loadTable<any>("notes");
      const req = args?.req as any;
      const n = {
        id: genId(),
        title: req?.title ?? "",
        content: req?.content ?? "",
        is_favorite: false,
        is_archived: false,
        is_deleted: false,
        background_color: req?.background_color ?? "#ffffff",
        tags: (req?.tags ?? []).map((t: string) => ({
          id: genId(),
          name: t.toLowerCase(),
          color: "#9C27B0",
          category: "manual",
        })),
        created_at: now(),
        updated_at: now(),
      };
      notes.push(n);
      saveTable("notes", notes);
      return n as T;
    }
    case "update_note": {
      const notes = loadTable<any>("notes");
      const idx = notes.findIndex((n: any) => n.id === args?.id);
      if (idx >= 0) {
        const req = args?.req as any;
        notes[idx].title = req?.title ?? notes[idx].title;
        notes[idx].content = req?.content ?? notes[idx].content;
        notes[idx].background_color = req?.background_color ?? notes[idx].background_color ?? "#ffffff";
        notes[idx].updated_at = now();
        notes[idx].tags = (req?.tags ?? []).map((t: string) => ({
          id: genId(),
          name: t.toLowerCase(),
          color: "#9C27B0",
          category: "manual",
        }));
        saveTable("notes", notes);
        return notes[idx] as T;
      }
      return null as T;
    }
    case "delete_note": {
      const notes = loadTable<any>("notes");
      const n = notes.find((n: any) => n.id === args?.id);
      if (n) n.is_deleted = true;
      saveTable("notes", notes);
      return undefined as T;
    }
    case "toggle_favorite": {
      const notes = loadTable<any>("notes");
      const n = notes.find((n: any) => n.id === args?.id);
      if (n) n.is_favorite = args?.favorite ?? false;
      saveTable("notes", notes);
      return undefined as T;
    }

    // ── Tags ──
    case "get_all_tags": {
      const notes = loadTable<any>("notes");
      const seen = new Set<string>();
      const tags: any[] = [];
      for (const n of notes) {
        for (const t of (n.tags ?? [])) {
          if (!seen.has(t.name)) {
            seen.add(t.name);
            tags.push(t);
          }
        }
      }
      return tags as T;
    }

    // ── Habits ──
    case "get_all_habits": {
      const habits = loadTable("habits");
      return habits as T;
    }
    case "create_habit": {
      const habits = loadTable<any>("habits");
      const req = args?.req as any;
      const h = {
        id: genId(),
        name: req?.name ?? "",
        subtext: req?.subtext ?? "",
        icon: req?.icon ?? "check_circle",
        color_hex: req?.color_hex ?? "#7C3AED",
        frequency: req?.frequency ?? "daily",
        frequency_value: req?.frequency_value ?? "",
        archived: false,
        created_at: now(),
      };
      habits.push(h);
      saveTable("habits", habits);
      return h as T;
    }
    case "update_habit": {
      const habits = loadTable<any>("habits");
      const idx = habits.findIndex((h: any) => h.id === args?.id);
      if (idx >= 0) {
        const req = args?.req as any;
        habits[idx] = { ...habits[idx], ...req };
        saveTable("habits", habits);
        return habits[idx] as T;
      }
      return null as T;
    }
    case "delete_habit": {
      const habits = loadTable<any>("habits");
      saveTable("habits", habits.filter((h: any) => h.id !== args?.id));
      return undefined as T;
    }
    case "log_habit_tick": {
      const logs = loadTable<any>("habit_logs");
      const existing = logs.findIndex(
        (l: any) => l.habit_id === args?.habit_id && l.date_string === args?.date_string
      );
      if (existing >= 0) {
        logs[existing].status = args?.done ?? false;
      } else {
        logs.push({
          id: genId(),
          habit_id: args?.habit_id,
          date_string: args?.date_string ?? today(),
          status: args?.done ?? false,
        });
      }
      saveTable("habit_logs", logs);
      return undefined as T;
    }
    case "get_habit_logs": {
      const logs = loadTable<any>("habit_logs");
      return logs.filter((l: any) => l.habit_id === args?.habit_id) as T;
    }
    case "get_habit_logs_all": {
      return loadTable<any>("habit_logs") as T;
    }
    case "get_habit_today_status": {
      const habits = loadTable<any>("habits");
      const logs = loadTable<any>("habit_logs");
      const td = today();
      return habits
        .filter((h: any) => !h.archived)
        .map((h: any) => ({
          habit: h,
          done_today: logs.some(
            (l: any) => l.habit_id === h.id && l.date_string === td && l.status
          ),
          streak: calcStreak(logs, h.id, td),
          weekly_logs: logs
            .filter((l: any) => l.habit_id === h.id)
            .sort((a: any, b: any) => b.date_string.localeCompare(a.date_string))
            .slice(0, 7),
        })) as T;
    }

    // ── Projects ──
    case "get_all_projects": {
      const projects = loadTable<any>("projects");
      const goals = loadTable<any>("goals");
      const tasks = loadTable<any>("tasks");
      return projects
        .filter((p: any) => p.status !== "archived")
        .map((p: any) => {
          const pGoals = goals.filter((g: any) => g.project_id === p.id);
          const goalsWithTasks = pGoals.map((g: any) => {
            const gTasks = tasks.filter((t: any) => t.goal_id === g.id);
            const done = gTasks.filter((t: any) => t.status === "done").length;
            return {
              goal: g,
              tasks: gTasks,
              progress: gTasks.length ? (done / gTasks.length) * 100 : 0,
            };
          });
          const totalProgress = goalsWithTasks.reduce((s: number, g: any) => s + g.progress, 0);
          return {
            project: p,
            goals: goalsWithTasks,
            progress: goalsWithTasks.length ? totalProgress / goalsWithTasks.length : 0,
          };
        }) as T;
    }
    case "create_project": {
      const projects = loadTable<any>("projects");
      const req = args?.req as any;
      const p = {
        id: genId(),
        title: req?.title ?? "",
        description: req?.description ?? "",
        color: req?.color ?? "#7C3AED",
        status: "active",
        created_at: now(),
      };
      projects.push(p);
      saveTable("projects", projects);
      return p as T;
    }
    case "update_project": {
      const projects = loadTable<any>("projects");
      const p = projects.find((pj: any) => pj.id === args?.id);
      if (p) {
        const req = args?.req as any;
        p.title = req?.title ?? p.title;
        p.description = req?.description ?? p.description;
        p.color = req?.color ?? p.color;
        p.status = req?.status ?? p.status;
        saveTable("projects", projects);
      }
      return undefined as T;
    }
    case "delete_project": {
      const projects = loadTable<any>("projects");
      saveTable("projects", projects.filter((p: any) => p.id !== args?.id));
      return undefined as T;
    }

    // ── Goals ──
    case "get_all_goals": {
      const goals = loadTable<any>("goals");
      const projects = loadTable<any>("projects");
      const tasks = loadTable<any>("tasks");
      return goals.map((g: any) => {
        const proj = projects.find((p: any) => p.id === g.project_id);
        const gTasks = tasks.filter((t: any) => t.goal_id === g.id);
        return {
          goal: g,
          project_title: proj?.title ?? "Unknown",
          project_color: proj?.color ?? "#7C3AED",
          total_tasks: gTasks.length,
          done_tasks: gTasks.filter((t: any) => t.status === "done").length,
        };
      }) as T;
    }
    case "create_goal": {
      const goals = loadTable<any>("goals");
      const req = args?.req as any;
      const g = {
        id: genId(),
        project_id: req?.project_id ?? "",
        title: req?.title ?? "",
        priority: req?.priority ?? "medium",
        status: "active",
        created_at: now(),
      };
      goals.push(g);
      saveTable("goals", goals);
      return g as T;
    }
    case "delete_goal": {
      const goals = loadTable<any>("goals");
      saveTable("goals", goals.filter((g: any) => g.id !== args?.id));
      return undefined as T;
    }
    case "update_goal": {
      const goals = loadTable<any>("goals");
      const g = goals.find((gl: any) => gl.id === args?.id);
      if (g) {
        g.title = args?.title ?? g.title;
        g.status = args?.status ?? g.status;
        g.priority = args?.priority ?? g.priority;
        saveTable("goals", goals);
      }
      return undefined as T;
    }

    // ── Tasks ──
    case "get_all_tasks": {
      return loadTable("tasks") as T;
    }
    case "create_task": {
      const tasks = loadTable<any>("tasks");
      const req = args?.req as any;
      const t = {
        id: genId(),
        goal_id: req?.goal_id ?? null,
        project_id: req?.project_id ?? null,
        title: req?.title ?? "",
        description: req?.description ?? "",
        duration_mins: req?.duration_mins ?? 25,
        actual_mins: req?.actual_mins ?? 0,
        priority_score: req?.priority_score ?? 5,
        quadrant: req?.quadrant ?? "inbox",
        status: req?.status ?? "not-started",
        tags: req?.tags ?? [],
        created_at: now(),
      };
      tasks.push(t);
      saveTable("tasks", tasks);
      return t as T;
    }
    case "update_task_status": {
      const tasks = loadTable<any>("tasks");
      const t = tasks.find((t: any) => t.id === args?.id);
      if (t) {
        t.status = args?.status ?? t.status;
        saveTable("tasks", tasks);
      }
      return undefined as T;
    }
    case "update_task": {
      const tasks = loadTable<any>("tasks");
      const t = tasks.find((t: any) => t.id === args?.id);
      if (t) {
        t.title = args?.title ?? t.title;
        t.description = args?.description ?? t.description;
        t.quadrant = args?.quadrant ?? t.quadrant;
        t.duration_mins = args?.duration_mins ?? t.duration_mins;
        t.actual_mins = args?.actual_mins ?? t.actual_mins;
        t.status = args?.status ?? t.status;
        t.tags = args?.tags ?? t.tags;
        t.priority_score = args?.priority_score ?? t.priority_score;
        saveTable("tasks", tasks);
      }
      return undefined as T;
    }
    case "delete_task": {
      const tasks = loadTable<any>("tasks");
      saveTable("tasks", tasks.filter((t: any) => t.id !== args?.id));
      return undefined as T;
    }
    case "get_tasks_by_quadrant": {
      const tasks = loadTable<any>("tasks");
      return tasks as T;
    }
    case "get_all_tasks_with_sources": {
      const tasks = loadTable<any>("tasks");
      const goals = loadTable<any>("goals");
      const projects = loadTable<any>("projects");
      return tasks.map((t: any) => {
        let sourceLabel = "";
        let sourceId = "";
        if (t.project_id) {
          const p = projects.find((pl: any) => pl.id === t.project_id);
          sourceLabel = p?.title ?? "";
          sourceId = t.project_id;
        } else if (t.goal_id) {
          const g = goals.find((gl: any) => gl.id === t.goal_id);
          const p = g ? projects.find((pl: any) => pl.id === g.project_id) : null;
          sourceLabel = p ? `${p.title} › ${g.title}` : g?.title ?? "";
          sourceId = t.goal_id;
        }
        return { ...t, source_label: sourceLabel, source_id: sourceId };
      }) as T;
    }

    // ── Chat ──
    case "get_chat_threads": {
      return loadTable("chat_threads") as T;
    }
    case "create_chat_thread": {
      const threads = loadTable<any>("chat_threads");
      const th = {
        id: genId(),
        title: (args?.title as string) ?? "New Chat",
        created_at: now(),
      };
      threads.push(th);
      saveTable("chat_threads", threads);
      return th as T;
    }
    case "get_chat_messages": {
      const msgs = loadTable<any>("chat_messages");
      return msgs.filter((m: any) => m.thread_id === args?.thread_id) as T;
    }
    case "save_chat_message": {
      const msgs = loadTable<any>("chat_messages");
      const msg = {
        id: genId(),
        thread_id: args?.thread_id as string,
        role: args?.role as string,
        content: args?.content as string,
        created_at: now(),
      };
      msgs.push(msg);
      saveTable("chat_messages", msgs);
      return msg as T;
    }
    case "delete_chat_thread": {
      const threads = loadTable<any>("chat_threads");
      saveTable("chat_threads", threads.filter((t: any) => t.id !== args?.thread_id));
      return undefined as T;
    }

    // ── Visions ──
    case "get_all_visions": {
      return loadTable("visions") as T;
    }
    case "upsert_vision": {
      const visions = loadTable<any>("visions");
      const req = args?.req as any;
      const existing = visions.findIndex(
        (v: any) => v.category === req?.category
      );
      if (existing >= 0) {
        visions[existing].title = req?.title ?? visions[existing].title;
        visions[existing].vision_text = req?.vision_text ?? visions[existing].vision_text;
        visions[existing].updated_at = now();
      } else {
        visions.push({
          id: genId(),
          title: req?.title ?? "",
          vision_text: req?.vision_text ?? "",
          category: req?.category ?? "",
          created_at: now(),
          updated_at: now(),
        });
      }
      saveTable("visions", visions);
      return visions[existing >= 0 ? existing : visions.length - 1] as T;
    }
    case "delete_vision": {
      const visions = loadTable<any>("visions");
      saveTable("visions", visions.filter((v: any) => v.id !== args?.id));
      return undefined as T;
    }

    // ── Audit ──
    case "get_latest_audit": {
      const audits = loadTable<any>("audits");
      return (audits.length ? audits[audits.length - 1] : null) as T;
    }
    case "run_audit": {
      const projects = loadTable<any>("projects");
      const visions = loadTable<any>("visions");
      const tasks = loadTable<any>("tasks");
      const audits = loadTable<any>("audits");
      const hasVisions = visions.length > 0;

      const details = projects.map((p: any) => {
        const score = hasVisions ? 50 + Math.random() * 50 : 20 + Math.random() * 30;
        return {
          project_title: p.title,
          alignment_score: Math.round(score * 10) / 10,
          classification: score >= 50 ? "Essential Component" : "Distraction",
        };
      });
      details.sort((a: any, b: any) => b.alignment_score - a.alignment_score);
      const avg = details.length
        ? details.reduce((s: number, d: any) => s + d.alignment_score, 0) / details.length
        : 0;

      const result = {
        id: genId(),
        audit_date: now(),
        period_label: now().slice(0, 7),
        summary:
          avg >= 70
            ? `Strong alignment (${Math.round(avg)}%). Your projects align well with your vision.`
            : avg >= 40
              ? `Moderate alignment (${Math.round(avg)}%). Some projects need realignment.`
              : `Low alignment (${Math.round(avg)}%). Review projects against your vision.`,
        alignment_score: Math.round(avg * 10) / 10,
        details,
        created_at: now(),
      };
      audits.push(result);
      saveTable("audits", audits);
      return result as T;
    }

    // ── Focus Sessions (Pomodoro) ──
    case "log_focus_session": {
      const sessions = loadTable<any>("focus_sessions");
      sessions.push({
        id: genId(),
        task_id: args?.task_id ?? null,
        duration_mins: args?.duration_mins ?? 0,
        completed_mins: args?.completed_mins ?? 0,
        status: args?.status ?? "completed",
        started_at: args?.started_at ?? now(),
        ended_at: args?.ended_at ?? now(),
      });
      saveTable("focus_sessions", sessions);

      if (args?.task_id && args?.completed_mins) {
        const tasks = loadTable<any>("tasks");
        const t = tasks.find((tk: any) => tk.id === args?.task_id);
        if (t) {
          t.actual_mins = (t.actual_mins ?? 0) + (args?.completed_mins as number);
          saveTable("tasks", tasks);
        }
      }
      return undefined as T;
    }
    case "get_focus_sessions": {
      const sessions = loadTable<any>("focus_sessions");
      return (args?.task_id
        ? sessions.filter((s: any) => s.task_id === args?.task_id)
        : sessions) as T;
    }

    // ── LLM ──
    case "get_available_models": {
      return [
        { id: "qwen2.5-1.5b", name: "Qwen 2.5 1.5B Instruct", tier: "standard", size: "1.5B", filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf", download_url: "" },
        { id: "qwen2.5-7b", name: "Qwen 2.5 7B Instruct", tier: "pro", size: "7B", filename: "qwen2.5-7b-instruct-q4_k_m.gguf", download_url: "" },
      ] as T;
    }
    case "get_model_status": {
      return { downloaded: false, downloading: false, progress: 0, path: null } as T;
    }
    case "download_model": {
      return undefined as T;
    }
    case "cancel_download": {
      return undefined as T;
    }
    case "get_llama_status": {
      return { running: false, port: null, model: null } as T;
    }
    case "start_llama_server": {
      return "llama-server started (mock)" as T;
    }
    case "stop_llama_server": {
      return undefined as T;
    }
    case "chat_completion": {
      return { text: "(mock) Local LLM not available in browser mode." } as T;
    }

    default: {
      console.warn(`Unhandled mock command: ${cmd}`, args);
      return null as T;
    }
  }
}

function calcStreak(logs: any[], habitId: string, td: string): number {
  let streak = 0;
  const d = new Date(td);
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().slice(0, 10);
    const done = logs.some(
      (l: any) => l.habit_id === habitId && l.date_string === ds && l.status
    );
    if (done) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ── Re-exported API ──────────────────────────────────────────────

export const api = {
  // Notes
  getNotes: () => invoke<any[]>("get_all_notes"),
  getNote: (id: string) => invoke<any>("get_note", { id }),
  createNote: (req: any) => invoke<any>("create_note", { req }),
  updateNote: (id: string, req: any) => invoke<any>("update_note", { id, req }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  toggleFavorite: (id: string, favorite: boolean) =>
    invoke<void>("toggle_favorite", { id, favorite }),

  // Habits
  getHabits: () => invoke<any[]>("get_all_habits"),
  createHabit: (req: any) => invoke<any>("create_habit", { req }),
  updateHabit: (id: string, req: any) => invoke<any>("update_habit", { id, req }),
  deleteHabit: (id: string) => invoke<void>("delete_habit", { id }),
  logHabitTick: (habitId: string, dateString: string, done: boolean) =>
    invoke<void>("log_habit_tick", { habit_id: habitId, date_string: dateString, done }),
  getHabitLogs: (habitId: string, days: number) =>
    invoke<any[]>("get_habit_logs", { habit_id: habitId, days }),
  getHabitTodayStatus: () => invoke<any[]>("get_habit_today_status"),
  getHabitLogsAll: () => invoke<any[]>("get_habit_logs_all"),

  // Projects
  getProjects: () => invoke<any[]>("get_all_projects"),
  createProject: (req: any) => invoke<any>("create_project", { req }),
  updateProject: (id: string, req: any) =>
    invoke<void>("update_project", { id, req }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),

  // Goals
  getGoals: () => invoke<any[]>("get_all_goals"),
  createGoal: (req: any) => invoke<any>("create_goal", { req }),
  updateGoal: (id: string, req: any) => invoke<void>("update_goal", { id, ...req }),
  deleteGoal: (id: string) => invoke<void>("delete_goal", { id }),

  // Tasks
  getTasks: () => invoke<any[]>("get_all_tasks"),
  getTasksWithSources: () => invoke<any[]>("get_all_tasks_with_sources"),
  createTask: (req: any) => invoke<any>("create_task", { req }),
  updateTaskStatus: (id: string, status: string) =>
    invoke<void>("update_task_status", { id, status }),
  updateTask: (id: string, req: any) =>
    invoke<void>("update_task", { id, ...req }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  getTasksByQuadrant: () => invoke<any[]>("get_tasks_by_quadrant"),

  // Focus Sessions
  logFocusSession: (req: any) => invoke<void>("log_focus_session", { ...req }),
  getFocusSessions: (taskId?: string) =>
    invoke<any[]>("get_focus_sessions", taskId ? { task_id: taskId } : {}),

  // Chat
  getChatThreads: () => invoke<any[]>("get_chat_threads"),
  createChatThread: (title: string) => invoke<any>("create_chat_thread", { title }),
  getChatMessages: (threadId: string) =>
    invoke<any[]>("get_chat_messages", { thread_id: threadId }),
  saveChatMessage: (threadId: string, role: string, content: string) =>
    invoke<any>("save_chat_message", { thread_id: threadId, role, content }),
  deleteChatThread: (threadId: string) =>
    invoke<void>("delete_chat_thread", { thread_id: threadId }),

  // Visions
  getVisions: () => invoke<any[]>("get_all_visions"),
  upsertVision: (req: any) => invoke<any>("upsert_vision", { req }),
  deleteVision: (id: string) => invoke<void>("delete_vision", { id }),

  // Tags
  getTags: () => invoke<any[]>("get_all_tags"),

  // Audit
  getLatestAudit: () => invoke<any>("get_latest_audit"),
  runAudit: () => invoke<any>("run_audit"),

  // LLM
  getAvailableModels: () => invoke<any>("get_available_models"),
  getModelStatus: (modelId: string) => invoke<any>("get_model_status", { modelId }),
  downloadModel: (modelId: string) => invoke<void>("download_model", { modelId }),
  cancelDownload: (modelId: string) => invoke<void>("cancel_download", { modelId }),
  getLlamaStatus: () => invoke<any>("get_llama_status"),
  startLlamaServer: (modelPath: string, port?: number, ngl?: number) =>
    invoke<string>("start_llama_server", { modelPath, port: port ?? 8080, ngl: ngl ?? 32 }),
  stopLlamaServer: () => invoke<void>("stop_llama_server"),
  chatCompletion: (request: any) => invoke<any>("chat_completion", { request }),
};
