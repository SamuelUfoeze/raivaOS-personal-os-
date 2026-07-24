import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const VISION_CATEGORIES = [
  { id: "life-vision", label: "Life Vision", placeholder: "What do you want your life to look like in 5–10 years?", horizon: "10-year" },
  { id: "purpose", label: "Purpose / Mission", placeholder: "Why do you exist? What drives you?", horizon: "life" },
  { id: "career-5y", label: "Career (5 Year)", placeholder: "Where do you see your career in 5 years?", horizon: "5-year" },
  { id: "career-1y", label: "Career (1 Year)", placeholder: "What career goals for the next year?", horizon: "1-year" },
  { id: "career-90d", label: "Career (90 Days)", placeholder: "What career actions in the next 90 days?", horizon: "90-day" },
  { id: "health-5y", label: "Health & Wellness (5 Year)", placeholder: "What does your ideal health look like in 5 years?", horizon: "5-year" },
  { id: "health-1y", label: "Health (1 Year)", placeholder: "Health goals for the next year?", horizon: "1-year" },
  { id: "health-90d", label: "Health (90 Days)", placeholder: "Health actions for the next 90 days?", horizon: "90-day" },
  { id: "finance-5y", label: "Financial Freedom (5 Year)", placeholder: "Define your financial independence goals in 5 years.", horizon: "5-year" },
  { id: "finance-1y", label: "Finance (1 Year)", placeholder: "Financial goals for the next year?", horizon: "1-year" },
  { id: "finance-90d", label: "Finance (90 Days)", placeholder: "Financial actions for the next 90 days?", horizon: "90-day" },
  { id: "relationships", label: "Relationships", placeholder: "What kind of relationships do you want to build?", horizon: "life" },
  { id: "growth", label: "Personal Growth", placeholder: "What skills or habits do you want to develop?", horizon: "life" },
  { id: "legacy", label: "Legacy & Contribution", placeholder: "What impact do you want to leave?", horizon: "life" },
];

const HORIZONS = [
  { id: "life", label: "Life Purpose", color: "bg-purple-100 dark:bg-purple-950 border-purple-300" },
  { id: "10-year", label: "10-Year Vision", color: "bg-blue-100 dark:bg-blue-950 border-blue-300" },
  { id: "5-year", label: "5-Year Goals", color: "bg-indigo-100 dark:bg-indigo-950 border-indigo-300" },
  { id: "1-year", label: "1-Year Objectives", color: "bg-emerald-100 dark:bg-emerald-950 border-emerald-300" },
  { id: "90-day", label: "90-Day Actions", color: "bg-amber-100 dark:bg-amber-950 border-amber-300" },
];

export default function AboutMeScreen() {
  const [visions, setVisions] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeHorizon, setActiveHorizon] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const v = await api.getVisions();
      const map: Record<string, any> = {};
      v.forEach((item: any) => { map[item.category] = item; });
      setVisions(map);
    } catch (err) { console.error(err); }
  }

  async function handleSave(categoryId: string) {
    setSaving(true);
    try {
      await api.upsertVision({ title: editTitle, vision_text: editText, category: categoryId });
      setEditing(null);
      await load();
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  function startEdit(categoryId: string) {
    const existing = visions[categoryId];
    setEditTitle(existing?.title ?? "");
    setEditText(existing?.vision_text ?? "");
    setEditing(categoryId);
  }

  async function handleGenerateProjects() {
    setGenerating(true);
    try {
      const visionEntries = Object.values(visions).filter((v: any) => v.vision_text?.trim());
      let created = 0;
      for (const v of visionEntries as any[]) {
        const text = `${v.title} ${v.vision_text}`.toLowerCase();
        // Extract potential project names from vision text
        const lines = text.split(/[.\n]/).filter((l: string) => l.trim().length > 10);
        for (const line of lines.slice(0, 2)) {
          const title = line.trim().slice(0, 60);
          if (title.length > 10) {
            await api.createProject({
              title: title.charAt(0).toUpperCase() + title.slice(1),
              description: `AI-generated from vision: ${v.category}`,
              color: ["#7C3AED", "#3B82F6", "#22C55E", "#EF4444", "#F59E0B"][created % 5],
            });
            created++;
          }
        }
      }
      alert(`✨ Created ${created} projects from your visions! Check the Projects page.`);
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  }

  const filteredCategories = activeHorizon === "all"
    ? VISION_CATEGORIES
    : VISION_CATEGORIES.filter((c) => c.horizon === activeHorizon || (activeHorizon === "life" && c.horizon === "life"));

  const hasContent = Object.keys(visions).length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">About Me — Life Vision</h1>
          <p className="text-muted-foreground text-sm">
            Define your vision across multiple time horizons
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateProjects}
            disabled={generating || !hasContent}
          >
            {generating ? "Generating..." : "✨ AI Generate Projects"}
          </Button>
        </div>
      </div>

      {/* Horizon filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveHorizon("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeHorizon === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          All
        </button>
        {HORIZONS.map((h) => (
          <button
            key={h.id}
            onClick={() => setActiveHorizon(h.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeHorizon === h.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      {!hasContent && !editing && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">No vision statements yet. Define what matters to you across different time horizons.</p>
            <p className="text-xs text-muted-foreground">Your visions sync across horizons — 90-day actions feed into 1-year objectives, which support 5-year goals and your life mission.</p>
            <Button onClick={() => startEdit(VISION_CATEGORIES[0].id)}>Start Writing</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredCategories.map((cat) => {
          const existing = visions[cat.id];
          const isEditing = editing === cat.id;
          const horizon = HORIZONS.find((h) => h.id === cat.horizon);

          return (
            <Card key={cat.id} className={`border-l-4 ${horizon?.color || ""}`}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {cat.label}
                    {horizon && (
                      <Badge variant="outline" className="text-[10px]">{horizon.label}</Badge>
                    )}
                  </CardTitle>
                </div>
                {!isEditing && (
                  <Button variant={existing ? "ghost" : "outline"} size="sm" onClick={() => startEdit(cat.id)}>
                    {existing ? "Edit" : "Add"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="A short title..." />
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} placeholder={cat.placeholder} className="min-h-[120px]" />
                    <div className="flex gap-2">
                      <Button onClick={() => handleSave(cat.id)} disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : existing ? (
                  <div>
                    {existing.title && <h4 className="font-medium text-sm mb-1">{existing.title}</h4>}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{existing.vision_text}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{cat.placeholder}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Horizon sync visualization */}
      {hasContent && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Vision Cascade</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Your visions cascade from life purpose → 10-year → 5-year → 1-year → 90-day actions.
              Each horizon feeds the next.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {HORIZONS.map((h, i) => (
                <React.Fragment key={h.id}>
                  <span className={`px-2 py-1 rounded ${h.color}`}>{h.label}</span>
                  {i < HORIZONS.length - 1 && <span className="text-muted-foreground/40">→</span>}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
