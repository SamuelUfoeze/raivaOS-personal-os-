import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import HabitHeatmap from "../components/HabitHeatmap";

const EMOJI_OPTIONS = ["🔥", "💪", "🧘", "📖", "🏃", "🎯", "💧", "🥗", "🧠", "🎨", "🎵", "🌱", "☀️", "🌙", "⚡", "🎮"];

export default function HabitsScreen() {
  const [habits, setHabits] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, boolean>>({});
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subtext, setSubtext] = useState("");
  const [icon, setIcon] = useState("🔥");
  const [color, setColor] = useState("#7C3AED");
  const [frequency, setFrequency] = useState("daily");
  const [frequencyValue, setFrequencyValue] = useState("1");
  const [viewingHeatmap, setViewingHeatmap] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [h, t, logs] = await Promise.all([
        api.getHabits(),
        api.getHabitTodayStatus(),
        api.getHabitLogsAll(),
      ]);
      setHabits(h);
      setAllLogs(logs);
      const todayLogs: Record<string, boolean> = {};
      t.forEach((item: any) => {
        todayLogs[item.habit.id] = item.done_today;
        item.weekly_logs.forEach((wl: any) => {});
      });
      setDailyLogs(todayLogs);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleHabit(habitId: string) {
    const done = !dailyLogs[habitId];
    const td = new Date().toISOString().slice(0, 10);
    await api.logHabitTick(habitId, td, done);
    setDailyLogs((prev) => ({ ...prev, [habitId]: done }));
    const logs = await api.getHabitLogsAll();
    setAllLogs(logs);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    await api.createHabit({
      name,
      subtext,
      icon,
      color_hex: color,
      frequency: "daily",
      frequency_value: "1",
    });
    setName("");
    setSubtext("");
    setIcon("🔥");
    setCreating(false);
    load();
  }

  async function handleUpdate(id: string) {
    if (!name.trim()) return;
    await api.updateHabit(id, {
      name,
      subtext,
      icon,
      color_hex: color,
      frequency,
      frequency_value: frequencyValue,
    });
    setEditingId(null);
    setName("");
    setSubtext("");
    setIcon("🔥");
    setColor("#7C3AED");
    setFrequency("daily");
    setFrequencyValue("1");
    load();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this habit?")) {
      await api.deleteHabit(id);
      load();
    }
  }

  async function startEditing(h: any) {
    setEditingId(h.id);
    setName(h.name);
    setSubtext(h.subtext || "");
    setIcon(h.icon || "🔥");
    setColor(h.color_hex || "#7C3AED");
    setFrequency(h.frequency || "daily");
    setFrequencyValue(h.frequency_value || "1");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading habits...
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Habits</h1>
          <p className="text-muted-foreground text-sm">{today}</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Add Habit</Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <Input
              placeholder="Habit name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Input
              placeholder="Subtext (optional)"
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
            />
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(e)}
                    className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg border ${
                      icon === e ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Color:</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Habit</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {habits.length === 0 && !creating && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No habits yet. Add your first daily habit!
          </CardContent>
        </Card>
      )}

      {/* Daily habits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {habits.map((h: any) => {
          const done = dailyLogs[h.id] ?? false;
          const habitLogs = allLogs.filter((l: any) => l.habit_id === h.id);
          return (
            <Card
              key={h.id}
              className={`transition-all ${
                editingId === h.id ? "" : "cursor-pointer"
              } ${
                done && editingId !== h.id
                  ? "ring-2 ring-emerald-400 dark:ring-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "hover:shadow-md"
              }`}
              onClick={() => {
                if (editingId !== h.id) toggleHabit(h.id);
              }}
            >
              {editingId === h.id ? (
                <CardContent className="p-4 space-y-3">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Input value={subtext} onChange={(e) => setSubtext(e.target.value)} />
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setIcon(e)}
                        className={`text-xl w-8 h-8 flex items-center justify-center rounded border ${
                          icon === e ? "border-primary bg-primary/10" : "border-border"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-8"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(h.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl w-12 h-12 flex items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: done ? `${h.color_hex}20` : `${h.color_hex}10`,
                      }}
                    >
                      {h.icon || "○"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{h.name}</div>
                      {h.subtext && (
                        <div className="text-xs text-muted-foreground truncate">{h.subtext}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {done ? (
                          <Badge variant="success">✓ Done</Badge>
                        ) : (
                          <Badge variant="outline">Tap to log</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(h);
                        }}
                        className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-accent"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingHeatmap(viewingHeatmap === h.id ? null : h.id);
                        }}
                        className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-accent"
                        title="View heatmap"
                      >
                        📊
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(h.id);
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive px-1"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Weekly mini-progress: last 7 days */}
                  <div className="flex gap-1 mt-3">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      const ds = d.toISOString().slice(0, 10);
                      const wasDone = habitLogs.some(
                        (l: any) => l.date_string === ds && l.status
                      );
                      return (
                        <div
                          key={i}
                          className="flex-1 h-2 rounded-full"
                          style={{
                            backgroundColor: wasDone ? h.color_hex : "hsl(var(--muted))",
                            opacity: wasDone ? 0.7 : 0.3,
                          }}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              )}

              {/* Heatmap (expandable) */}
              {viewingHeatmap === h.id && (
                <div className="px-4 pb-4 border-t pt-3">
                  <HabitHeatmap logs={habitLogs} habitColor={h.color_hex} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
