import { api } from "./db";

export interface ImportedNote {
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  source: string;
}

/**
 * Parse a markdown file content, handling Obsidian and standard markdown frontmatter.
 * Supports:
 *   - Obsidian: YAML frontmatter (---), wikilinks [[...]], tags #tag, metadata
 *   - Standard markdown: frontmatter, # title for title, tags
 *   - Logseq: org-mode style headings
 */
export function parseMarkdownFile(
  content: string,
  filename: string,
): ImportedNote[] {
  const notes: ImportedNote[] = [];

  // Try to detect if this is a Logseq file (ends with .md but has org structure)
  if (isLogseqContent(content)) {
    return parseLogseqContent(content, filename);
  }

  // Check for multiple notes separated by --- (common in some exports)
  const blocks = content.split(/\n---\n/);
  if (blocks.length > 1 && couldBeSeparateNotes(blocks)) {
    for (let i = 0; i < blocks.length; i++) {
      const note = parseSingleNote(blocks[i], `${filename} (part ${i + 1})`);
      if (note) notes.push(note);
    }
    if (notes.length > 0) return notes;
  }

  // Single note
  const note = parseSingleNote(content, filename);
  if (note) notes.push(note);
  return notes;
}

function isLogseqContent(content: string): boolean {
  const lines = content.split("\n");
  // Logseq uses indentation-based hierarchy with bullets or TODO markers
  const bulletLines = lines.filter((l) => /^\s*[-*]\s/.test(l) || /^\s*TODO\s/i.test(l) || /^\s*DONE\s/i.test(l));
  const ratio = bulletLines.length / Math.max(lines.length, 1);
  // Logseq pages typically have >30% bullet lines
  return ratio > 0.3 && lines.length > 10;
}

function parseLogseqContent(content: string, filename: string): ImportedNote[] {
  const notes: ImportedNote[] = [];
  const lines = content.split("\n");
  const title = extractTitle(content, filename);

  // Build hierarchical content preserving Logseq structure
  let mdContent = "";
  for (const line of lines) {
    // Convert indentation
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    if (!trimmed) { mdContent += "\n"; continue; }

    if (/^(TODO|NOW|LATER|DONE|CANCELED)\s/i.test(trimmed)) {
      const status = trimmed.match(/^(TODO|NOW|LATER|DONE|CANCELED)\s/i)?.[1] || "";
      const text = trimmed.replace(/^(TODO|NOW|LATER|DONE|CANCELED)\s/i, "").trim();
      const prefix = status === "DONE" ? "- [x] " : status === "TODO" ? "- [ ] " : "- ";
      mdContent += `${"  ".repeat(Math.floor(indent / 2))}${prefix}${text}\n`;
    } else if (/^\s*[-*]\s/.test(trimmed)) {
      mdContent += `${"  ".repeat(Math.floor(indent / 2))}${trimmed}\n`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      mdContent += `${"  ".repeat(Math.floor(indent / 2))}${trimmed}\n`;
    } else {
      // Regular paragraph
      if (indent > 0) mdContent += `${"  ".repeat(Math.floor(indent / 2))}${trimmed}\n\n`;
      else mdContent += `${trimmed}\n\n`;
    }
  }

  // Extract tags from Logseq
  const tags = extractTags(content);

  notes.push({
    title,
    content: mdContent.trim(),
    tags,
    created_at: extractDate(content) || new Date().toISOString(),
    source: filename,
  });

  return notes;
}

function parseSingleNote(content: string, filename: string): ImportedNote | null {
  if (!content.trim()) return null;

  // Extract frontmatter
  const frontmatter = extractFrontmatter(content);
  const body = frontmatter ? content.slice(frontmatter.raw.length) : content;

  // Title from frontmatter, or first # heading, or filename
  let title = frontmatter?.title || extractTitle(body, filename);

  // Clean content
  let cleanContent = body.trim();

  // Convert Obsidian wikilinks [[Page Name|Display]] → [Display](Page Name)
  cleanContent = cleanContent.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "[$2]($1)");
  cleanContent = cleanContent.replace(/\[\[([^\]]+)\]\]/g, "[$1]($1)");

  // Convert Obsidian tags #tag → tag references (keep as text but extract)
  // Remove #tags from content for cleaner reading (they clutter display)
  const tags = frontmatter?.tags || extractTags(cleanContent);
  cleanContent = cleanContent.replace(/(^|\s)#([\w-]+)/g, "$1`$2`");

  // Remove frontmatter title from body if redundant
  const titleRegex = new RegExp(`^#\\s*${escapeRegex(title)}\\s*$`, "m");
  cleanContent = cleanContent.replace(titleRegex, "").trim();

  return {
    title,
    content: cleanContent,
    tags,
    created_at: frontmatter?.date || extractDate(cleanContent) || new Date().toISOString(),
    source: filename,
  };
}

