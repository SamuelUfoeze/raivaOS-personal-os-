import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  loadSettings,
  updateSettings,
  ThemeMode,
  ColorScheme,
  WebSearchMode,
  AppSettings,
  subscribeSettings,
} from "../lib/settings";
import { requestVaultAccess, registerVault, removeVault } from "../lib/vault";
import ModelSettings from "./ModelSettings";
import { exportSnapshot, importSnapshot } from "../lib/sync";

const COLOR_SCHEMES: { id: ColorScheme; label: string; color: string }[] = [
  { id: "purple", label: "Purple", color: "#7C3AED" },
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "green", label: "Green", color: "#16A34A" },
  { id: "emerald", label: "Emerald", color: "#10B981" },
  { id: "orange", label: "Orange", color: "#F97316" },
  { id: "rose", label: "Rose", color: "#E11D48" },
  { id: "zinc", label: "Zinc", color: "#18181B" },
];

const WEB_SEARCH_OPTIONS: { id: WebSearchMode; label: string; desc: string }[] = [
  { id: "always", label: "Always Allow", desc: "AI searches the web whenever needed" },
  { id: "ask", label: "Ask Me", desc: "Prompt before each web search" },
  { id: "never", label: "Never", desc: "Fully offline, no web access" },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());

  useEffect(() => {
    const unsub = subscribeSettings((s) => setSettings(s));
    return unsub;
  }, []);

  function handleUpdate(partial: Partial<AppSettings>) {
    updateSettings(partial);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
        <p className="text-muted-foreground mt-1">
          Customize your RAIVA OS experience
        </p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-4">
          {/* Light / Dark */}
          <div>
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-2 mt-1">
              {(["light", "dark"] as ThemeMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={settings.theme === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUpdate({ theme: mode })}
                  className="capitalize"
                >
                  {mode === "light" ? "☀️ Light" : "🌙 Dark"}
                </Button>
              ))}
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <label className="text-sm font-medium">Accent Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => handleUpdate({ colorScheme: scheme.id })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    settings.colorScheme === scheme.id
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: scheme.color }}
                  title={scheme.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current: {COLOR_SCHEMES.find((c) => c.id === settings.colorScheme)?.label}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Web Search */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">🌐 Web Search</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Control how the AI accesses the internet for current information.
            Web search is entirely optional — the AI works fully offline without it.
          </p>
          <div className="space-y-2">
            {WEB_SEARCH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.webSearch === opt.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
              >
                <input
                  type="radio"
                  name="webSearch"
                  value={opt.id}
                  checked={settings.webSearch === opt.id}
                  onChange={() => handleUpdate({ webSearch: opt.id })}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            <span>🔒</span>
            <span>Web search queries are sent anonymously. No personal data is included.</span>
          </div>
        </CardContent>
      </Card>

      {/* Vault */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">📁 Vault</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect an Obsidian or Logseq vault to browse and import notes from your existing knowledge base.
          </p>
          {settings.vaults.length > 0 ? (
            <div className="space-y-2">
              {settings.vaults.map((v) => (
                <div key={v.path} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <span className="text-sm font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 capitalize">
                      ({v.type})
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.lastIndexed ? `Last indexed: ${new Date(v.lastIndexed).toLocaleDateString()}` : "Not yet indexed"}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => { removeVault(v.path); handleUpdate({ vaults: loadSettings().vaults }); }}>
                    Disconnect
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={async () => {
                const result = await requestVaultAccess();
                if (result) {
                  const type = result.name.includes("logseq") ? "logseq" as const : "obsidian" as const;
                  registerVault({ name: result.name, path: result.path, type });
                  handleUpdate({ vaults: loadSettings().vaults });
                }
              }}>
                + Add another vault
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No vaults connected yet</p>
              <Button onClick={async () => {
                const result = await requestVaultAccess();
                if (result) {
                  const type = result.name.includes("logseq") ? "logseq" as const : "obsidian" as const;
                  registerVault({ name: result.name, path: result.path, type });
                  handleUpdate({ vaults: loadSettings().vaults });
                }
              }}>
                🔗 Connect Vault
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Display Name</label>
            <input
              type="text"
              value={settings.userName}
              onChange={(e) => handleUpdate({ userName: e.target.value })}
              placeholder="Your name"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={settings.userInfo}
              onChange={(e) => handleUpdate({ userInfo: e.target.value })}
              placeholder="A short bio or description..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1 resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This information is stored locally and used to personalize your AI interactions.
          </p>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sync</CardTitle>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sync.enabled}
              onChange={(e) =>
                handleUpdate({
                  sync: { ...settings.sync, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
          </label>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Export or import all your data as a portable snapshot. Syncing is local-first — your data never leaves your device unless you choose to export.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const json = exportSnapshot();
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `raiva-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                handleUpdate({
                  sync: {
                    ...settings.sync,
                    lastSyncedAt: new Date().toISOString(),
                  },
                });
              }}
            >
              Export Snapshot
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => document.getElementById("import-snapshot-input")?.click()}>
                Import Snapshot
              </Button>
              <input
                id="import-snapshot-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const result = importSnapshot(text);
                  if (result.ok) {
                    setSettings(loadSettings());
                    handleUpdate({
                      sync: {
                        ...loadSettings().sync,
                        lastSyncedAt: new Date().toISOString(),
                      },
                    });
                  }
                  alert(result.message);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {settings.sync.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Last synced: {new Date(settings.sync.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <ModelSettings />

      {/* About */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">RAIVA OS</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 text-xs text-muted-foreground space-y-1">
          <p>Version 2.0 — Fully offline personal AI operating system</p>
          <p>All data stored locally. No cloud required. No telemetry.</p>
          <p>Built with React + Tauri + llama.cpp</p>
        </CardContent>
      </Card>
    </div>
  );
}
