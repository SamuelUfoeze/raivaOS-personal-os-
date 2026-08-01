import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { timeAgo, truncate, stripHtml, cn } from "../lib/utils";
import { loadSettings, subscribeSettings } from "../lib/settings";
import ChatWidget from "../components/ChatWidget";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface DashboardProps {
  onNavigate: (screen: string) => void;
  onOpenNote: (id: string) => void;
}

export default function Dashboard({ onNavigate, onOpenNote }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [userName, setUserName] = useState(() => loadSettings().userName || "User");

  useEffect(() => {
    return subscribeSettings((s) => setUserName(s.userName || "User"));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [notes, tasks, habitsStatus, projects] = await Promise.all([
          api.getNotes(),
          api.getTasks(),
          api.getHabitTodayStatus(),
          api.getProjects(),
        ]);

        const pendingTasks = tasks.filter((t: any) => t.status === "pending");
        const urgentTasks = pendingTasks.filter((t: any) => t.quadrant === "urgent-important" || t.quadrant === "urgent-not-important");
        const recentNotes = notes.sort(
          (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 5);
        const notesThisWeek = notes.filter((n: any) => {
          const d = new Date(n.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return d >= weekAgo;
        }).length;
        const activeProjects = projects.filter((p: any) => p.project.status === "active").length;
        const todayDone = habitsStatus.filter((h: any) => h.done_today).length;
        const focusScore = Math.min(
          100,
          Math.round((todayDone / Math.max(habitsStatus.length, 1)) * 50 + Math.max(100 - pendingTasks.length * 5, 0) * 0.5)
        );

        setStats({
          tasks_pending: pendingTasks.length,
          active_projects: activeProjects,
          notes_this_week: notesThisWeek,
          focus_score: focusScore,
          top_urgent_tasks: urgentTasks.slice(0, 5),
          recent_notes: recentNotes,
          habit_today: habitsStatus,
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Could not load data. Try seeding some notes or tasks first.
      </div>
    );
  }

  const greeting = getGreeting();
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-primary text-primary-foreground p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold">{greeting}, {userName}</h1>
        <p className="opacity-90 mt-1">{date} • You have {stats.tasks_pending} tasks for today</p>
        <p className="text-sm mt-4 opacity-80">💡 AI Insight: You're most productive between 9-11 AM</p>
        <div className="mt-4 bg-white/20 inline-block px-3 py-1 rounded-full text-sm font-medium">
          Focus Score: {stats.focus_score}%
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Pending Tasks" value={stats.tasks_pending} icon="✅" />
        <MetricCard label="Active Projects" value={stats.active_projects} icon="📊" />
        <MetricCard label="Notes This Week" value={stats.notes_this_week} icon="📝" />
        <MetricCard label="Focus Score" value={`${stats.focus_score}%`} icon="🎯" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Urgent Tasks</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("tasks")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {stats.top_urgent_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending urgent tasks.</p>
            ) : (
              <ul className="space-y-2">
                {stats.top_urgent_tasks.map((t: any) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.duration_mins > 0 && (
                      <span className="text-xs text-muted-foreground">{t.duration_mins}m</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Notes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("notes")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recent_notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.recent_notes.map((n: any) => (
                  <li key={n.id}>
                    <button
                      onClick={() => onOpenNote(n.id)}
                      className="flex flex-col items-start w-full text-left p-2 rounded-md hover:bg-accent text-sm"
                      style={n.background_color ? { backgroundColor: n.background_color } : undefined}
                    >
                      <span className="font-medium truncate w-full">
                        {n.title || "Untitled"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(n.updated_at)} · {truncate(stripHtml(n.content), 60)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Habits Overview</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("habits")}>
            View more
          </Button>
        </CardHeader>
        <CardContent>
          {stats.habit_today.length === 0 ? (
            <p className="text-sm text-muted-foreground">No habits defined yet.</p>
          ) : (
            <div className="space-y-4">
              {stats.habit_today.map((h: any) => {
                const weekDays = getWeekDays();
                const todayStr = new Date().toISOString().slice(0, 10);
                return (
                  <div key={h.habit.id} className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{h.habit.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{h.habit.name}</div>
                      <div className="flex items-center gap-1 mt-1">
                        {weekDays.map((day: any) => {
                          const logged = (h.weekly_logs || []).find(
                            (l: any) => l.date_string === day.date && l.status
                          );
                          const isToday = day.date === todayStr;
                          return (
                            <div
                              key={day.date}
                              title={`${day.label}: ${logged ? "Done" : "Not done"} (Streak: ${h.streak})`}
                              className={cn(
                                "w-7 h-7 rounded-sm text-[10px] flex items-center justify-center font-medium border transition-colors",
                                isToday && "ring-2 ring-primary ring-offset-1",
                                logged
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {day.short}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium">{h.streak} day streak</div>
                      <div className={cn(
                        "text-xs",
                        h.done_today ? "text-green-600" : "text-muted-foreground"
                      )}>
                        {h.done_today ? "Done today" : "Pending"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl z-40"
        onClick={() => setChatOpen((o) => !o)}
      >
        {chatOpen ? "✕" : "🤖"}
      </Button>
    </div>
  );
}

function getWeekDays() {
  const days = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const full = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const idx = d.getDay();
    days.push({
      date: d.toISOString().slice(0, 10),
      label: full[idx],
      short: labels[idx],
    });
  }
  return days;
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