interface Frontmatter {
  raw: string;
  title?: string;
  tags?: string[];
  date?: string;
  [key: string]: any;
}

function extractFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return null;

  const raw = match[0];
  const yaml = match[1];
  const result: Frontmatter = { raw };

  // Simple YAML parsing (no dependencies)
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let value: any = kv[2].trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key === "title") result.title = value;
    else if (key === "date") result.date = value;
    else if (key === "tags") {
      // Tags can be [tag1, tag2] or "tag1", "tag2" or tag1, tag2
      if (value.startsWith("[")) {
        result.tags = value.slice(1, -1).split(",").map((t: string) => t.trim().replace(/["']/g, "").replace(/^#/, ""));
      } else {
        result.tags = value.split(",").map((t: string) => t.trim().replace(/["']/g, "").replace(/^#/, ""));
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

function extractTitle(content: string, fallback: string): string {
  // Try # Title at start
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  // Try first non-empty line
  const firstLine = content.split("\n").find((l) => l.trim());
  if (firstLine) {
    const cleaned = firstLine.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").trim();
    if (cleaned.length < 100) return cleaned;
  }

  // Fallback: clean filename
  return fallback
    .replace(/\.md$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // #tag pattern (but not inside code blocks)
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("```")) continue; // skip code blocks
    const matches = line.matchAll(/(?:^|\s)#([\w-]+)/g);
    for (const m of matches) {
      const tag = m[1];
      // Exclude common false positives (markdown headings)
      if (!/^\d+$/.test(tag) && tag.length > 0) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}

function extractDate(content: string): string | null {
  // ISO date patterns
  const iso = content.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // Common date formats in filenames or frontmatter
  const us = content.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (us) {
    const [m, d, y] = us[1].split("/");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function couldBeSeparateNotes(blocks: string[]): boolean {
  // If each block starts with a # title or --- frontmatter, they're likely separate notes
  let noteCount = 0;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (/^#\s+\w/.test(trimmed) || /^---\s*\n/.test(trimmed)) {
      noteCount++;
    }
  }
  return noteCount >= blocks.length * 0.5;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Import a list of files (from file input or drag-and-drop).
 * Returns the count of successfully imported notes.
 */
export async function importFiles(files: File[]): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      // Only process markdown and text files
      if (!file.name.endsWith(".md") && !file.name.endsWith(".txt") && !file.name.endsWith(".markdown")) {
        errors.push(`Skipped ${file.name}: unsupported format`);
        continue;
      }

      const text = await file.text();
      const notes = parseMarkdownFile(text, file.name);

      for (const note of notes) {
        await api.createNote({
          title: note.title,
          content: note.content,
          tags: note.tags.map((name) => ({ name, color: "#7C3AED", category: "imported" })),
        });
        imported++;
      }
    } catch (err: any) {
      errors.push(`Failed to import ${file.name}: ${err.message}`);
    }
  }

  return { imported, errors };
}

export function createImportDropHandler(
  onProgress: (count: number, total: number) => void,
  onComplete: (imported: number, errors: string[]) => void,
) {
  return async (files: File[]) => {
    const total = files.length;
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        if (!files[i].name.endsWith(".md") && !files[i].name.endsWith(".txt") && !files[i].name.endsWith(".markdown")) {
          errors.push(`Skipped ${files[i].name}: unsupported format`);
          continue;
        }
        const text = await files[i].text();
        const notes = parseMarkdownFile(text, files[i].name);
        for (const note of notes) {
          await api.createNote({
            title: note.title,
            content: note.content,
            tags: note.tags.map((name) => ({ name, color: "#7C3AED", category: "imported" })),
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(`Failed ${files[i].name}: ${err.message}`);
      }
      onProgress(imported, total);
    }

    onComplete(imported, errors);
  };
}
