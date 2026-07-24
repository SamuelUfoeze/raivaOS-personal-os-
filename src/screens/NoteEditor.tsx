import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { timeAgo } from "../lib/utils";
import { api } from "../lib/db";
import { suggestTags } from "../lib/autoTag";
import { loadTable as syncLoadTable, saveTable as syncSaveTable } from "../lib/sync";
import RichTextEditor, { type RTEHandle } from "../components/RichTextEditor";
import DrawingCanvas from "../components/DrawingCanvas";

interface NoteEditorProps {
  noteId: string | null;
  onBack: () => void;
}

export default function NoteEditor({ noteId, onBack }: NoteEditorProps) {
  const [note, setNote] = useState<any>({ title: "", content: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [autoTagging, setAutoTagging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPalette = ['#ffffff', '#FFF8E7', '#E8F4FD', '#FDE8EF', '#E8F5E9', '#FFFDE7', '#F3E5F5', '#FFF3E0'];
  const titleRef = React.useRef<HTMLInputElement>(null);
  const autoTagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rteRef = useRef<RTEHandle>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef(note);
  noteRef.current = note;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const savingRef = useRef(false);

  useEffect(() => {
    async function load() {
      if (noteId) {
        try {
          const n = await api.getNote(noteId);
          if (n) {
            setNote(n);
            setTags((n.tags ?? []).map((t: any) => (typeof t === "string" ? t : t.name)));
            setAttachments(JSON.parse(n.attachments || "[]"));
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
      titleRef.current?.focus();
    }
    load();
  }, [noteId]);

  const doAutoTag = useCallback(async () => {
    if (!note.title && !note.content) {
      setSuggestedTags([]);
      return;
    }
    setAutoTagging(true);
    try {
      const allTags = await api.getTags();
      const known = (allTags ?? []).map((t: any) => t.name);
      const suggestions = await suggestTags(note.title, note.content, known);
      setSuggestedTags(suggestions.filter((s: string) => !tags.includes(s)));
    } catch {
    }
    setAutoTagging(false);
  }, [note.title, note.content, tags]);

  useEffect(() => {
    if (autoTagTimer.current) clearTimeout(autoTagTimer.current);
    autoTagTimer.current = setTimeout(doAutoTag, 800);
    return () => {
      if (autoTagTimer.current) clearTimeout(autoTagTimer.current);
    };
  }, [note.title, note.content, doAutoTag]);

  // Auto-save with debounce
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const cur = noteRef.current;
      if (!cur) return;
      if (!cur.title && !cur.content) return;
      if (savingRef.current) return;
      savingRef.current = true;
      doSave().finally(() => { savingRef.current = false; });
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [note.title, note.content, tags]);

  // Flush pending save on beforeunload
  useEffect(() => {
    function flush() {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      const cur = noteRef.current;
      if (!cur) return;
      if (!cur.title && !cur.content) return;
      // Sync save via direct Yjs write for beforeunload
      try {
        const notes = syncLoadTable<any>("notes");
        const idx = notes.findIndex((n: any) => n.id === cur.id);
        if (idx >= 0 && cur.id) {
          notes[idx] = {
            ...notes[idx],
            title: cur.title,
            content: cur.content,
            background_color: cur.background_color || '#ffffff',
            tags: tagsRef.current.map((t: string) => ({
              id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              name: t,
              color: "#9C27B0",
              category: "manual",
            })),
            updated_at: new Date().toISOString(),
          };
          syncSaveTable("notes", notes);
        }
      } catch {}
    }
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  function applySuggestion(tag: string) {
    if (!tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
      setSuggestedTags((prev) => prev.filter((t) => t !== tag));
    }
  }

  function flashSaveMsg(msg: string) {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 2000);
  }

  async function doSave() {
    if (note.id) {
      setSaving(true);
      try {
        await api.updateNote(note.id, {
          title: note.title,
          content: note.content,
          tags,
          attachments: JSON.stringify(attachments),
          background_color: note.background_color || '#ffffff',
        });
        flashSaveMsg("Saved");
      } catch (err) {
        flashSaveMsg("Save failed");
        console.error(err);
      }
      setSaving(false);
    } else {
      setSaving(true);
      try {
        const created = await api.createNote({
          title: note.title || "Untitled",
          content: note.content,
          tags,
          attachments: JSON.stringify(attachments),
          background_color: note.background_color || '#ffffff',
        });
        setNote((n: any) => ({ ...n, id: created.id }));
        flashSaveMsg("Created");
      } catch (err) {
        flashSaveMsg("Save failed");
        console.error(err);
      }
      setSaving(false);
    }
  }

  async function handleTitleChange(val: string) {
    setNote((n: any) => ({ ...n, title: val }));
  }

  function handleContentChange(val: string) {
    setNote((n: any) => ({ ...n, content: val }));
  }

  async function handleAddTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      const newTags = [...tags, t];
      setTags(newTags);
      setTagInput("");
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleCreateTask() {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    if (!text) {
      flashSaveMsg("Select text first");
      return;
    }
    try {
      await api.createTask({ title: text, quadrant: "", duration_mins: 25, status: "not-started", tags: [] });
      flashSaveMsg("Task created");
    } catch (err) {
      flashSaveMsg("Task failed");
      console.error(err);
    }
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          setAttachments((prev) => [...prev, dataUrl]);
        }
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function handleDrawingSave(dataUrl: string) {
    setAttachments((prev) => [...prev, dataUrl]);
    setShowDrawer(false);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading note...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0 bg-background z-10">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Notes
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            ref={titleRef}
            value={note.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Note title..."
            className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 h-auto truncate"
          />
        </div>
        {saving && (
          <span className="text-xs text-muted-foreground animate-pulse whitespace-nowrap">Saving...</span>
        )}
        {saveMsg && (
          <span className={`text-xs font-medium whitespace-nowrap ${
            saveMsg.startsWith("S") || saveMsg.startsWith("C")
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
          }`}>
            ✓ {saveMsg}
          </span>
        )}
        {note.updated_at && !saveMsg && !saving && (
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            Saved {timeAgo(note.updated_at)}
          </span>
        )}
        <Button size="sm" onClick={doSave}>
          {note.id ? "Save" : "Create"}
        </Button>
      </header>

      {/* Editor area — full remaining height, no box */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: note.background_color || '#ffffff' }}>
        <RichTextEditor
          ref={rteRef}
          hideToolbar
          value={note.content}
          onChange={handleContentChange}
        />
      </div>

      {/* Bottom bar section: Tags, Attachments, Toolbar */}
      <div className="border-t bg-background shrink-0">
        {/* Tags */}
        <div className="px-6 py-2 border-b flex items-center gap-2 flex-wrap min-h-[36px]">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs">
              {t}
              <button onClick={() => handleRemoveTag(t)} className="ml-1 hover:text-destructive">×</button>
            </Badge>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAddTag(); }
              if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                handleRemoveTag(tags[tags.length - 1]);
              }
            }}
            onBlur={() => { if (tagInput.trim()) handleAddTag(); }}
            placeholder="Add tag..."
            className="text-xs bg-transparent border-0 outline-none min-w-[80px] py-0.5 placeholder:text-muted-foreground/50"
          />
          {suggestedTags.length > 0 && suggestedTags.slice(0, 3).map((t) => (
            <button key={t} onClick={() => applySuggestion(t)} className="text-[10px] text-primary/70 hover:text-primary underline">+{t}</button>
          ))}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-6 py-2 border-b flex gap-2 overflow-x-auto">
            {attachments.map((url, i) => (
              <div key={i} className="relative group shrink-0 w-12 h-12 rounded overflow-hidden border">
                <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                <button onClick={() => removeAttachment(i)} className="absolute top-0 right-0 bg-background/80 text-[10px] p-0.5 opacity-0 group-hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-2 flex items-center gap-1">
          <TbBtn onClick={() => rteRef.current?.exec("bold")} label="B" title="Bold" />
          <TbBtn onClick={() => rteRef.current?.exec("italic")} label="I" title="Italic" />
          <TbBtn onClick={() => rteRef.current?.exec("insertUnorderedList")} label="•" title="List" />
          <TbBtn onClick={() => rteRef.current?.insertTable()} label="⊞" title="Table" />
          <TbBtn onClick={() => rteRef.current?.insertImage()} label="🖼" title="Image" />
          <TbBtn onClick={() => setShowDrawer(true)} label="✏️" title="Draw" />
          <label className="cursor-pointer px-2 py-1 text-xs rounded hover:bg-accent" title="File">📎<input type="file" onChange={handleFileAttach} className="hidden" /></label>
          <div className="relative">
            <TbBtn onClick={() => setShowColorPicker(!showColorPicker)} label="🎨" title="Color" active={showColorPicker} />
            {showColorPicker && (
              <div className="absolute bottom-full right-0 mb-2 p-2 bg-popover border rounded shadow-lg flex gap-1 z-50">
                {colorPalette.map((c) => (
                  <button key={c} onClick={() => { setNote((n: any) => ({ ...n, background_color: c })); setShowColorPicker(false); }} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
          </div>
          <span className="flex-1" />
          <span className="text-[10px] text-muted-foreground">{note.content.replace(/<[^>]*>/g, '').length} chars</span>
        </div>
      </div>

      {/* Drawing Modal */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-lg p-4 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Draw / Handwrite</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDrawer(false)}>✕</Button>
            </div>
            <DrawingCanvas onSave={handleDrawingSave} onCancel={() => setShowDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function TbBtn({ onClick, label, title, style, active }: { onClick: () => void; label: string; title?: string; style?: React.CSSProperties; active?: boolean }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title}
      className={`px-2 py-1 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors ${active ? 'bg-accent text-accent-foreground' : ''}`} style={style}>
      {label}
    </button>
  );
}
