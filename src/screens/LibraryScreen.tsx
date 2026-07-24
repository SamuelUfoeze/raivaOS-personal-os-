import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { library, LibraryPack } from "../lib/library";

export default function LibraryScreen() {
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📚 Library</h1>
        <p className="text-muted-foreground mt-1">
          Install knowledge packs to supercharge your AI's expertise.
          Each pack adds curated wisdom from top thinkers in its field.
        </p>
      </div>

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
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleRemove(pack.id)}>
                    Remove
                  </Button>
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
                      <p className="text-xs text-muted-foreground">
                        <strong>Topics:</strong> {pack.topics.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>References:</strong> {pack.chunkCount} key concepts
                      </p>
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
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleRemove(pack.id)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleInstall(pack.id)}
                      disabled={installing === pack.id}
                    >
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
          <p className="mt-2 text-xs italic">
            Want more packs? Future updates will include a marketplace where experts publish packs for their field.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
