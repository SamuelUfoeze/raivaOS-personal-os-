import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import InlineEdit from "../components/InlineEdit";

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [addingMilestone, setAddingMilestone] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [addingTask, setAddingTask] = useState<{ projectId: string; goalId: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDuration, setTaskDuration] = useState("25");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    await api.createProject({ title, description: desc, color });
    setTitle(""); setDesc(""); setCreating(false);
    load();
  }

  async function handleEditProject(id: string, updates: any) {
    await api.updateProject(id, updates);
    load();
  }

  async function handleAddMilestone(projectId: string) {
    if (!milestoneTitle.trim()) return;
    await api.createGoal({ project_id: projectId, title: milestoneTitle, priority: "medium" });
    setMilestoneTitle("");
    setAddingMilestone(null);
    load();
  }

  async function handleEditGoal(id: string, title: string) {
    await api.updateGoal(id, { title });
    load();
  }

  async function handleDeleteGoal(id: string) {
    await api.deleteGoal(id);
    load();
  }

  async function handleAddTask(goalId: string, projectId: string) {
    if (!taskTitle.trim()) return;
    await api.createTask({ goal_id: goalId, project_id: projectId, title: taskTitle, duration_mins: parseInt(taskDuration) || 25, quadrant: "", status: "not-started" });
    setTaskTitle(""); setAddingTask(null);
    load();
  }

  async function handleEditTask(id: string, title: string) {
    await api.updateTask(id, { title });
    load();
  }

  async function handleToggleTask(id: string, status: string) {
    await api.updateTaskStatus(id, status === "done" ? "not-started" : "done");
    load();
  }

  async function handleDeleteTask(id: string) {
    await api.deleteTask(id);
    load();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading projects...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
            {projects.reduce((s, p) => s + p.goals.length, 0) > 0 && ` · ${projects.reduce((s, p) => s + p.goals.length, 0)} milestones`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New Project</Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Project title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Textarea placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex items-center gap-2">
              <label className="text-sm">Color:</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !creating && (
        <p className="text-center text-muted-foreground py-12">No projects yet. Create your first one!</p>
      )}

      <div className="space-y-4">
        {projects.map((p: any) => {
          const totalTasks = p.goals.reduce((s: number, g: any) => s + g.tasks.length, 0);
          const doneTasks = p.goals.reduce((s: number, g: any) => s + g.tasks.filter((t: any) => t.status === "done").length, 0);
          const isExpanded = expanded[p.project.id] ?? false;

          return (
            <Card key={p.project.id} className="border-l-4" style={{ borderLeftColor: p.project.color }}>
              <CardHeader className="flex flex-row items-start justify-between cursor-pointer" onClick={() => toggleExpand(p.project.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg" onClick={(e) => e.stopPropagation()}>
                      <InlineEdit
                        value={p.project.title}
                        onSave={(val) => handleEditProject(p.project.id, { title: val })}
                        className="text-lg font-semibold"
                      />
                    </CardTitle>
                    {totalTasks > 0 && <Badge variant={doneTasks === totalTasks ? "success" : "warning"}>{doneTasks}/{totalTasks} tasks</Badge>}
                  </div>
                  <div className="text-sm mt-1" onClick={(e) => e.stopPropagation()}>
                    <InlineEdit
                      value={p.project.description || "No description"}
                      onSave={(val) => handleEditProject(p.project.id, { description: val })}
                      placeholder="Add description..."
                      className="text-muted-foreground"
                      as="textarea"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                    <label className="text-xs text-muted-foreground">Color:</label>
                    <input type="color" value={p.project.color} onChange={(e) => handleEditProject(p.project.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer" />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">{Math.round(p.progress)}%</span>
                  <button onClick={(e) => { e.stopPropagation(); }} className="text-sm text-muted-foreground hover:text-destructive" title="Delete project">🗑</button>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, backgroundColor: p.project.color }} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Milestones ({p.goals.length})</h4>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAddingMilestone(p.project.id); }}>+ Milestone</Button>
                    </div>

                    {addingMilestone === p.project.id && (
                      <div className="flex gap-2">
                        <Input placeholder="Milestone name" value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddMilestone(p.project.id); }}} />
                        <Button size="sm" onClick={() => handleAddMilestone(p.project.id)}>Add</Button>
                        <Button variant="ghost" size="sm" onClick={() => setAddingMilestone(null)}>Cancel</Button>
                      </div>
                    )}

                    {p.goals.map((g: any) => (
                      <div key={g.goal.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${g.goal.status === "done" ? "bg-emerald-500" : "bg-amber-400"}`} />
                            <div className="font-medium text-sm" onClick={(e) => e.stopPropagation()}>
                              <InlineEdit value={g.goal.title} onSave={(val) => handleEditGoal(g.goal.id, val)} />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{g.tasks.filter((t: any) => t.status === "done").length}/{g.tasks.length} tasks</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAddingTask({ projectId: p.project.id, goalId: g.goal.id }); }}>+ Task</Button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(g.goal.id); }} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                          </div>
                        </div>

                        {addingTask?.goalId === g.goal.id && (
                          <div className="flex gap-2 pl-4">
                            <Input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(g.goal.id, p.project.id); }}} className="flex-1" />
                            <Input type="number" placeholder="min" value={taskDuration} onChange={(e) => setTaskDuration(e.target.value)} className="w-16" min={1} />
                            <Button size="sm" onClick={() => handleAddTask(g.goal.id, p.project.id)}>Add</Button>
                            <Button variant="ghost" size="sm" onClick={() => setAddingTask(null)}>Cancel</Button>
                          </div>
                        )}

                        {g.tasks.length > 0 && (
                          <div className="pl-4 space-y-1">
                            {g.tasks.map((t: any) => (
                              <div key={t.id} className={`flex items-center gap-2 text-sm py-1 ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                <input type="checkbox" checked={t.status === "done"} onChange={() => handleToggleTask(t.id, t.status)} className="rounded w-3.5 h-3.5 shrink-0" />
                                <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                  <InlineEdit value={t.title} onSave={(val) => handleEditTask(t.id, val)} className="text-sm" />
                                </div>
                                {t.duration_mins > 0 && <span className="text-xs text-muted-foreground font-mono shrink-0">{t.actual_mins}/{t.duration_mins}m</span>}
                                <button onClick={() => handleDeleteTask(t.id)} className="text-xs text-muted-foreground hover:text-destructive shrink-0">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}

              {!isExpanded && (
                <CardContent className="pt-0 pb-4">
                  <div className="flex gap-2 flex-wrap">
                    {p.goals.slice(0, 3).map((g: any) => (
                      <Badge key={g.goal.id} variant="secondary" className="text-xs">{g.goal.title}</Badge>
                    ))}
                    {p.goals.length > 3 && <Badge variant="outline" className="text-xs">+{p.goals.length - 3} more</Badge>}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
