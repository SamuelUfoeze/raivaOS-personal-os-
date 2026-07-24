import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import InlineEdit from "../components/InlineEdit";

const TASK_STATUSES = [
  { value: "not-started", label: "Not Started" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "cancelled", label: "Cancelled" },
];

const QUADRANT_OPTIONS = [
  { value: "", label: "Unassigned (Inbox)" },
  { value: "urgent-important", label: "Urgent & Important" },
  { value: "not-urgent-important", label: "Not Urgent & Important" },
  { value: "urgent-not-important", label: "Urgent & Not Important" },
  { value: "not-urgent-not-important", label: "Not Urgent & Not Important" },
];

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quadrantFilter, setQuadrantFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newQuadrant, setNewQuadrant] = useState("");
  const [newDuration, setNewDuration] = useState("25");
  const [newTags, setNewTags] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.getTasksWithSources();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    await api.createTask({
      title: newTitle,
      quadrant: newQuadrant,
      duration_mins: parseInt(newDuration) || 25,
      status: "not-started",
      tags,
    });
    setNewTitle("");
    setNewTags("");
    setNewQuadrant("");
    setShowCreate(false);
    load();
  }

  async function handleStatusChange(id: string, status: string) {
    await api.updateTaskStatus(id, status);
    load();
  }

  async function handleQuadrantChange(id: string, quadrant: string) {
    await api.updateTask(id, { quadrant });
    load();
  }

  async function handleEditTask(id: string, title: string) {
    await api.updateTask(id, { title });
    load();
  }

  async function handleDelete(id: string) {
    await api.deleteTask(id);
    load();
  }

  async function handleQuickToggle(id: string, currentStatus: string) {
    const next = currentStatus === "done" ? "not-started" : "done";
    await api.updateTaskStatus(id, next);
    load();
  }

  const sources = [...new Set(tasks.map((t) => t.source_label).filter(Boolean))];

  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (quadrantFilter === "unassigned" && t.quadrant) return false;
    if (quadrantFilter === "assigned" && !t.quadrant) return false;
    if (quadrantFilter !== "all" && quadrantFilter !== "unassigned" && quadrantFilter !== "assigned" && t.quadrant !== quadrantFilter) return false;
    if (sourceFilter === "standalone" && t.source_label) return false;
    if (sourceFilter === "sourced" && !t.source_label) return false;
    if (sourceFilter !== "all" && sourceFilter !== "standalone" && sourceFilter !== "sourced" && t.source_label !== sourceFilter) return false;
    return true;
  });

  const unassigned = filtered.filter((t) => !t.quadrant);
  const assigned = filtered.filter((t) => t.quadrant);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Tasks</h1>
          <p className="text-muted-foreground text-sm">
            {tasks.length} total ·{" "}
            {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length} active ·{" "}
            {tasks.filter((t) => t.status === "done").length} done ·{" "}
            {tasks.filter((t) => !t.quadrant).length} unassigned
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Task</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <div className="flex gap-2 flex-wrap">
              <Select
                options={QUADRANT_OPTIONS}
                value={newQuadrant}
                onChange={(e) => setNewQuadrant(e.target.value)}
                className="max-w-[220px]"
              />
              <Input
                type="number"
                placeholder="Duration (min)"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="max-w-[120px]"
                min={1}
              />
              <Input
                placeholder="Tags (comma-separated)"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Task</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[200px]"
        />
        <Select
          options={[
            { value: "all", label: "All Statuses" },
            ...TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-[150px]"
        />
        <Select
          options={[
            { value: "all", label: "All Quadrants" },
            { value: "unassigned", label: "Unassigned (Inbox)" },
            { value: "assigned", label: "Assigned to Matrix" },
            ...QUADRANT_OPTIONS.slice(1).map((q) => ({ value: q.value, label: q.label })),
          ]}
          value={quadrantFilter}
          onChange={(e) => setQuadrantFilter(e.target.value)}
          className="max-w-[200px]"
        />
        <Select
          options={[
            { value: "all", label: "All Sources" },
            { value: "standalone", label: "Freestanding" },
            { value: "sourced", label: "From Projects" },
            ...sources.map((s) => ({ value: s, label: s })),
          ]}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="max-w-[200px]"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {tasks.length}
        </span>
      </div>

      {/* Unassigned tasks (Inbox) */}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Inbox ({unassigned.length})
          </h3>
          <TaskRowList
            tasks={unassigned}
            onToggle={handleQuickToggle}
            onStatusChange={handleStatusChange}
            onQuadrantChange={handleQuadrantChange}
            onDelete={handleDelete}
            onTitleEdit={handleEditTask}
          />
        </div>
      )}

      {/* Assigned tasks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          All Tasks ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {tasks.length === 0
              ? "No tasks yet. Create one or add milestones to projects."
              : "No tasks match the filters."}
          </p>
        ) : (
          <TaskRowList
            tasks={filtered}
            onToggle={handleQuickToggle}
            onStatusChange={handleStatusChange}
            onQuadrantChange={handleQuadrantChange}
            onDelete={handleDelete}
            onTitleEdit={handleEditTask}
          />
        )}
      </div>
    </div>
  );
}

function TaskRowList({
  tasks,
  onToggle,
  onStatusChange,
  onQuadrantChange,
  onDelete,
  onTitleEdit,
}: {
  tasks: any[];
  onToggle: (id: string, status: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onQuadrantChange: (id: string, quadrant: string) => void;
  onDelete: (id: string) => void;
  onTitleEdit?: (id: string, title: string) => void;
}) {
  return (
    <div className="space-y-1">
      {tasks.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors ${
            t.status === "done"
              ? "bg-muted/30 opacity-70"
              : "bg-card hover:bg-accent/30"
          }`}
        >
          <input
            type="checkbox"
            checked={t.status === "done"}
            onChange={() => onToggle(t.id, t.status)}
            className="rounded w-4 h-4 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 ${t.status === "done" ? "line-through" : ""}`}>
              <span className="font-medium truncate">
                <InlineEdit value={t.title} onSave={(val) => onTitleEdit?.(t.id, val)} className="text-sm font-medium" />
              </span>
              {t.duration_mins > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 font-mono">
                  {t.actual_mins > 0 ? `${t.actual_mins}/${t.duration_mins}m` : `${t.duration_mins}m`}
                </span>
              )}
              {t.source_label && <Badge variant="outline" className="text-xs shrink-0">{t.source_label}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <select value={t.status} onChange={(e) => onStatusChange(t.id, e.target.value)} className="text-xs rounded border-0 bg-transparent p-0 cursor-pointer font-medium text-muted-foreground">
                {TASK_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
              {(t.tags ?? []).map((tag: string) => (<Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select value={t.quadrant || ""} onChange={(e) => onQuadrantChange(t.id, e.target.value)} className="text-xs rounded border border-input bg-background px-1 py-0.5 max-w-[130px]" title="Assign to Eisenhower quadrant">
              {QUADRANT_OPTIONS.map((q) => (<option key={q.value} value={q.value}>{q.label}</option>))}
            </select>
            <button onClick={() => onDelete(t.id)} className="text-xs text-muted-foreground hover:text-destructive p-1" title="Delete task">🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}
