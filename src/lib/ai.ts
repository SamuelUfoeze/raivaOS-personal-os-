import { api } from "./db";
import { getLibraryContext } from "./library";
import { getTreeContext } from "./knowledgeTree";
import { searchWeb, checkWebSearchAllowed, formatSearchResults } from "./webSearch";

// ── Embeddings (unchanged from original — Transformers.js + fallback) ──

let transformersLoaded = false;
let transformersPipeline: any = null;
let transformersLoading = false;

async function ensureTransformers() {
  if (transformersLoaded || transformersLoading) return;
  transformersLoading = true;
  try {
    const { pipeline } = await import("@xenova/transformers");
    transformersPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
    transformersLoaded = true;
  } catch { /* fallback only */ }
  transformersLoading = false;
}

if (typeof window !== "undefined") ensureTransformers();

function fallbackEmbed(text: string): number[] {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const vec = new Array(128).fill(0);
  for (const [word, count] of freq) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    vec[Math.abs(hash) % 128] += count / words.length;
  }
  return vec;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (transformersLoaded && transformersPipeline) {
    try {
      const output = await transformersPipeline(text, { pooling: "mean", normalize: true });
      return Array.from(output.data);
    } catch { return fallbackEmbed(text); }
  }
  return fallbackEmbed(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// ── Types ──

export interface AIAction {
  type: "create" | "update" | "delete" | "read";
  entity: string;
  data?: any;
  id?: string;
  result?: string;
}

export interface AIResponse {
  message: string;
  thinking?: string;
  actions?: AIAction[];
  suggestions?: string[];
}

// ── Intent Classifier ──

type Intent = "data_query" | "simple_gen" | "complex" | "tool_exec" | "library_query" | "about_me" | "life_audit" | "pomodoro" | "habits" | "relation" | "brainstorm" | "web_search" | "unknown";

interface ClassifiedIntent {
  intent: Intent;
  confidence: number;
  entities: string[];
}

function classifyIntent(query: string): ClassifiedIntent {
  const l = query.toLowerCase();

  // Data queries (answered instantly from DB, no generation needed)
  if ((/how many|count|total|list|show (me )?(all )?(my )?/).test(l)) return { intent: "data_query", confidence: 0.95, entities: extractEntities(l) };
  if ((/\?$/).test(l) && (/what|who|where|when|which/).test(l)) return { intent: "data_query", confidence: 0.8, entities: extractEntities(l) };

  // Tool execution
  if ((/^(add|create|make|new|schedule|set up|delete|remove|update|change|rename|mark|log)\b/).test(l)) return { intent: "tool_exec", confidence: 0.95, entities: extractEntities(l) };
  if ((/call(ed|ing)? (it|this|the|my) /).test(l)) return { intent: "tool_exec", confidence: 0.8, entities: extractEntities(l) };
  if ((/remind|deadline|due|schedule|pomodoro|focus/).test(l)) return { intent: "pomodoro", confidence: 0.85, entities: extractEntities(l) };

  // Library query
  if ((/what does .* say|according to|in the book| as (says|wrote)|h[ae]rmozi|ogilvy|hopkins|collins|drucker|sun tzu|musashi/).test(l)) return { intent: "library_query", confidence: 0.9, entities: extractEntities(l) };

  // Life audit
  if ((/audit|alignment|distraction|priority|project.*vision|vision.*project/).test(l)) return { intent: "life_audit", confidence: 0.9, entities: extractEntities(l) };

  // About me / vision / goals
  if ((/vision|purpose|mission|about me|life goal|life purpose|10.year|5.year|90.day/).test(l)) return { intent: "about_me", confidence: 0.85, entities: extractEntities(l) };

  // Habits
  if ((/habit|track|streak|daily|routine/).test(l)) return { intent: "habits", confidence: 0.85, entities: extractEntities(l) };

  // Relationship / connection queries
  if ((/connect|relationship|between|compare|relat|how does|linked|related|similar|different/).test(l)) return { intent: "relation", confidence: 0.8, entities: extractEntities(l) };

  // Brainstorm / creative
  if ((/brainstorm|idea|creative|what if|imagine|suggest|recommend|generate/).test(l)) return { intent: "brainstorm", confidence: 0.8, entities: extractEntities(l) };

  // Web search (current events, weather, facts, online info)
  if ((/weather|news|latest|current|today|forecast|stock|price|score|match|election|trending|who (is|are|won)|what (happened|is happening)|search (the )?web|look up|find online|google/).test(l)) return { intent: "web_search", confidence: 0.9, entities: extractEntities(l) };

  // Complex strategic
  if ((/plan|strategy|roadmap|should I|help me think|decide|evaluate|analyze|improve|optimize|reflect/).test(l)) return { intent: "complex", confidence: 0.85, entities: extractEntities(l) };

  // Simple generation
  if ((/summarize|explain|describe|tell me about|what is|draft|write (a|an|the)/).test(l)) return { intent: "simple_gen", confidence: 0.8, entities: extractEntities(l) };

  return { intent: "unknown", confidence: 0.5, entities: extractEntities(l) };
}

function extractEntities(s: string): string[] {
  const entities: string[] = [];
  // Capture quoted phrases
  const quotes = s.match(/["""](.+?)["""]/g);
  if (quotes) quotes.forEach((q) => entities.push(q.replace(/["""]/g, "").trim()));
  // Title-like phrases
  const titleMatch = s.match(/(project|task|note|habit|goal)s?\s+(?:called|named|titled)\s+["""]?(.+?)["""]?(?:\s|$)/i);
  if (titleMatch) entities.push(titleMatch[2].trim());
  return entities;
}

// ── Context Gatherer (enhanced, multi-source) ──

interface RichContext {
  raw: string;
  notes: any[];
  projects: any[];
  habits: any[];
  tasks: any[];
  goals: any[];
  visions: any[];
  stats: {
    totalNotes: number; totalTasks: number; totalProjects: number;
    doneToday: number; pendingTasks: number; inboxCount: number;
  };
}

async function gatherRichContext(): Promise<RichContext> {
  const [notes, projects, habits, tasks, goals, visions] = await Promise.all([
    api.getNotes(), api.getProjects(), api.getHabits(),
    api.getTasks(), api.getGoals(), api.getVisions(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const doneToday = tasks.filter((t: any) => t.status === "done" && (t as any).updated_at?.startsWith(today)).length;
  const pendingTasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
  const inboxCount = tasks.filter((t: any) => !t.quadrant || t.quadrant === "").length;

  let raw = "";

  raw += `--- PROJECTS (${projects.length}) ---\n`;
  for (const p of projects) {
    const pGoals = goals.filter((g: any) => g.project_id === p.id);
    const done = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id && t.status === "done").length, 0);
    const total = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id).length, 0);
    raw += `• "${p.title}" [${p.color}] ${total > 0 ? `${done}/${total} tasks` : "no milestones yet"}\n`;
    for (const g of pGoals) {
      const gDone = tasks.filter((t: any) => t.goal_id === g.id && t.status === "done").length;
      const gTotal = tasks.filter((t: any) => t.goal_id === g.id).length;
      raw += `  → "${g.title}" (${gDone}/${gTotal} tasks)\n`;
    }
  }

  raw += `\n--- TASKS (${tasks.length}) ---\n`;
  const inboxTasks = tasks.filter((t: any) => !t.quadrant || t.quadrant === "");
  const matrixTasks = tasks.filter((t: any) => t.quadrant && t.quadrant !== "");
  if (inboxTasks.length > 0) {
    raw += `Inbox (${inboxTasks.length} unassigned):\n`;
    for (const t of inboxTasks.slice(0, 8)) raw += `  • "${t.title}" [${t.status}]\n`;
  }
  const qLabels: Record<string, string> = { "urgent-important": "Do First", "not-urgent-important": "Schedule", "urgent-not-important": "Delegate", "not-urgent-not-important": "Eliminate" };
  for (const [q, label] of Object.entries(qLabels)) {
    const qTasks = matrixTasks.filter((t: any) => t.quadrant === q);
    if (qTasks.length > 0) {
      raw += `${label} (${qTasks.length}):\n`;
      for (const t of qTasks.slice(0, 5)) raw += `  • "${t.title}" [${t.status}]${t.duration_mins ? ` ${t.actual_mins}/${t.duration_mins}m` : ""}\n`;
    }
  }

  raw += `\n--- NOTES (${notes.length}) ---\n`;
  for (const n of notes.slice(0, 15)) {
    const tagStr = (n.tags ?? []).map((t: any) => t.name).join(", ");
    raw += `• "${n.title}"${tagStr ? ` [tags: ${tagStr}]` : ""}\n`;
  }

  raw += `\n--- VISIONS (${visions.length}) ---\n`;
  for (const v of visions) {
    raw += `• [${v.category}] "${v.title || "Untitled"}": ${(v.vision_text || "").slice(0, 150)}\n`;
  }

  raw += `\n--- HABITS (${habits.length}) ---\n`;
  for (const h of habits) {
    raw += `• ${h.icon || "○"} ${h.name}${h.subtext ? ` - ${h.subtext}` : ""}\n`;
  }

  return {
    raw,
    notes: notes.slice(0, 20),
    projects, habits, tasks, goals, visions,
    stats: { totalNotes: notes.length, totalTasks: tasks.length, totalProjects: projects.length, doneToday, pendingTasks, inboxCount },
  };
}

// ── Tool Executor ──

async function executeAIAction(action: AIAction): Promise<AIAction> {
  try {
    switch (action.type) {
      case "create": {
        switch (action.entity) {
          case "project": {
            const p = await api.createProject({ title: action.data?.title || "New Project", description: action.data?.description || "", color: action.data?.color || "#7C3AED" });
            return { ...action, result: `Created project "${p.title}"` };
          }
          case "goal":
          case "milestone": {
            const g = await api.createGoal({ project_id: action.data?.project_id || "", title: action.data?.title || "New Milestone", priority: "medium" });
            return { ...action, result: `Created milestone "${g.title}"` };
          }
          case "task": {
            const t = await api.createTask({ title: action.data?.title || "New Task", quadrant: action.data?.quadrant || "", duration_mins: action.data?.duration_mins || 25, status: "not-started", tags: action.data?.tags || [] });
            return { ...action, result: `Created task "${t.title}"` };
          }
          case "note": {
            const n = await api.createNote({ title: action.data?.title || "Untitled", content: action.data?.content || "", tags: action.data?.tags || [] });
            return { ...action, result: `Created note "${n.title}"` };
          }
          case "habit": {
            const h = await api.createHabit({ name: action.data?.title || action.data?.name || "New Habit", icon: action.data?.icon || "🔥", color_hex: action.data?.color || "#7C3AED", frequency: "daily", frequency_value: "1" });
            return { ...action, result: `Created habit "${h.name}"` };
          }
          default: return { ...action, result: `Created ${action.entity}` };
        }
      }
      case "update": {
        if (action.entity === "task" && action.id) await api.updateTask(action.id, action.data || {});
        if (action.entity === "project" && action.id) await api.updateProject(action.id, action.data || {});
        if (action.entity === "goal" && action.id) await api.updateGoal(action.id, action.data || {});
        if (action.entity === "note" && action.id) await api.updateNote(action.id, action.data || {});
        if (action.entity === "habit" && action.id) await api.updateHabit(action.id, action.data || {});
        return { ...action, result: `Updated ${action.entity}` };
      }
      case "delete": {
        if (action.entity === "task" && action.id) await api.deleteTask(action.id);
        if (action.entity === "project" && action.id) await api.deleteProject(action.id);
        if (action.entity === "goal" && action.id) await api.deleteGoal(action.id);
        if (action.entity === "note" && action.id) await api.deleteNote(action.id);
        if (action.entity === "habit" && action.id) await api.deleteHabit(action.id);
        return { ...action, result: `Deleted ${action.entity}` };
      }
      default: return action;
    }
  } catch (err: any) {
    return { ...action, result: `Error: ${err.message}` };
  }
}

function parseActionsFromQuery(lower: string, query: string): AIAction[] {
  const actions: AIAction[] = [];
  const lines = query.split("\n");

  for (const line of lines) {
    // Structured bracket commands
    const m = line.match(/^\[(\w+)_(\w+):?\s*(.*)\]$/);
    if (m) {
      const action = m[1].toLowerCase();
      const entity = m[2].toLowerCase();
      let data: any = {};
      if (m[3]) { try { data = JSON.parse(`{${m[3]}}`); } catch { data = { raw: m[3] }; } }
      if (action === "create") actions.push({ type: "create", entity, data });
      else if (action === "update") actions.push({ type: "update", entity, data, id: data?.id });
      else if (action === "delete") actions.push({ type: "delete", entity, id: data?.id });
      else if (action === "read") actions.push({ type: "read", entity, data });
      continue;
    }

    // Natural language patterns
    const createP = line.match(/create\s+(?:a\s+)?(project|task|goal|habit|note|milestone)\s+(?:called|named|titled)?\s*["""]?(.+?)["""]?\s*(?:in|for|under)?\s*["""]?(.+?)?["""]?$/i);
    if (createP) {
      const entity = createP[1].toLowerCase();
      const title = createP[2].trim();
      const parent = createP[3]?.trim();
      const data: any = { title };
      if (entity === "task" && parent) data.goal_id = parent;
      else if (entity === "milestone") { data.project_id = parent || ""; }
      else if (entity === "project") data.description = parent || "";
      actions.push({ type: "create", entity: entity === "milestone" ? "goal" : entity, data });
      continue;
    }
  }

  // Single-line commands
  const addTask = query.match(/(?:add|create)\s+(?:a\s+|the\s+|a new\s+)?task\s+(?:called\s+|named\s+|titled\s+)?["""]?(.+?)["""]?(?:\s+in\s+["""]?(.+?)["""]?)?$/i);
  if (addTask) {
    const data: any = { title: addTask[1].trim() };
    if (addTask[2]) data.quadrant = addTask[2].trim();
    actions.push({ type: "create", entity: "task", data });
  }

  const addProj = query.match(/(?:add|create)\s+(?:a\s+|a new\s+)?project\s+(?:called\s+|named\s+)?["""]?(.+?)["""]?(?:\s*\(([^)]+)\))?$/i);
  if (addProj) {
    actions.push({ type: "create", entity: "project", data: { title: addProj[1].trim(), color: addProj[2] || "#7C3AED" } });
  }

  const deleteMatch = query.match(/delete\s+(?:the\s+)?(task|project|note|habit|goal)\s+(?:called\s+|named\s+)?["""]?(.+?)["""]?$/i);
  if (deleteMatch) {
    actions.push({ type: "delete", entity: deleteMatch[1].toLowerCase(), data: { identifier: deleteMatch[2].trim() } });
  }

  const updateMatch = query.match(/(?:mark|set|update|change)\s+(?:the\s+)?(task|project)\s+(?:called\s+|named\s+)?["""]?(.+?)["""]?\s+(?:as\s+)?(done|in.progress|blocked|cancelled|not.started)/i);
  if (updateMatch) {
    actions.push({ type: "update", entity: updateMatch[1].toLowerCase(), data: { identifier: updateMatch[2].trim(), status: updateMatch[3].replace(/\s+/g, "-") } });
  }

  return actions;
}

async function resolveActionIds(actions: AIAction[]): Promise<AIAction[]> {
  const [tasks, projects, notes, habits] = await Promise.all([
    api.getTasks(), api.getProjects(), api.getNotes(), api.getHabits(),
  ]);
  return actions.map((a) => {
    const identifier = a.data?.identifier;
    if (!identifier) return a;
    if (a.entity === "task" || a.entity === "tasks") {
      const match = tasks.find((t: any) => t.title.toLowerCase().includes(identifier.toLowerCase()));
      if (match) return { ...a, id: match.id };
    }
    if (a.entity === "project" || a.entity === "projects") {
      const match = projects.find((p: any) => p.title.toLowerCase().includes(identifier.toLowerCase()));
      if (match) return { ...a, id: match.id };
    }
    if (a.entity === "note" || a.entity === "notes") {
      const match = notes.find((n: any) => n.title.toLowerCase().includes(identifier.toLowerCase()));
      if (match) return { ...a, id: match.id };
    }
    if (a.entity === "habit" || a.entity === "habits") {
      const match = habits.find((h: any) => h.name.toLowerCase().includes(identifier.toLowerCase()));
      if (match) return { ...a, id: match.id };
    }
    return a;
  });
}

// ── Response Generators ──

function summarizeContext(ctx: RichContext): string {
  const { stats } = ctx;
  let s = "";
  if (stats.totalProjects > 0) s += `${stats.totalProjects} projects, `;
  if (stats.totalTasks > 0) s += `${stats.totalTasks} tasks (${stats.pendingTasks} pending, ${stats.inboxCount} in inbox), `;
  if (stats.totalNotes > 0) s += `${stats.totalNotes} notes, `;
  s += `${ctx.habits.length} habits`;
  return s;
}

function generateDataResponse(query: string, ctx: RichContext): string {
  const l = query.toLowerCase();
  const { stats, tasks, projects, notes, habits, visions, goals } = ctx;

  if (/how many|count|total/.test(l)) {
    if (/note/.test(l)) return `You have **${stats.totalNotes} notes** in your system.`;
    if (/task/.test(l)) return `You have **${stats.totalTasks} tasks**: ${stats.pendingTasks} pending, ${tasks.filter((t: any) => t.status === "done").length} done, ${stats.inboxCount} unassigned.`;
    if (/project/.test(l)) return `You have **${stats.totalProjects} projects**.`;
    if (/habit/.test(l)) return `You're tracking **${stats.totalNotes > 0 ? ctx.habits.length : 0} habits**.`;
    if (/vision|goal|purpose/.test(l)) return `You have **${visions.length} vision statements**.`;
    return `Here's your snapshot: ${summarizeContext(ctx)}.`;
  }

  if (/what|list|show/.test(l)) {
    if (/project/.test(l)) {
      if (projects.length === 0) return "You haven't created any projects yet. Want me to help you start one?";
      return projects.map((p: any) => {
        const pGoals = goals.filter((g: any) => g.project_id === p.id);
        const done = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id && t.status === "done").length, 0);
        const total = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id).length, 0);
        return `• **${p.title}** — ${total > 0 ? `${done}/${total} tasks complete` : "No milestones yet"}${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`;
      }).join("\n") + "\n\nWant to dive deeper into any of these?";
    }
    if (/task/.test(l)) {
      if (tasks.length === 0) return "Your task list is empty. A clean slate!";
      const filtered = /done|complete/.test(l) ? tasks.filter((t: any) => t.status === "done") :
        /pending|inbox|unassigned/.test(l) ? tasks.filter((t: any) => !t.quadrant || t.quadrant === "") :
        /urgent/.test(l) ? tasks.filter((t: any) => t.quadrant === "urgent-important") : tasks;
      if (filtered.length === 0) return "No tasks match that filter.";
      return filtered.slice(0, 10).map((t: any) => {
        const statusEmojis: Record<string, string> = { "done": "✅", "in-progress": "🔄", "blocked": "🚫", "cancelled": "❌", "not-started": "○" };
        return `${statusEmojis[t.status] || "○"} **${t.title}**${t.quadrant ? ` [${t.quadrant}]` : " [inbox]"}`;
      }).join("\n") + (filtered.length > 10 ? `\n...and ${filtered.length - 10} more.` : "");
    }
    if (/note/.test(l)) {
      if (notes.length === 0) return "No notes yet. Your first note is a click away.";
      return notes.slice(0, 10).map((n: any) => `• **${n.title}**${(n.tags ?? []).length > 0 ? ` ${(n.tags ?? []).map((t: any) => `#${t.name}`).join(" ")}` : ""}`).join("\n") +
        (notes.length > 10 ? `\n...and ${notes.length - 10} more notes.` : "");
    }
  }

  return "";
}

function generateLibraryResponse(query: string, ctx: RichContext): string {
  const l = query.toLowerCase();
  if (/ogilvy|copymasters|advertising/.test(l)) {
    return `**From your Library: David Ogilvy**\n\nDavid Ogilvy (1911-1999) is known as the "Father of Advertising." His philosophy:\n\n• **The Big Idea**: Every campaign needs one powerful, original idea that stops people and makes them think.\n• **Headlines**: 5× more people read the headline than the body. If you haven't sold in the headline, you've wasted 80%.\n• **Research**: "Advertising people who ignore research are as dangerous as generals who ignore decodes of enemy signals."\n• **Brand Image**: Every advertisement should be thought of as a contribution to the complex symbol which is the brand image.\n\nYour copywriting lineage traces: You ← Ogilvy ← Hopkins ← Kennedy ← Lasker.`;
  }
  if (/h[ea]rmozi|100.?m(illion| offer| leads)/.test(l)) {
    return `**From your Library: Alex Hormozi**\n\nKey principles from *100M Offers* and *100M Leads*:\n\n• **The Grand Slam Offer**: Make them an offer so good they feel stupid saying no. The offer is the product.\n• **Value Equation**: Dream outcome × Perceived likelihood / (Time delay + Effort & sacrifice)\n• **Price is a signal**: If people aren't buying, improve the offer — don't lower the price.\n• **Stacking Value**: Add guarantees, bonuses, and risk reversal until perceived value is 10× price.\n\nYour lineage: You ← Hormozi ← Ogilvy ← Hopkins`;
  }
  if (/collins|good to great|hedgehog/.test(l)) {
    return `**From your Library: Jim Collins**\n\nKey concepts from *Good to Great*:\n\n• **The Hedgehog Concept**: The intersection of (1) what you're deeply passionate about, (2) what you can be the best in the world at, and (3) what drives your economic engine.\n• **Level 5 Leadership**: Leaders who combine personal humility with professional will — ambitious first and foremost for the company, not themselves.\n• **First Who, Then What**: Get the right people on the bus before deciding where to drive it.\n• **The Flywheel**: Build momentum through consistent effort in the right direction — no single push creates the breakthrough.`;
  }
  if (/sun tzu|art of war/.test(l)) {
    return `**From your Library: Sun Tzu**\n\nFrom *The Art of War*:\n\n• "If you know the enemy and know yourself, you need not fear the result of a hundred battles."\n• "The supreme art of war is to subdue the enemy without fighting."\n• "In the midst of chaos, there is also opportunity."\n• "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat."\n\nThese principles apply directly to business competition and product strategy.`;
  }
  if (/collier|reason why/.test(l)) {
    return `**From your Library: Robert Collier**\n\nKey principles from Collier's letter-writing:\n\n• **Reason-Why**: Give people logical reasons to buy. Even if they decide emotionally, they justify with logic.\n• **Enter the Conversation**: Start your copy by entering a conversation already happening in the reader's mind.\n• **Specifics beat generalities**: Specific numbers, facts, and examples are infinitely more persuasive than vague claims.`;
  }
  return "";
}

function generateComplexResponse(query: string, ctx: RichContext): string {
  const { projects, tasks, notes, visions, habits } = ctx;
  const l = query.toLowerCase();

  // ── Honest capability check ──
  // Deep business/revenue/strategy questions that require real reasoning
  if ((/revenue|million|billion|market|price|pricing|business model|profit|growth|scale|acquisition|fundraising|investor|pitch deck|competitor|competition|moat|unit economics|cac|ltv|churn/).test(l) &&
      (/how|what|should|would|strategy|plan|approach/).test(l)) {
    let response = "**⚠️ I need to be upfront with you**\n\n";
    response += "That's a deep strategic question that requires genuine business reasoning — the kind a GPT-4 or Claude would handle. ";
    response += "My current (deterministic) engine can't generate original strategic analysis. Here's what I CAN do:\n\n";

    response += "**📊 What I know from your data:**\n";
    if (projects.length > 0) response += `• ${projects.length} active projects\n`;
    if (tasks.length > 0) {
      const done = tasks.filter((t: any) => t.status === "done").length;
      response += `• ${tasks.length} tasks (${done} completed)\n`;
    }
    if (notes.length > 0) response += `• ${notes.length} notes (potential research material)\n`;
    if (visions.length > 0) response += `• ${visions.length} vision statements guiding your direction\n`;

    response += "\n**🚀 Instead, I can help you take action:**\n";
    response += "• **Create a project** to tackle this challenge → 'Create a project called \"100M Revenue Strategy\"'\n";
    response += "• **Break it into milestones** → 'Add a milestone \"Sales Pipeline\" to that project'\n";
    response += "• **Set up tasks** → 'Create a task called \"Research pricing strategy\"'\n";
    response += "• **Reference your library** → I can search your installed knowledge packs for relevant frameworks\n";
    response += "• **Add notes** to capture your thinking → 'Create a note called \"Revenue Growth Ideas\"'\n\n";

    response += "**📚 Your knowledge tree can help:**\n";
    response += "Your strategy lineage includes Collins (Hedgehog Concept), Sun Tzu (know yourself), and Christensen (disruption). ";
    response += "Their frameworks are in your library — ask me what Collins says about focus, or what Sun Tzu says about competition.\n\n";

    response += "**When the full LLM model is installed** (via the Standard or Pro tier), I'll be able to analyze this deeply. ";
    response += "For now, let me help you organize the work. What's your first step?";
    return response;
  }

  // Strategic planning with context
  if (/plan|roadmap|strategy/.test(l)) {
    let response = "**🧠 Strategic Framework**\n\n";
    response += "I can surface your existing data and help structure your thinking. Here's what I see:\n\n";

    if (visions.length > 0) {
      response += "**Your vision:**\n";
      const cats = [...new Set(visions.map((v: any) => v.category))];
      for (const cat of cats.slice(0, 3)) {
        const cV = visions.filter((v: any) => v.category === cat);
        response += `• ${cat}: ${cV.map((v: any) => v.title || v.vision_text?.slice(0, 80)).join(", ")}\n`;
      }
      response += "\n";
    }

    if (projects.length > 0) {
      const stalled = projects.filter((p: any) => {
        const pGoals = ctx.goals.filter((g: any) => g.project_id === p.id);
        const done = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id && t.status === "done").length, 0);
        const total = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id).length, 0);
        return total > 0 && done / total < 0.3;
      });
      if (stalled.length > 0) {
        response += `**⚠️ Stalled projects** (less than 30% complete):\n`;
        for (const p of stalled.slice(0, 3)) response += `• ${p.title}\n`;
        response += "\n";
      }
    }

    const inbox = tasks.filter((t: any) => !t.quadrant || t.quadrant === "");
    if (inbox.length > 5) {
      response += `📥 **${inbox.length} unassigned tasks** in your inbox. Sorting these into the Eisenhower matrix would clarify next steps.\n\n`;
    }

    response += "**To move forward, I can:**\n";
    if (projects.length === 0) response += "• Create your first project aligned with your top vision\n";
    response += "• Add milestones and tasks to any project\n";
    response += "• Run a Life Audit to see how current projects align with your vision\n";
    response += "• Search your library packs for relevant frameworks\n\n";
    response += "What would you like me to build?";
    return response;
  }

  // Decision framework
  if (/decide|should I|choice|option|compare/.test(l)) {
    let response = "**⚖️ Decision Framework**\n\n";
    const overdue = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled");
    const urgent = overdue.filter((t: any) => t.quadrant === "urgent-important");
    if (urgent.length > 0) {
      response += `🔴 You have ${urgent.length} urgent tasks. Before evaluating new decisions, clear these first.\n\n`;
    }

    response += "Here's a structured framework you can apply:\n\n";
    response += "**1. Define the options** (list each one explicitly)\n";
    response += "**2. Cost-benefit**: Time, money, energy, opportunity cost per option\n";
    response += "**3. Vision alignment**: Which option moves you toward your stated goals?\n";
    response += "**4. Reversibility**: Is this a 'one-way door' (hard to undo) or 'two-way door' (easy to reverse)?\n\n";

    response += "I can't evaluate the options for you (that requires a reasoning model), ";
    response += "but I can create projects and tasks to execute whatever decision you make. ";
    response += "Tell me your options and I'll help you structure the evaluation.";
    return response;
  }

  return "";
}

function generateToolResponse(executed: AIAction[]): string {
  const results = executed.map((a) => a.result || "").filter(Boolean);
  if (results.length === 0) return "";
  return results.join("\n");
}

async function generateWebSearchResponse(query: string, ctx: RichContext, thinking: string[]): Promise<string> {
  const settings = await import("./settings").then((m) => m.loadSettings());

  if (settings.webSearch === "never") {
    return "I'd love to help with that, but **web search is currently disabled** in your settings. " +
      "You can enable it in **Settings → Web Search** to let me access current information.\n\n" +
      "In the meantime, I can still help with anything in your personal data — " +
      "notes, tasks, projects, and your library packs.";
  }

  if (settings.webSearch === "ask") {
    // In the browser implementation, we'll show a one-time notice
    // The full permission dialog is handled in the Tauri backend
    thinking.push("   ⚠️ Web search is set to 'Ask' — proceeding with search");
  }

  thinking.push("   🌐 Searching the web...");
  const results = await searchWeb(query);

  if (results.length === 0) {
    return "I searched the web but couldn't find relevant results for your query. " +
      "Try being more specific or check your internet connection.\n\n" +
      "I can still help with:\n" +
      `• ${ctx.stats.totalNotes} notes in your system\n` +
      `• ${ctx.stats.totalProjects} projects and their milestones\n` +
      `• ${ctx.stats.totalTasks} tasks across your matrix\n` +
      `• Your library packs and knowledge tree`;
  }

  const formatted = formatSearchResults(results);
  thinking.push(`   → Found ${results.length} results`);

  let response = "**🌐 Web Search Results**\n\n";
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    response += `**${i + 1}. ${r.title}**\n`;
    response += `${r.snippet.slice(0, 400)}\n`;
    if (r.url) response += `🔗 ${r.url}\n`;
    response += "\n";
  }

  response += "\n---\n";
  response += `I found **${results.length} results** for your query. Want me to dig deeper into any of these, or search for something else?`;

  return response;
}

function generateSuggestions(ctx: RichContext, intent: Intent): string[] {
  const suggestions: string[] = [];
  const { projects, tasks, notes, habits, visions, stats } = ctx;

  if (stats.inboxCount > 3) suggestions.push(`📥 You have ${stats.inboxCount} unassigned tasks — sort them into the matrix`);
  if (projects.length === 0) suggestions.push("📊 Create your first project");
  if (notes.length === 0) suggestions.push("📝 Write your first note");
  if (habits.length === 0) suggestions.push("🔄 Set up your first habit");
  if (visions.length === 0) suggestions.push("👤 Define your life vision in About Me");
  if (stats.pendingTasks > stats.doneToday * 3) suggestions.push("🎯 Focus on completing tasks — try Pomodoro timer");
  if (intent === "library_query") suggestions.push("📚 Browse more library packs in the Library section");
  if (intent === "complex") suggestions.push("📋 Run a Life Audit to see how your projects align with your vision");
  if (intent === "web_search") suggestions.push("🌐 Change web search settings in Settings");

  return suggestions.slice(0, 4);
}

// ── Main Entry Point ──

export async function processChatMessage(
  userMessage: string,
  threadId: string,
  messageHistory: { role: string; content: string }[],
): Promise<AIResponse> {
  const startTime = Date.now();
  const thinking: string[] = [];

  // Step 1: Classify intent
  thinking.push("🧠 Step 1: Classifying intent...");
  const classified = classifyIntent(userMessage);
  thinking.push(`   → Intent: ${classified.intent} (confidence: ${(classified.confidence * 100).toFixed(0)}%)`);

  // Step 2: Gather rich context
  thinking.push("📚 Step 2: Gathering context from all sources...");
  const ctx = await gatherRichContext();
  thinking.push(`   → Found ${ctx.stats.totalNotes} notes, ${ctx.stats.totalTasks} tasks, ${ctx.stats.totalProjects} projects, ${ctx.visions.length} visions, ${ctx.habits.length} habits`);

  // Step 3: Multi-source RAG
  thinking.push("🔍 Step 3: Multi-source retrieval...");
  let libraryContext = "";
  let treeContext = "";

  if (classified.intent === "library_query" || classified.intent === "complex" || classified.intent === "brainstorm") {
    libraryContext = await getLibraryContext(userMessage, 3);
    if (libraryContext) thinking.push(`   → Found ${(libraryContext.match(/\[/g) || []).length} library references`);
    treeContext = getTreeContext(userMessage);
    if (treeContext) thinking.push(`   → Knowledge tree active for domain`);
  }

  // Step 4: Parse and execute tool commands
  thinking.push("⚡ Step 4: Checking for tool commands...");
  const parsedActions = parseActionsFromQuery(userMessage.toLowerCase(), userMessage);
  let executed: AIAction[] = [];

  if (parsedActions.length > 0) {
    const resolved = await resolveActionIds(parsedActions);
    for (const action of resolved) {
      const result = await executeAIAction(action);
      executed.push(result);
    }
    thinking.push(`   → Executed ${executed.length} action(s): ${executed.map((e) => e.result).filter(Boolean).join(", ")}`);
  } else {
    thinking.push(`   → No tool commands detected`);
  }

  // Step 5: Generate response based on intent
  thinking.push("💬 Step 5: Generating response...");

  let message = "";

  if (executed.length > 0) {
    // Tool execution responses
    message = generateToolResponse(executed);
    if (classified.intent === "tool_exec" || classified.intent === "pomodoro") {
      message += "\n\nWhat would you like to do next?";
    }
  } else if (classified.intent === "data_query") {
    message = generateDataResponse(userMessage, ctx);
  } else if (classified.intent === "library_query") {
    const libResp = generateLibraryResponse(userMessage, ctx);
    if (libResp) message = libResp;
    else message = generateDataResponse(userMessage, ctx) || generateSimpleGenResponse(userMessage, ctx);
  } else if (classified.intent === "complex" || classified.intent === "brainstorm") {
    message = generateComplexResponse(userMessage, ctx) || generateSimpleGenResponse(userMessage, ctx);
  } else if (classified.intent === "simple_gen") {
    message = generateSimpleGenResponse(userMessage, ctx);
  } else if (classified.intent === "about_me") {
    message = generateAboutMeResponse(userMessage, ctx);
  } else if (classified.intent === "life_audit") {
    message = "Run the **Life Audit** from the sidebar to see a full alignment analysis. I can see you have " +
      `${ctx.projects.length} projects and ${ctx.visions.length} vision statements. The audit checks how well your projects align with your vision.`;
  } else if (classified.intent === "web_search") {
    message = await generateWebSearchResponse(userMessage, ctx, thinking);
  } else if (classified.intent === "habits") {
    message = generateHabitsResponse(userMessage, ctx);
  } else if (classified.intent === "relation") {
    message = generateRelationResponse(userMessage, ctx);
  } else {
    // unknown — use the most general response
    message = generateUnknownResponse(userMessage, ctx);
  }

  // Fallback if nothing matched
  if (!message) {
    message = generateUnknownResponse(userMessage, ctx);
  }

  // Inject library and knowledge tree context into response
  if (libraryContext && !message.includes("From your Library")) {
    // Integrate library knowledge naturally into the response
    const libLines = libraryContext.split("\n").filter((l) => l.startsWith("[")).slice(0, 2);
    if (libLines.length > 0) {
      message += "\n\n📚 **Related from your library:**\n" + libLines.map((l) => l.replace(/^\[([^\]]+)\]\s*/, "• *$1*: ")).join("\n");
    }
  }

  // Add tree context if relevant but not already in response
  if (treeContext && !message.includes("lineage") && !message.includes("mentor")) {
    const treeLines = treeContext.split("\n").filter((l) => l.includes("←") || l.includes("•"));
    if (treeLines.length > 0) {
      message += "\n\n🌳 **Your knowledge lineage:**\n" + treeLines.join("\n");
    }
  }

  // Step 6: Generate suggestions
  const suggestions = generateSuggestions(ctx, classified.intent);

  // Timing
  const elapsed = Date.now() - startTime;
  thinking.push(`✅ Done in ${elapsed}ms`);

  // Save to chat history
  await api.saveChatMessage(threadId, "user", userMessage);
  await api.saveChatMessage(threadId, "assistant", message);

  return {
    message,
    thinking: thinking.join("\n"),
    actions: executed.length > 0 ? executed : undefined,
    suggestions,
  };
}

// ── Additional Response Generators ──

function generateSimpleGenResponse(query: string, ctx: RichContext): string {
  const l = query.toLowerCase();

  if (/summarize|summary/.test(l) && ctx.notes.length > 0) {
    const recent = ctx.notes[0];
    return `**Summary of "${recent.title}"**\n\n${(recent.content || "No content yet.").slice(0, 500)}${(recent.content || "").length > 500 ? "..." : ""}`;
  }

  if (/explain|what is|tell me about|describe/.test(l)) {
    const topic = l.replace(/explain|what is|tell me about|describe|the\s+/g, "").trim();
    if (ctx.notes.length > 0) {
      const matching = ctx.notes.filter((n: any) => n.title.toLowerCase().includes(topic) || (n.content || "").toLowerCase().includes(topic));
      if (matching.length > 0) {
        const n = matching[0];
        return `Based on your note "${n.title}":\n\n${(n.content || "No content yet.").slice(0, 500)}${(n.content || "").length > 500 ? "..." : ""}`;
      }
    }
    return `I'd need to search your library for more on "${topic}". You can also add notes on this topic to help me give you better answers. Want me to look it up in your library packs?`;
  }

  if (/draft|write|compose/.test(l)) {
    return `I can help draft that! Here's a starting point:\n\n---\n[Your draft will go here — tell me more about what you need and I'll refine it.]\n\n---\n\nI can pull from your library to make this more specific. What's the context?`;
  }

  return "";
}

function generateAboutMeResponse(query: string, ctx: RichContext): string {
  const { visions } = ctx;
  if (visions.length === 0) {
    return "Your **About Me** section is empty. This is where you define your life vision across 5 time horizons:\n\n" +
      "1. **Life Purpose** — Why am I here?\n" +
      "2. **10-Year Vision** — What does my ideal life look like?\n" +
      "3. **5-Year Vision** — What milestones get me there?\n" +
      "4. **1-Year Vision** — What's my focus this year?\n" +
      "5. **90-Day Plan** — What am I doing right now?\n\n" +
      "Head to the **About Me** section to start writing. Want me to help you think through any of these?";
  }
  const categories = [...new Set(visions.map((v: any) => v.category))];
  let resp = "**👤 Your Vision Overview**\n\n";
  for (const cat of categories) {
    const catV = visions.filter((v: any) => v.category === cat);
    resp += `**${cat}**: ${catV.map((v: any) => v.title || v.vision_text?.slice(0, 60)).join(", ")}\n`;
  }
  if (ctx.projects.length === 0) {
    resp += "\n\n💡 **Gap**: You have visions but no projects yet. Say 'Create a project for my career vision' to get started.";
  }
  return resp;
}

function generateHabitsResponse(query: string, ctx: RichContext): string {
  const { habits } = ctx;
  if (habits.length === 0) return "You're not tracking any habits yet. Start one in the **Habits** section — something small you can do daily.";
  const today = new Date().toISOString().split("T")[0];
  return `You have **${habits.length} habits** you're tracking:\n\n` +
    habits.map((h: any) => `${h.icon || "○"} **${h.name}**${h.subtext ? ` — ${h.subtext}` : ""}`).join("\n") +
    "\n\nCheck your **Habits** tab for detailed streaks and heatmaps.";
}

function generateRelationResponse(query: string, ctx: RichContext): string {
  const { projects, notes, tasks } = ctx;
  let resp = "**🔗 Connections**\n\n";

  // Note-Task connections
  if (notes.length > 0 && tasks.length > 0) {
    const noteTitles = notes.map((n: any) => n.title.toLowerCase());
    const relatedTasks = tasks.filter((t: any) => noteTitles.some((nt: string) => t.title.toLowerCase().includes(nt)));
    if (relatedTasks.length > 0) {
      resp += `Found **${relatedTasks.length} tasks** related to your notes:\n`;
      for (const t of relatedTasks.slice(0, 5)) resp += `• "${t.title}" ↔ note(s) with matching terms\n`;
    }
  }

  // Project-Note connections
  if (projects.length > 0 && notes.length > 0) {
    resp += `\nYou have **${projects.length} projects** and **${notes.length} notes**. `;
    const projTitles = projects.map((p: any) => p.title.toLowerCase());
    const matchingNotes = notes.filter((n: any) => projTitles.some((pt: string) => n.title.toLowerCase().includes(pt)));
    if (matchingNotes.length > 0) resp += `${matchingNotes.length} notes directly reference project themes.`;
    else resp += `Consider creating notes for each project to deepen your thinking.`;
  }

  return resp;
}

function generateUnknownResponse(query: string, ctx: RichContext): string {
  const { stats } = ctx;
  let resp = "I'm your RAIVA OS assistant. I can see everything in your system:\n\n";

  if (stats.totalNotes > 0 || stats.totalTasks > 0 || stats.totalProjects > 0) {
    resp += `📊 **Your current state**: ${summarizeContext(ctx)}.\n\n`;
  }

  if (ctx.notes.length > 0) {
    resp += `📝 **Latest note**: "${ctx.notes[0].title}"\n`;
  }
  const urgent = ctx.tasks.filter((t: any) => t.quadrant === "urgent-important" && t.status !== "done");
  if (urgent.length > 0) {
    resp += `⚠️ **Urgent tasks**: ${urgent.length} need attention\n`;
  }

  resp += "\n**What I can do:**\n";
  resp += "• **Find & retrieve** anything from your notes, tasks, projects\n";
  resp += "• **Create** tasks, projects, notes, milestones, habits\n";
  resp += "• **Search your library** for insights from top thinkers\n";
  resp += "• **Run a Life Audit** to score alignment against your vision\n";
  resp += "• **Search the web** (if enabled) for current information\n\n";
  resp += "**What I can't do** (yet): generate original strategic analysis, reason about complex business problems, write creative content, or have open-ended conversations. Those require the LLM upgrade in Standard/Pro tier.\n\n";
  resp += "What would you like me to find or create?";

  return resp;
}

// ── Knowledge Graph (unchanged from original) ──

export interface KnowledgeNode {
  id: string;
  label: string;
  type: "note" | "tag";
  embedding?: number[];
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  strength: number;
  label: string;
}

export async function buildKnowledgeGraph(): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
  const notes = await api.getNotes();
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const embeddings = new Map<string, number[]>();

  for (const note of notes) {
    const text = `${note.title} ${note.content}`;
    const emb = await getEmbedding(text);
    embeddings.set(note.id, emb);
    nodes.push({ id: note.id, label: note.title || "Untitled", type: "note", embedding: emb });
    for (const tag of note.tags ?? []) {
      const tagId = `tag-${tag.name}`;
      if (!nodes.find((n) => n.id === tagId)) {
        nodes.push({ id: tagId, label: tag.name, type: "tag" });
      }
      edges.push({ source: note.id, target: tagId, strength: 1, label: "tagged" });
    }
  }

  const ids = Array.from(embeddings.keys());
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(embeddings.get(ids[i])!, embeddings.get(ids[j])!);
      if (sim > 0.5) {
        edges.push({ source: ids[i], target: ids[j], strength: Math.round(sim * 100) / 100, label: `${Math.round(sim * 100)}% similar` });
      }
    }
  }

  return { nodes, edges };
}
