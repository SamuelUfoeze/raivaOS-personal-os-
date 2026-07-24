import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export default function KnowledgeGraphScreen() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semantic, setSemantic] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { buildKnowledgeGraph, getEmbedding } = await import("../lib/ai");
        const graph = await buildKnowledgeGraph();
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setSemantic(graph.edges.some((e) => e.label.includes("%")));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Building knowledge graph...
      </div>
    );
  }

  const tagNodes = nodes.filter((n) => n.type === "tag");
  const noteNodes = nodes.filter((n) => n.type === "note");
  const tagEdges = edges.filter((e) => e.label === "tagged");
  const semanticEdges = edges.filter((e) => e.label.includes("%"));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Graph</h1>
        <p className="text-muted-foreground text-sm">
          {noteNodes.length} notes · {tagNodes.length} tags · {tagEdges.length} tag links
          {semantic && ` · ${semanticEdges.length} semantic links`}
          {semantic && <Badge variant="success" className="ml-2 text-xs">AI-Powered</Badge>}
        </p>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No data yet. Create notes with content and the AI will build a semantic knowledge graph.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Graph visualization */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3 justify-center">
                {nodes.map((node) => {
                  const edgeCount = edges.filter(
                    (e) => e.source === node.id || e.target === node.id
                  ).length;
                  const size = Math.max(1, Math.min(3, edgeCount / 2));

                  return (
                    <div
                      key={node.id}
                      className="relative group"
                    >
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition-all hover:shadow-lg ${
                          node.type === "note"
                            ? "bg-primary/10 border-primary/30"
                            : "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
                        }`}
                        style={{
                          transform: `scale(${0.8 + size * 0.15})`,
                        }}
                      >
                        <span className={`w-2 h-2 rounded-full ${node.type === "note" ? "bg-primary" : "bg-amber-500"}`} />
                        <span className="text-xs font-medium">{node.label}</span>
                        <span className="text-[10px] text-muted-foreground">{edgeCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Tag connections */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Tag Connections ({tagEdges.length})</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {tagEdges.slice(0, 50).map((e, i) => {
                    const src = nodes.find((n) => n.id === e.source);
                    const tgt = nodes.find((n) => n.id === e.target);
                    return (
                      <div key={i} className="text-xs text-muted-foreground flex items-center gap-2 py-0.5">
                        <span className="font-medium text-foreground/80">{src?.label}</span>
                        <span className="text-muted-foreground/50">→</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{tgt?.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Semantic connections */}
            {semanticEdges.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold">Semantic Links (AI)</h3>
                    <Badge variant="success" className="text-xs">AI</Badge>
                  </div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {semanticEdges.sort((a, b) => b.strength - a.strength).slice(0, 30).map((e, i) => {
                      const src = nodes.find((n) => n.id === e.source);
                      const tgt = nodes.find((n) => n.id === e.target);
                      return (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2 py-0.5">
                          <span className="font-medium text-foreground/80">{src?.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              e.strength > 0.7
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }`}
                          >
                            {Math.round(e.strength * 100)}%
                          </span>
                          <span className="font-medium text-foreground/80">{tgt?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Legend */}
          <Card>
            <CardContent className="p-4 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" /> Note
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Tag
              </span>
              {semantic && (
                <span className="flex items-center gap-1">
                  <Badge variant="success" className="text-[10px]">AI</Badge> Semantic similarity
                </span>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
