import React, { useState, useRef, useEffect } from "react";
import { Input } from "./ui/input";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  as?: "input" | "textarea";
}

export default function InlineEdit({ value, onSave, className = "", placeholder, as = "input" }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft.trim() && draft !== value) {
      onSave(draft.trim());
    } else {
      setDraft(value);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    if (as === "textarea") {
      return (
        <textarea
          ref={inputRef as any}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={`w-full bg-transparent border rounded px-1 py-0.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
          rows={2}
        />
      );
    }
    return (
      <Input
        ref={inputRef as any}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`h-7 text-sm px-1 py-0 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-accent/50 rounded px-1 -ml-1 transition-colors ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">{placeholder || "Click to edit"}</span>}
    </span>
  );
}
