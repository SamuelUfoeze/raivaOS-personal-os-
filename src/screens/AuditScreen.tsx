import React, { useEffect, useState } from "react";
import { api } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { formatDate } from "../lib/utils";

export default function AuditScreen() {
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const a = await api.getLatestAudit();
      setAudit(a);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRunAudit() {
    setRunning(true);
    setThinking([]);
    const log = (...args: any[]) => setThinking((prev) => [...prev, args.join(" ")]);
    try {
      log("🔍 Step 1: Loading all data...");
      const [projects, visions, goals, tasks] = await Promise.all([
        api.getProjects(),
        api.getVisions(),
        api.getGoals(),
        api.getTasks(),
      ]);

      const hasVisions = visions.length > 0;
      log(`📊 Loaded ${projects.length} projects, ${visions.length} visions, ${goals.length} goals, ${tasks.length} tasks`);

      // Step 2: Compute vision embedding for semantic comparison
      log("🧠 Step 2: Computing semantic embeddings...");
      const { getEmbedding, cosineSimilarity } = await import("../lib/ai");
      const visionText = visions.map((v: any) => `${v.title} ${v.vision_text}`).join("\n");
      const visionEmbedding = hasVisions ? await getEmbedding(visionText) : null;
      log(`   Vision embedding computed${visionEmbedding ? ` (${visionEmbedding.length} dimensions)` : " — no visions set"}`);

      // Step 3: Evaluate each project
      log("📋 Step 3: Scoring each project...");

      const details = [];
      for (const p of projects) {
        const projText = `${p.project.title} ${p.project.description || ""}`;
        const projEmbedding = await getEmbedding(projText);

        // Semantic alignment score (cosine similarity × 50 max)
        const semanticScore = visionEmbedding && projEmbedding
          ? cosineSimilarity(visionEmbedding, projEmbedding) * 50
          : 0;

        // Keyword overlap as a fallback / supplement
        const pWords = new Set(projText.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
        const vWords = new Set(visionText.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !["this", "that", "with", "from", "have", "will", "what", "when", "where", "which"].includes(w)));
        let overlap = 0;
        for (const w of pWords) { if (vWords.has(w)) overlap++; }
        const keywordScore = vWords.size > 0 ? (overlap / vWords.size) * 50 : 0;

        // Use semantic score primarily, keyword as fallback
        const alignmentScore = hasVisions
          ? Math.min(semanticScore + keywordScore * 0.3, 50)
          : 0;

        // Progress score (max 30)
        const pGoals = goals.filter((g: any) => g.project_id === p.id);
        const totalTasksP = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id).length, 0);
        const doneTasksP = pGoals.reduce((s: number, g: any) => s + tasks.filter((t: any) => t.goal_id === g.id && t.status === "done").length, 0);
        const progressScore = totalTasksP > 0 ? (doneTasksP / totalTasksP) * 30 : 0;

        // Activity score (max 20) — tasks updated in last 14 days
        const cutoff14 = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const recentTasksP = pGoals.reduce((s: number, g: any) => {
          return s + tasks.filter((t: any) => t.goal_id === g.id && new Date(t.created_at).getTime() > cutoff14).length;
        }, 0);
        const activityScore = Math.min((recentTasksP / Math.max(totalTasksP, 1)) * 20, 20);

        const total = Math.round((alignmentScore + progressScore + activityScore) * 10) / 10;

        const classification = total >= 60 ? "Essential Component"
          : total >= 35 ? "Supporting Activity"
          : total >= 15 ? "Low Priority"
          : "Distraction";

        details.push({
          project_title: p.project.title,
          alignment_score: total,
          classification,
          tasks_done: doneTasksP,
          tasks_total: totalTasksP,
          alignment_detail: hasVisions ? `${Math.round(alignmentScore)}% semantic alignment` : "No visions defined",
        });

        log(`   • ${p.project.title}: ${total}% (alignment: ${Math.round(alignmentScore)}, progress: ${Math.round(progressScore)}, activity: ${Math.round(activityScore)}) → ${classification}`);
      }

      details.sort((a: any, b: any) => b.alignment_score - a.alignment_score);
      const avg = details.length ? details.reduce((s: number, d: any) => s + d.alignment_score, 0) / details.length : 0;

      const essentialCount = details.filter((d: any) => d.classification === "Essential Component").length;
      const distractionCount = details.filter((d: any) => d.classification === "Distraction").length;

      log("✅ Step 4: Generating summary...");

      let summary = "";
      if (!hasVisions) {
        summary = `⚠️ No life visions defined yet. Head to **About Me** to write your vision — the audit will compare projects against it.\n\n`;
        summary += `Current evaluation (based on progress & activity only):\n`;
        summary += `Average alignment: **${Math.round(avg)}%**`;
      } else if (avg >= 65) {
        summary = `✅ **Strong alignment (${Math.round(avg)}%)**. ${essentialCount} of ${details.length} projects are essential. Keep up the focused work!`;
        if (distractionCount > 0) summary += `\n⚠️ ${distractionCount} project(s) flagged as distractions — consider if they align with your long-term goals.`;
      } else if (avg >= 40) {
        summary = `🔄 **Moderate alignment (${Math.round(avg)}%)**. ${essentialCount} essential, but ${distractionCount} may need realignment. Review priorities.`;
      } else {
        summary = `⚠️ **Low alignment (${Math.round(avg)}%)**. Most projects don't clearly align with your vision. Consider re-evaluating your portfolio.`;
      }

      const toContinue = details.filter((d: any) => d.classification === "Essential Component").slice(0, 2);
      const toReconsider = details.filter((d: any) => d.classification === "Distraction" || d.classification === "Low Priority");
      let insight = "";
      if (toContinue.length > 0) insight += `\n✅ **Keep going:** ${toContinue.map((d: any) => d.project_title).join(", ")}`;
      if (toReconsider.length > 0) insight += `\n🔄 **Review:** ${toReconsider.slice(0, 3).map((d: any) => d.project_title).join(", ")}`;

      const result = {
        id: crypto.randomUUID(),
        audit_date: new Date().toISOString(),
        period_label: new Date().toISOString().slice(0, 7),
        summary: summary + (insight ? "\n" + insight : ""),
        alignment_score: Math.round(avg * 10) / 10,
        details,
        created_at: new Date().toISOString(),
      };

      setAudit(result);
      setLastRun(new Date().toISOString());
      log("✅ Audit complete!");
    } catch (err) {
      console.error(err);
      setThinking((prev) => [...prev, `❌ Error: ${err}`]);
    }
    setRunning(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  const essentialCount = audit?.details?.filter((d: any) => d.classification === "Essential Component").length ?? 0;
  const distractionCount = audit?.details?.filter((d: any) => d.classification === "Distraction").length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Life Audit</h1>
          <p className="text-muted-foreground text-sm">
            Deep evaluation: projects vs. life vision
            {audit && ` · Last run ${formatDate(audit.audit_date)}`}
          </p>
        </div>
        <Button onClick={handleRunAudit} disabled={running}>
          {running ? "Analyzing..." : "Run Deep Audit"}
        </Button>
      </div>

      {/* Thinking trace */}
      {thinking.length > 0 && (
        <Card className="bg-muted/40">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Audit reasoning trace:</p>
            <pre className="text-xs text-muted-foreground/80 font-mono whitespace-pre-wrap leading-relaxed">
              {thinking.map((line, i) => (
                <React.Fragment key={i}>{line}{"\n"}</React.Fragment>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}

      {!audit ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground space-y-4">
            <p>No audit results yet. Run a deep audit that evaluates each project against your life vision using semantic embedding analysis.</p>
            <p className="text-xs">The audit analyzes semantic alignment (cosine similarity between project and vision embeddings), task progress, and recent activity to score each project.</p>
            <Button onClick={handleRunAudit} disabled={running}>
              {running ? "Running..." : "Run First Audit"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alignment Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="text-5xl font-bold" style={{ color: audit.alignment_score >= 65 ? "#22c55e" : audit.alignment_score >= 40 ? "#f59e0b" : "#ef4444" }}>
                  {Math.round(audit.alignment_score)}%
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-lg">
                    {audit.alignment_score >= 65 ? "✅ Strong Alignment" : audit.alignment_score >= 40 ? "🔄 Moderate" : "⚠️ Needs Realignment"}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{audit.summary}</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <Badge variant="success" className="text-xs">{essentialCount} Essential</Badge>
                <Badge variant="default" className="text-xs">{audit.details.filter((d: any) => d.classification === "Supporting Activity").length} Supporting</Badge>
                <Badge variant="warning" className="text-xs">{audit.details.filter((d: any) => d.classification === "Low Priority").length} Low Priority</Badge>
                <Badge variant="destructive" className="text-xs">{distractionCount} Distractions</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Project breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {audit.details.map((d: any, i: number) => (
                <div key={i} className="p-4 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          d.classification === "Essential Component" ? "bg-emerald-500" :
                          d.classification === "Supporting Activity" ? "bg-blue-500" :
                          d.classification === "Low Priority" ? "bg-amber-400" :
                          "bg-red-400"
                        }`}
                      />
                      <span className="font-semibold">{d.project_title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{d.alignment_score}%</span>
                      <Badge
                        variant={
                          d.classification === "Essential Component" ? "success" :
                          d.classification === "Supporting Activity" ? "default" :
                          d.classification === "Low Priority" ? "warning" : "destructive"
                        }
                        className="text-xs"
                      >
                        {d.classification}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        d.classification === "Essential Component" ? "bg-emerald-500" :
                        d.classification === "Supporting Activity" ? "bg-blue-500" :
                        d.classification === "Low Priority" ? "bg-amber-400" :
                        "bg-red-400"
                      }`}
                      style={{ width: `${d.alignment_score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
