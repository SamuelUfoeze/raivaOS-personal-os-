import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { knowledgeTree, TreeNode, TreeEdge, getStarterMentors, getInfluences } from "../lib/knowledgeTree";
import { library, LibraryPack } from "../lib/library";

const FIELDS = ["copywriting", "product", "strategy", "writing", "design", "leadership"];

function KnowledgeTreeSection() {
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
        const mentor = nodes.find((nd) => nd.personName === personName);
        if (mentor) {
          knowledgeTree.addEdge(mentor.id, n.id, "mentored_by", i.confidence, "ai_inferred");
        }
      } else {
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
    <div className="space-y-4">
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

      {/* Starter Mentors */}
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
              <p className="text-sm text-muted-foreground">No starter mentors for this field yet. Type a name to add your own.</p>
            )}
            <div className="mt-4">
              <ManualAddMentor onAdd={(name) => handleAddMentor(name, selectedField)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tree View */}
      {level1.length > 0 && (
        <div className="space-y-4">
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

          {expandedMentor && influences.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-muted">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">WHO INFLUENCED {expandedMentor.toUpperCase()}</h3>
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
                            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => handleExploreMentor(inf.name)}>Explore</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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

          {!expandedMentor && level2.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-muted">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">AUTO-DISCOVERED INFLUENCES</h3>
              <p className="text-xs text-muted-foreground mb-2">These influences were automatically discovered by analyzing who influenced your mentors.</p>
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
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleExploreMentor(n.personName)}>Explore</Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Card className="bg-muted/30">
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
      <Button variant="outline" size="sm" disabled={!name.trim()} onClick={() => { onAdd(name.trim()); setName(""); }}>Add</Button>
    </div>
  );
}

function LibrarySection() {
  const [installed, setInstalled] = useState<LibraryPack[]>([]);
  const [starterPacks, setStarterPacks] = useState<any[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  function load() {
    setInstalled(library.getInstalledPacks());
    setStarterPacks(library.getStarterPacks());
  }

  useEffect(() => { load(); }, []);

  async function handleInstall(packId: string) {
    setInstalling(packId);
    try {
      await library.installStarterPack(packId);
      load();
    } catch (err) {
      console.error(err);
    }
    setInstalling(null);
  }

  async function handleRemove(packId: string) {
    library.removePack(packId);
    load();
  }

  return (
    <div className="space-y-4">
      {installed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Installed Packs ({installed.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {installed.map((pack) => (
              <Card key={pack.id} className="border-l-4 border-l-emerald-500">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{pack.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">by {pack.author}</p>
                    </div>
                    <Badge variant="success" className="text-xs">Installed</Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{pack.chunkCount} references</span>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleRemove(pack.id)}>Remove</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {installed.length > 0 ? "Available Packs" : "Get Started with a Pack"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Each pack contains key ideas from influential thinkers. Install one and your AI immediately references it.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {starterPacks.map((pack) => {
            const isInstalled = installed.some((i) => i.id === pack.id);
            return (
              <Card key={pack.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setShowDetail(showDetail === pack.id ? null : pack.id)}>
                    <div>
                      <CardTitle className="text-sm hover:text-primary transition-colors">
                        {pack.title} {showDetail === pack.id ? "▲" : "▼"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">by {pack.author}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {pack.topics.slice(0, 2).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                {showDetail === pack.id && (
                  <CardContent className="py-2 px-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground"><strong>Topics:</strong> {pack.topics.join(", ")}</p>
                      <p className="text-xs text-muted-foreground"><strong>References:</strong> {pack.chunkCount} key concepts</p>
                      <div className="text-xs text-muted-foreground">
                        <strong>Includes ideas from:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {pack.chunks.slice(0, 5).map((c: any) => (
                            <li key={c.id}>{c.metadata?.book || c.metadata?.author || "Unknown source"}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                )}
                <CardContent className="py-2 px-4 border-t">
                  {isInstalled ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">✅ Installed</span>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleRemove(pack.id)}>Remove</Button>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full text-xs" onClick={() => handleInstall(pack.id)} disabled={installing === pack.id}>
                      {installing === pack.id ? "Installing..." : `Install Pack (${pack.chunkCount} refs)`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">🤔 How Library Packs Work</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 text-sm text-muted-foreground space-y-1">
          <p>• Each pack contains pre-chunked, pre-embedded content from top thinkers.</p>
          <p>• When you ask the AI a question, it searches installed packs for relevant references.</p>
          <p>• The AI synthesizes the references with your personal data for rich, contextual answers.</p>
          <p>• Packs work entirely offline — no cloud, no API calls, no data leaving your device.</p>
          <p className="mt-2 text-xs italic">Want more packs? Future updates will include a marketplace where experts publish packs for their field.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KnowledgeAndLibrary() {
  const [tab, setTab] = useState<"knowledge-tree" | "library">("knowledge-tree");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{tab === "knowledge-tree" ? "🌳 Knowledge Tree" : "📚 Library"}</h1>
        <p className="text-muted-foreground mt-1">
          {tab === "knowledge-tree"
            ? "Build your intellectual lineage. Pick the mentors who shape your thinking, and discover who shaped them."
            : "Install knowledge packs to supercharge your AI's expertise."}
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setTab("knowledge-tree")}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${tab === "knowledge-tree" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          🌳 Knowledge Tree
        </button>
        <button
          onClick={() => setTab("library")}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${tab === "library" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          📚 Library
        </button>
      </div>

      {tab === "knowledge-tree" ? <KnowledgeTreeSection /> : <LibrarySection />}
    </div>
  );
}
