import { loadSettings, updateSettings, VaultHandle } from "./settings";
import { parseMarkdownFile, ImportedNote } from "./importer";

export interface VaultEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: VaultEntry[];
  notePreview?: ImportedNote;
}

// ── Browser File System Access API ──

let vaultRootHandle: FileSystemDirectoryHandle | null = null;

export async function requestVaultAccess(): Promise<{ name: string; path: string } | null> {
  try {
    // @ts-ignore - File System Access API
    const handle = await window.showDirectoryPicker({ mode: "read" });
    vaultRootHandle = handle;
    const entry = { name: handle.name, path: handle.name };
    return entry;
  } catch (err: any) {
    if (err.name === "AbortError") return null; // user cancelled
    throw err;
  }
}

type DirHandle = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
};

async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  depth: number,
  maxDepth: number,
): Promise<VaultEntry[]> {
  const entries: VaultEntry[] = [];
  if (depth > maxDepth) return entries;

  const h = dirHandle as DirHandle;

  for await (const [name, handle] of h.entries()) {
    // Skip hidden files and common ignore patterns
    if (name.startsWith(".") || name === "node_modules" || name === ".obsidian") continue;

    if (handle.kind === "directory") {
      const children = await walkDirectory(handle as FileSystemDirectoryHandle, `${path}/${name}`, depth + 1, maxDepth);
      // Only include directories that have markdown files or subdirectories
      const hasContent = children.length > 0;
      if (hasContent || depth < 2) {
        entries.push({ name, path: `${path}/${name}`, isDirectory: true, children });
      }
    } else if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        const text = await file.text();
        const notes = parseMarkdownFile(text, name);
        entries.push({
          name,
          path: `${path}/${name}`,
          isDirectory: false,
          notePreview: notes[0] || { title: name, content: text.slice(0, 200), tags: [], created_at: "", source: name },
        });
      } catch {
        entries.push({ name, path: `${path}/${name}`, isDirectory: false });
      }
    }
  }

  // Sort: directories first, then by name
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function getVaultTree(dirPath?: string): Promise<VaultEntry[]> {
  if (!vaultRootHandle) {
    const vaults = loadSettings().vaults;
    if (vaults.length === 0) return [];
    // Try to re-establish access
    const result = await requestVaultAccess();
    if (!result) return [];
  }
  if (!vaultRootHandle) return [];

  let targetHandle = vaultRootHandle;
  if (dirPath) {
    const parts = dirPath.split("/").slice(1); // skip root
    for (const part of parts) {
      try {
        targetHandle = await targetHandle.getDirectoryHandle(part);
      } catch { return []; }
    }
  }

  const vault = loadSettings().vaults[0];
  const maxDepth = vault?.type === "logseq" ? 3 : 4;

  return walkDirectory(targetHandle, vaultRootHandle.name, 0, maxDepth);
}

export async function getVaultFileContent(path: string): Promise<string | null> {
  if (!vaultRootHandle) return null;
  const parts = path.split("/").slice(1);

  let handle: FileSystemDirectoryHandle | FileSystemFileHandle = vaultRootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      handle = await (handle as FileSystemDirectoryHandle).getDirectoryHandle(parts[i]);
    } catch { return null; }
  }
  try {
    const fileHandle = await (handle as FileSystemDirectoryHandle).getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch { return null; }
}

export async function importVaultNote(path: string): Promise<boolean> {
  const content = await getVaultFileContent(path);
  if (!content) return false;

  const filename = path.split("/").pop() || "untitled";
  const notes = parseMarkdownFile(content, filename);

  if (notes.length === 0) return false;

  // Auto-tag based on directory structure
  const parts = path.split("/");
  const dirTags = parts.slice(1, -1).map((p) => p.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()).filter(Boolean);

  const { api } = await import("./db");
  for (const note of notes) {
    const allTags = [...new Set([...note.tags, ...dirTags])];
    await api.createNote({
      title: note.title,
      content: note.content,
      tags: allTags.map((name) => ({ name, color: "#7C3AED", category: dirTags.length > 0 ? "vault" : "imported" })),
    });
  }
  return true;
}

export function autoTagFromPath(path: string): string[] {
  const parts = path.split("/").slice(1, -1); // exclude filename and root
  const tags: string[] = [];
  for (const part of parts) {
    const clean = part.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim();
    if (clean && clean.length > 1) tags.push(clean);
    // Also create parent-child hierarchy
    if (tags.length > 1) {
      tags.push(tags.slice(-2).join("/"));
    }
  }
  return [...new Set(tags)];
}

// ── Tauri backend bridge (placeholder) ──

export async function scanVaultDirectory(fsPath: string): Promise<VaultEntry[]> {
  // In Tauri mode, this calls the Rust backend to walk the directory
  // For now, we rely on the browser File System Access API
  try {
    return await getVaultTree();
  } catch {
    return [];
  }
}

export function registerVault(vault: Omit<VaultHandle, "lastIndexed">): void {
  const settings = loadSettings();
  const existing = settings.vaults.findIndex((v) => v.path === vault.path);
  if (existing >= 0) {
    settings.vaults[existing] = { ...vault, lastIndexed: settings.vaults[existing].lastIndexed };
  } else {
    settings.vaults.push({ ...vault, lastIndexed: null });
  }
  updateSettings({ vaults: settings.vaults });
}

export function removeVault(path: string): void {
  const settings = loadSettings();
  settings.vaults = settings.vaults.filter((v) => v.path !== path);
  updateSettings({ vaults: settings.vaults });
}

export function getActiveVault(): VaultHandle | null {
  const vaults = loadSettings().vaults;
  return vaults.length > 0 ? vaults[0] : null;
}
