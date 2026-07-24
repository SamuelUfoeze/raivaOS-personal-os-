import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/db";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { timeAgo, truncate, stripHtml } from "../lib/utils";
import { importFiles } from "../lib/importer";
import {
  requestVaultAccess,
  getVaultTree,
  importVaultNote,
  registerVault,
  removeVault,
  getActiveVault,
  VaultEntry,
} from "../lib/vault";
import { loadSettings } from "../lib/settings";

interface NotesListProps {
  onNavigate: (screen: string) => void;
  onOpenNote: (id: string) => void;
}

export default function NotesList({ onNavigate, onOpenNote }: NotesListProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultExpanded, setVaultExpanded] = useState<Set<string>>(new Set());
  const [vaultImporting, setVaultImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (importResult) {
      const timer = setTimeout(() => setImportResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [importResult]);

  async function handleFileImport(files: FileList | File[]) {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importFiles(Array.from(files));
      const msg = `✅ Imported ${result.imported} note${result.imported !== 1 ? "s" : ""}` +
        (result.errors.length > 0 ? ` (${result.errors.length} errors)` : "");
      setImportResult(msg);
      load();
    } catch (err: any) {
      setImportResult(`❌ Import failed: ${err.message}`);
    }
    setImporting(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileImport(e.dataTransfer.files);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteNote(id);
    load();
  }

  async function handleToggleFavorite(id: string, fav: boolean) {
    await api.toggleFavorite(id, !fav);
    load();
  }

  async function handleConnectVault() {
    const result = await requestVaultAccess();
    if (!result) return;
    registerVault({
      name: result.name,
      path: result.path,
      type: "obsidian",
    });
    await loadVault();
  }

  async function loadVault() {
    const vault = getActiveVault();
    if (!vault) return;
    setVaultLoading(true);
    try {
      const entries = await getVaultTree();
      setVaultEntries(entries);
    } catch {
      // browser may have lost permission
    }
    setVaultLoading(false);
  }

  async function handleVaultImport(path: string) {
    setVaultImporting(path);
    const ok = await importVaultNote(path);
    const name = path.split("/").pop() || "note";
    setImportResult(ok ? `✅ Imported "${name}" from vault` : `❌ Failed to import "${name}"`);
    if (ok) load();
    setVaultImporting(null);
  }

  function toggleVaultEntry(path: string) {
    const next = new Set(vaultExpanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setVaultExpanded(next);
  }

  useEffect(() => {
    const vault = getActiveVault();
    if (vault) loadVault();
  }, []);

  const filtered = notes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags?.some((t: any) => (typeof t === "string" ? t : t.name).toLowerCase().includes(q))
    );
  });

  const favorites = filtered.filter((n) => n.is_favorite);
  const rest = filtered.filter((n) => !n.is_favorite);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-muted-foreground text-sm">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.markdown"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFileImport(e.target.files)}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importing..." : "📥 Import"}
          </Button>
          <Button onClick={() => onNavigate("note-editor")}>New Note</Button>
        </div>
      </div>

      {importResult && (
        <div className="text-sm bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
          {importResult}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
      >
        <p className="text-sm text-muted-foreground">
          {dragOver ? "📥 Drop files here" : "📤 Drop markdown files to import (Obsidian, Logseq, Standard MD)"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports .md, .txt, .markdown — YAML frontmatter, wikilinks, tags, Logseq outlines
        </p>
      </div>

      {/* Vault section */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          <div>
            <h3 className="font-semibold text-sm">📁 Vault</h3>
            <p className="text-xs text-muted-foreground">
              {getActiveVault()
                ? `Connected: ${getActiveVault()!.name}`
                : "Connect your Obsidian or Logseq vault"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={getActiveVault() ? loadVault : handleConnectVault}
            disabled={vaultLoading}
          >
            {vaultLoading ? "Loading..." : getActiveVault() ? "📂 Browse" : "🔗 Connect"}
          </Button>
        </div>
        {vaultEntries.length > 0 && (
          <div className="px-4 py-2 max-h-64 overflow-y-auto border-t border-border">
            <VaultTree
              entries={vaultEntries}
              expanded={vaultExpanded}
              onToggle={toggleVaultEntry}
              onImport={handleVaultImport}
              importing={vaultImporting}
              depth={0}
            />
          </div>
        )}
        {getActiveVault() && vaultEntries.length === 0 && !vaultLoading && (
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
            No markdown files found. Click Browse to refresh or select a different vault.
          </div>
        )}
      </div>

      <Input
        placeholder="Search notes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {favorites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Favorites
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {favorites.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onOpen={onOpenNote}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        {rest.length === 0 && favorites.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {search ? "No notes match your search." : "No notes yet. Create one!"}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {rest.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={onOpenNote}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VaultTree({
  entries,
  expanded,
  onToggle,
  onImport,
  importing,
  depth,
}: {
  entries: VaultEntry[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onImport: (path: string) => void;
  importing: string | null;
  depth: number;
}) {
  return (
    <ul className={`space-y-0.5 ${depth > 0 ? "ml-4 border-l border-border pl-3" : ""}`}>
      {entries.map((entry) => (
        <li key={entry.path}>
          {entry.isDirectory ? (
            <div>
              <button
                onClick={() => onToggle(entry.path)}
                className="flex items-center gap-1.5 text-xs w-full text-left py-1 hover:text-primary transition-colors"
              >
                <span className="w-3 text-center text-muted-foreground">
                  {expanded.has(entry.path) ? "▾" : "▸"}
                </span>
                <span>📁 {entry.name}</span>
              </button>
              {expanded.has(entry.path) && entry.children && (
                <VaultTree
                  entries={entry.children}
                  expanded={expanded}
                  onToggle={onToggle}
                  onImport={onImport}
                  importing={importing}
                  depth={depth + 1}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-0.5 group">
              <span className="text-xs text-muted-foreground">📄</span>
              <span className="text-xs flex-1 truncate hover:text-primary cursor-pointer"
                title={entry.notePreview?.content?.slice(0, 300)}>
                {entry.name}
              </span>
              <button
                onClick={() => onImport(entry.path)}
                disabled={importing === entry.path}
                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/20 transition-opacity disabled:opacity-50"
              >
                {importing === entry.path ? "..." : "+"}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function NoteCard({
  note,
  onOpen,
  onDelete,
  onToggleFavorite,
}: {
  note: any;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, fav: boolean) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" style={{ backgroundColor: note.background_color || undefined }}>
      <CardContent className="p-4" onClick={() => onOpen(note.id)}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {note.title || "Untitled"}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {truncate(stripHtml(note.content), 120) || "No content"}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {(note.tags ?? []).map((t: any) => {
                const tagName = typeof t === "string" ? t : t.name;
                return (
                  <Badge key={tagName} variant="secondary" className="text-xs">
                    {tagName}
                  </Badge>
                );
              })}
              <span className="text-xs text-muted-foreground ml-auto">
                {timeAgo(note.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(note.id, note.is_favorite);
              }}
              className="text-sm hover:text-amber-500 p-1"
              title={note.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              {note.is_favorite ? "★" : "☆"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="text-sm hover:text-destructive p-1"
              title="Delete"
            >
              🗑
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
