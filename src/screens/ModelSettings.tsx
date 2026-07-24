import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { api } from "../lib/db";
import {
  loadSettings,
  updateSettings,
  AppSettings,
  ModelTier,
} from "../lib/settings";

interface ModelInfo {
  id: string;
  name: string;
  tier: string;
  size: string;
  filename: string;
  download_url: string;
}

interface ModelStatus {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  path: string | null;
}

interface LlamaStatus {
  running: boolean;
  port: number | null;
  model: string | null;
}

const MODEL_TIERS: { id: ModelTier; label: string; desc: string; ram: string }[] = [
  { id: "micro", label: "Micro", desc: "Lightweight, runs on 4GB devices", ram: "~1GB" },
  { id: "standard", label: "Standard", desc: "Balanced, recommended for 8GB+", ram: "~4GB" },
  { id: "pro", label: "Pro", desc: "Maximum capability, 16GB+ recommended", ram: "~10GB" },
];

export default function ModelSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});
  const [server, setServer] = useState<LlamaStatus>({ running: false, port: null, model: null });
  const [loading, setLoading] = useState(true);
  const [port, setPort] = useState(settings.llamaServer.port);
  const [ngl, setNgl] = useState(settings.llamaServer.ngl);

  const refreshStatuses = useCallback(async (modelList: ModelInfo[]) => {
    const entries = await Promise.all(
      modelList.map(async (m) => {
        try {
          const s = await api.getModelStatus(m.id);
          return [m.id, s as ModelStatus] as const;
        } catch {
          return [m.id, { downloaded: false, downloading: false, progress: 0, path: null } as ModelStatus] as const;
        }
      })
    );
    setStatuses(Object.fromEntries(entries));
  }, []);

  const refreshServer = useCallback(async () => {
    try {
      const s = await api.getLlamaStatus();
      setServer(s as LlamaStatus);
    } catch {
      setServer({ running: false, port: null, model: null });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getAvailableModels();
        const modelList = list as ModelInfo[];
        setModels(modelList);
        await refreshStatuses(modelList);
      } catch {
        setModels([]);
      }
      await refreshServer();
      setLoading(false);
    })();
  }, [refreshStatuses, refreshServer]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u1 = await listen<{ model_id: string; progress: number }>("download-progress", (e) => {
          setStatuses((prev) => ({
            ...prev,
            [e.payload.model_id]: {
              ...prev[e.payload.model_id],
              downloading: true,
              progress: e.payload.progress,
            },
          }));
        });
        const u2 = await listen<{ model_id: string; path: string }>("download-complete", (e) => {
          setStatuses((prev) => ({
            ...prev,
            [e.payload.model_id]: {
              downloaded: true,
              downloading: false,
              progress: 100,
              path: e.payload.path,
            },
          }));
          updateSettings({
            modelRegistry: [
              ...loadSettings().modelRegistry.filter((r) => r.id !== e.payload.model_id),
              { id: e.payload.model_id, filename: models.find((m) => m.id === e.payload.model_id)?.filename ?? "", downloaded: true, path: e.payload.path, downloadedAt: new Date().toISOString() },
            ],
          });
        });
        unsubs = [u1, u2];
      } catch {}
    })();
    return () => unsubs.forEach((u) => u());
  }, [models]);

  async function handleDownload(modelId: string) {
    try {
      setStatuses((prev) => ({ ...prev, [modelId]: { ...prev[modelId], downloading: true, progress: 0 } }));
      await api.downloadModel(modelId);
      await refreshStatuses(models);
    } catch (err: any) {
      setStatuses((prev) => ({ ...prev, [modelId]: { ...prev[modelId], downloading: false, progress: 0 } }));
    }
  }

  async function handleCancel(modelId: string) {
    try {
      await api.cancelDownload(modelId);
      setStatuses((prev) => ({ ...prev, [modelId]: { downloaded: false, downloading: false, progress: 0, path: null } }));
    } catch {}
  }

  async function handleStart(model: ModelInfo) {
    try {
      const msg = await api.startLlamaServer(statuses[model.id].path!, port, ngl);
      updateSettings({ llamaServer: { ...loadSettings().llamaServer, port, ngl, lastModel: model.id } });
      await refreshServer();
    } catch (err: any) {
      alert(err);
    }
  }

  async function handleStop() {
    try {
      await api.stopLlamaServer();
      await refreshServer();
    } catch {}
  }

  function handleTierChange(tier: ModelTier) {
    const updated = updateSettings({ modelTier: tier });
    setSettings(updated);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">AI Capability Tier</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Select the AI capability tier. Higher tiers require more RAM but provide
            deeper reasoning.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {MODEL_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className={`cursor-pointer transition-all ${
                  settings.modelTier === tier.id
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-muted-foreground/30"
                }`}
                onClick={() => handleTierChange(tier.id)}
              >
                <CardContent className="py-3 px-3 text-center">
                  <p className="font-semibold text-sm">{tier.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tier.desc}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {tier.ram} RAM
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Model Downloads</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading models...</p>
          ) : models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models available. Run in Tauri to access the model catalog.</p>
          ) : (
            models.map((model) => {
              const st = statuses[model.id];
              return (
                <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{model.size}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {st?.downloaded
                        ? "Downloaded"
                        : st?.downloading
                          ? `Downloading... ${st.progress.toFixed(1)}%`
                          : `${model.tier} tier · GGUF Q4_K_M`}
                    </p>
                    {st?.downloading && (
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.max(st.progress, 2)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {st?.downloaded ? (
                      <>
                        <Badge variant="default" className="text-xs bg-green-600">Ready</Badge>
                        {server.running && server.model?.includes(model.filename) ? (
                          <Button variant="destructive" size="sm" onClick={handleStop}>Stop</Button>
                        ) : (
                          <Button variant="default" size="sm" onClick={() => handleStart(model)}>Start</Button>
                        )}
                      </>
                    ) : st?.downloading ? (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(model.id)}>Cancel</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleDownload(model.id)}>Download</Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Server Configuration</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Port:</label>
              <Input
                type="number"
                className="w-20 h-8 text-sm"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={server.running}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">NGL Layers:</label>
              <Input
                type="number"
                className="w-20 h-8 text-sm"
                value={ngl}
                onChange={(e) => setNgl(Number(e.target.value))}
                disabled={server.running}
                min={0}
                max={100}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {server.running ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span className="text-xs text-green-600">Running on port {server.port}</span>
                  <Button variant="destructive" size="sm" onClick={handleStop}>Stop Server</Button>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                  <span className="text-xs text-muted-foreground">Stopped</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
