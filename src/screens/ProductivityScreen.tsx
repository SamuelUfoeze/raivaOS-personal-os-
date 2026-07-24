import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import InlineEdit from "../components/InlineEdit";
import PomodoroTimer from "../components/PomodoroTimer";

const QUADRANTS = [
  { id: "urgent-important", label: "Urgent & Important", headerColor: "bg-red-500", borderColor: "border-red-300" },
  { id: "not-urgent-important", label: "Not Urgent & Important", headerColor: "bg-blue-500", borderColor: "border-blue-300" },
  { id: "urgent-not-important", label: "Urgent & Not Important", headerColor: "bg-amber-500", borderColor: "border-amber-300" },
  { id: "not-urgent-not-important", label: "Not Urgent & Not Important", headerColor: "bg-gray-400", borderColor: "border-gray-300" },
];

export default function ProductivityScreen() {
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("25");
  const [focusTask, setFocusTask] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getTasksWithSources();
      setAllTasks(data);
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
    // Tasks created here go to inbox (no quadrant assigned)
    await api.createTask({
      title: newTitle,
      quadrant: "",
      duration_mins: parseInt(newDuration) || 25,
      status: "not-started",
    });
    setNewTitle("");
    load();
  }

  async function handleAssignToQuadrant(id: string, quadrant: string) {
    await api.updateTask(id, { quadrant });
    load();
  }

  async function handleRemoveFromMatrix(id: string) {
    await api.updateTask(id, { quadrant: "" });
    load();
  }

  async function handleTitleEdit(id: string, title: string) {
    await api.updateTask(id, { title });
    load();
  }

  async function handleToggle(id: string, status: string) {
    await api.updateTaskStatus(id, status === "done" ? "not-started" : "done");
    load();
  }

  async function handleDurationChange(id: string, durationMins: number) {
    await api.updateTask(id, { duration_mins: durationMins });
    load();
  }

  const handleTimerComplete = useCallback(async (taskId: string, completedMins: number) => {
    await api.logFocusSession({
      task_id: taskId, completed_mins: completedMins, duration_mins: completedMins,
      status: "completed",
      started_at: new Date(Date.now() - completedMins * 60000).toISOString(),
      ended_at: new Date().toISOString(),
    });
    setFocusTask(null);
    load();
  }, []);

  const handleTimerPause = useCallback(async (taskId: string, elapsedMins: number) => {
    if (elapsedMins > 0) {
      await api.logFocusSession({
        task_id: taskId, completed_mins: elapsedMins, duration_mins: elapsedMins,
        status: "paused",
        started_at: new Date(Date.now() - elapsedMins * 60000).toISOString(),
        ended_at: new Date().toISOString(),
      });
      load();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  const activeTasks = allTasks.filter((t) => t.status !== "cancelled");
  const inboxTasks = activeTasks.filter((t) => !t.quadrant);
  const matrixTasks = activeTasks.filter((t) => t.quadrant);

  const totalDuration = matrixTasks.reduce((s: number, t: any) => s + (t.duration_mins || 0), 0);
  const actualDuration = matrixTasks.reduce((s: number, t: any) => s + (t.actual_mins || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
        <p className="text-muted-foreground text-sm">
          {matrixTasks.length} in matrix · {inboxTasks.length} in inbox · {totalDuration}m planned
        </p>
      </div>

      {/* Quick-add: creates in inbox, NOT auto-assigned */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Input
            placeholder="New task (goes to inbox — assign quadrant below)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
            }}
            className="flex-1"
          />
          <Input
            type="number" placeholder="min" value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)}
            className="w-16 text-center" min={1}
          />
          <Button onClick={handleCreate}>Add to Inbox</Button>
        </CardContent>
      </Card>

      {/* TASK INBOX — all unassigned tasks live here */}
      {inboxTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              Task Inbox
              <Badge variant="secondary" className="text-xs">{inboxTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {inboxTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border text-sm hover:bg-accent/30">
                <input
                  type="checkbox" checked={t.status === "done"}
                  onChange={() => handleToggle(t.id, t.status)}
                  className="rounded w-4 h-4 shrink-0"
                />
                <span className={`flex-1 truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  <InlineEdit value={t.title} onSave={(val) => handleTitleEdit(t.id, val)} className="text-sm" />
                </span>
                {t.duration_mins > 0 && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{t.duration_mins}m</span>
                )}
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) handleAssignToQuadrant(t.id, e.target.value); }}
                  className="text-xs rounded border border-input bg-background px-2 py-1 cursor-pointer shrink-0"
                  title="Assign to quadrant"
                >
                  <option value="">→ Assign to...</option>
                  {QUADRANTS.map((q) => (
                    <option key={q.id} value={q.id}>{q.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setFocusTask(focusTask?.id === t.id ? null : t)}
                  className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:text-primary"
                  title="Focus timer"
                >⏱</button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inboxTasks.length === 0 && matrixTasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No tasks yet. Add one above, then assign it to a quadrant.
          </CardContent>
        </Card>
      )}

      {/* EISENHOWER MATRIX — only quadrant-assigned tasks */}
      {matrixTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUADRANTS.map((quad) => {
            const quadTasks = matrixTasks.filter((t) => t.quadrant === quad.id);
            const qDur = quadTasks.reduce((s: number, t: any) => s + (t.duration_mins || 0), 0);
            const qAct = quadTasks.reduce((s: number, t: any) => s + (t.actual_mins || 0), 0);

            return (
              <Card key={quad.id} className={`${quad.borderColor} border`}>
                <CardHeader className={`p-3 ${quad.headerColor} text-white rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{quad.label}</CardTitle>
                    <span className="text-xs opacity-80 font-mono">{qAct}/{qDur}m</span>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {quadTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No tasks</p>
                  ) : (
                    quadTasks.map((t) => (
                      <div key={t.id} className={`flex items-center gap-2 p-2 rounded-md bg-background/80 text-sm border ${t.status === "done" ? "line-through opacity-50" : ""}`}>
                        <input type="checkbox" checked={t.status === "done"} onChange={() => handleToggle(t.id, t.status)} className="rounded shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">
                          <InlineEdit value={t.title} onSave={(val) => handleTitleEdit(t.id, val)} className="text-sm" />
                        </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <input type="number" value={t.duration_mins || 0} onChange={(e) => handleDurationChange(t.id, parseInt(e.target.value) || 0)} className="w-12 text-xs text-center rounded border-0 bg-muted/50 p-0.5" min={0} title="Duration (minutes)" />
                            <span className="text-xs text-muted-foreground font-mono">
                              {t.actual_mins > 0 ? `${Math.max(0, t.duration_mins - t.actual_mins)}m left` : `${t.duration_mins}m`}
                            </span>
                            {t.duration_mins > 0 && (
                              <div className="w-12 bg-muted rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, ((t.actual_mins || 0) / t.duration_mins) * 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setFocusTask(focusTask?.id === t.id ? null : t)} className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:text-primary" title="Focus timer">⏱</button>
                          <button onClick={() => handleRemoveFromMatrix(t.id)} className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950" title="Remove from matrix (back to inbox)">⊘</button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Time blocking summary */}
      {matrixTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time Blocking Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><div className="text-2xl font-bold">{matrixTasks.length}</div><div className="text-xs text-muted-foreground">Matrix Tasks</div></div>
              <div><div className="text-2xl font-bold">{totalDuration}m</div><div className="text-xs text-muted-foreground">Planned</div></div>
              <div><div className="text-2xl font-bold">{actualDuration}m</div><div className="text-xs text-muted-foreground">Spent</div></div>
              <div><div className="text-2xl font-bold">{Math.max(0, totalDuration - actualDuration)}m</div><div className="text-xs text-muted-foreground">Remaining</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Focus Timer modal */}
      {focusTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-sm mx-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Focus Timer</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setFocusTask(null)}>✕</Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <PomodoroTimer
                taskTitle={focusTask.title}
                defaultMinutes={Math.max(1, focusTask.duration_mins - (focusTask.actual_mins || 0))}
                onComplete={(mins) => handleTimerComplete(focusTask.id, mins)}
                onPause={(mins) => handleTimerPause(focusTask.id, mins)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
