import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { knowledgeTree, TreeNode, TreeEdge, getStarterMentors, getInfluences } from "../lib/knowledgeTree";

const FIELDS = ["copywriting", "product", "strategy", "writing", "design", "leadership"];

export default function KnowledgeTreeScreen() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [edges, setEdges] = useState<TreeEdge[]>([]);
  const [selectedField, setSelectedField] = useState("copywriting");
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [influences, setInfluences] = useState<{ name: string; relation: string; confidence: number }[]>([]);

  function load() {
    setNodes(knowledgeTree.getNodes());
    setEdges(knowledgeTree.getEdges());
  }

  useEffect(() => { load(); }, []);

  function handleAddMentor(personName: string, field: string) {
    const existing = nodes.find((n) => n.personName === personName && n.field === field);
    if (existing) return;
    knowledgeTree.addNode({
      personName, field, level: 1,
      bio: `Mentor in ${field}`,
      keyWorks: [],
      sourceType: "user_picked",
    });
    load();
  }

  function handleRemoveMentor(id: string) {
    knowledgeTree.removeNode(id);
    load();
  }

  function handleExploreMentor(personName: string) {
    if (expandedMentor === personName) {
      setExpandedMentor(null);
      setInfluences([]);
      return;
    }
    setExpandedMentor(personName);
    const inf = getInfluences(personName);
    setInfluences(inf);

    // Auto-add influences as level 2 nodes if not already present
    for (const i of inf) {
      const field = nodes.find((n) => n.personName === personName)?.field || selectedField;
      const existing = nodes.find((n) => n.personName === i.name && n.field === field);
      if (!existing) {
        const n = knowledgeTree.addNode({
          personName: i.name, field, level: 2,
          bio: `${i.relation} — ${i.confidence >= 0.8 ? "Well-documented influence" : "Likely influence"}`,
          keyWorks: [],
          sourceType: "ai_suggested",
        });
        // Add edge from mentor to influence
        const mentor = nodes.find((nd) => nd.personName === personName);
        if (mentor) {
          knowledgeTree.addEdge(mentor.id, n.id, "mentored_by", i.confidence, i.confidence >= 0.8 ? "ai_inferred" : "ai_inferred");
        }
      } else {
        // Add edge if missing
        const mentor = nodes.find((nd) => nd.personName === personName);
        if (mentor && !edges.some((e) => e.fromId === mentor.id && e.toId === existing.id)) {
          knowledgeTree.addEdge(mentor.id, existing.id, "mentored_by", i.confidence, "ai_inferred");
        }
      }
    }
    load();
  }

  const fieldNodes = nodes.filter((n) => n.field === selectedField);
  const level1 = fieldNodes.filter((n) => n.level === 1);
  const level2 = fieldNodes.filter((n) => n.level === 2);
  const ancestors = expandedMentor
    ? (() => {
        const mentor = nodes.find((n) => n.personName === expandedMentor);
        if (!mentor) return [];
        return knowledgeTree.getAncestors(mentor.id);
      })()
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🌳 Knowledge Tree</h1>
        <p className="text-muted-foreground mt-1">
          Build your intellectual lineage. Pick the mentors who shape your thinking,
          and discover who shaped them — tracing ideas back to their roots.
        </p>
      </div>

      {/* Field Selector */}
      <div className="flex gap-2 flex-wrap">
        {FIELDS.map((f) => (
          <Button
            key={f}
            variant={selectedField === f ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectedField(f); setExpandedMentor(null); }}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Starter Mentors (shown when tree is empty for this field) */}
      {level1.length === 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Choose Your Mentors in {selectedField}</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <p className="text-sm text-muted-foreground mb-3">
              Pick 1-3 mentors who represent the thinking you want to embody.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {getStarterMentors().filter((m) => m.field === selectedField).map((mentor) => (
                <Card key={mentor.personName} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleAddMentor(mentor.personName, selectedField)}>
                  <CardContent className="py-3 px-4">
                    <h3 className="font-semibold text-sm">{mentor.personName}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{mentor.bio.slice(0, 100)}</p>
                    <p className="text-xs text-muted-foreground mt-1 italic">{mentor.keyWorks.map((w) => w.title).join(", ")}</p>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs w-full">Add Mentor</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {getStarterMentors().filter((m) => m.field === selectedField).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No starter mentors for this field yet. Type a name to add your own.
              </p>
            )}
            {/* Manual add */}
            <div className="mt-4">
              <ManualAddMentor onAdd={(name) => handleAddMentor(name, selectedField)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tree View */}
      {level1.length > 0 && (
        <div className="space-y-4">
          {/* Level 1: Your Mentors */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">YOUR MENTORS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {level1.map((mentor) => (
                <Card key={mentor.id} className={`border-l-4 ${expandedMentor === mentor.personName ? "border-l-primary" : "border-l-amber-500"}`}>
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">{mentor.personName}</CardTitle>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs h-6 w-6 p-0" onClick={() => handleRemoveMentor(mentor.id)}>✕</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <p className="text-xs text-muted-foreground">{mentor.bio}</p>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">Level {mentor.level}</Badge>
                      <Badge variant="outline" className="text-xs">{selectedField}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs w-full" onClick={() => handleExploreMentor(mentor.personName)}>
                      {expandedMentor === mentor.personName ? "▲ Hide Influences" : "▼ Explore Influences"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-2">
              <ManualAddMentor onAdd={(name) => handleAddMentor(name, selectedField)} label="Add another mentor" />
            </div>
          </div>

          {/* Influences for expanded mentor */}
          {expandedMentor && influences.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-muted">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                WHO INFLUENCED {expandedMentor.toUpperCase()}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {influences.map((inf, idx) => {
                  const existingNode = fieldNodes.find((n) => n.personName === inf.name);
                  return (
                    <Card key={idx} className={existingNode ? "border-l-2 border-l-emerald-500" : "border-dashed"}>
                      <CardContent className="py-2 px-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-medium">{inf.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{inf.relation}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant={inf.confidence > 0.8 ? "success" : "outline"} className="text-xs">
                                {Math.round(inf.confidence * 100)}% confidence
                              </Badge>
                            </div>
                          </div>
                          {existingNode ? (
                            <Badge variant="success" className="text-xs shrink-0">In tree</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => {
                              handleExploreMentor(inf.name);
                            }}>
                              Explore
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Deeper lineage */}
              {ancestors.length > 0 && (
                <div className="mt-4 ml-6 pl-4 border-l-2 border-muted">
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">DEEPER LINEAGE</h3>
                  <div className="space-y-2">
                    {ancestors.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">←</span>
                        <span>{a.personName}</span>
                        <Badge variant="outline" className="text-xs">Level {a.level}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Level 2 nodes (auto-discovered) */}
          {!expandedMentor && level2.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-muted">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">AUTO-DISCOVERED INFLUENCES</h3>
              <p className="text-xs text-muted-foreground mb-2">
                These influences were automatically discovered by analyzing who influenced your mentors.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {level2.map((n) => {
                  const mentor = edges.find((e) => e.toId === n.id);
                  const mentorNode = nodes.find((nd) => nd.id === mentor?.fromId);
                  return (
                    <Card key={n.id} className="bg-muted/20">
                      <CardContent className="py-2 px-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm">{n.personName}</span>
                          {mentorNode && <span className="text-xs text-muted-foreground ml-1">← {mentorNode.personName}</span>}
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleExploreMentor(n.personName)}>
                          Explore
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <Card className="bg-muted/30 mt-8">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">🤔 How the Knowledge Tree Works</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 text-sm text-muted-foreground space-y-1">
          <p>• <strong>Level 1</strong>: Your chosen mentors — the people whose thinking you want to embody.</p>
          <p>• <strong>Level 2+</strong>: Auto-discovered influences — who influenced your mentors, traced back.</p>
          <p>• When you ask the AI a question in a domain, it checks your tree and frames answers through your chosen lineage.</p>
          <p>• The deeper the tree, the richer the context the AI can draw from.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ManualAddMentor({ onAdd, label }: { onAdd: (name: string) => void; label?: string }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder={label || "Enter mentor name..."}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim());
            setName("");
          }
        }}
        className="text-sm rounded border border-input bg-background px-2 py-1.5 flex-1"
      />
      <Button variant="outline" size="sm" disabled={!name.trim()} onClick={() => { onAdd(name.trim()); setName(""); }}>
        Add
      </Button>
    </div>
  );
}
