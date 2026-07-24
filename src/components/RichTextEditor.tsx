import React, { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  hideToolbar?: boolean;
}

export interface RTEHandle {
  exec: (cmd: string, val?: string) => void;
  insertChecklist: () => void;
  insertTable: () => void;
  insertImage: () => void;
  addTableRow: (after: boolean) => void;
  removeTableRow: () => void;
  addTableCol: (after: boolean) => void;
  removeTableCol: () => void;
}

const RichTextEditor = forwardRef<RTEHandle, RichTextEditorProps>(
  ({ value, onChange, className = "", hideToolbar = false }: RichTextEditorProps, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value;
      initialized.current = true;
    }
  }, []);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html !== value) onChange(html);
    }
  }, [onChange, value]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    emitChange();
  }, [emitChange]);

  const insertChecklist = useCallback(() => {
    const html =
      '<div data-type="checkline"><input type="checkbox" style="margin:0 6px 0 0" contenteditable="false"><span contenteditable="true">&nbsp;</span></div>';
    document.execCommand("insertHTML", false, html);
    // place cursor inside the span
    const sel = window.getSelection();
    if (sel && editorRef.current) {
      const span = editorRef.current.querySelector(
        '[data-type="checkline"]:last-child span'
      ) as HTMLElement;
      if (span) {
        const range = document.createRange();
        range.setStart(span, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    emitChange();
  }, [emitChange]);

  const insertTable = useCallback(() => {
    const html =
      '<table class="rte-table"><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>';
    document.execCommand("insertHTML", false, html);
    emitChange();
  }, [emitChange]);

  const addTableRow = useCallback(
    (after: boolean) => {
      const sel = window.getSelection();
      const td =
        sel?.focusNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.focusNode as HTMLElement).closest?.("td, th")
          : sel?.focusNode?.parentElement?.closest?.("td, th");
      if (!td) return;
      const tr = td.closest("tr");
      if (!tr) return;
      const tbody = tr.closest("tbody") || tr.closest("thead");
      if (!tbody) return;
      const newRow = document.createElement("tr");
      const cols = tr.children.length;
      for (let i = 0; i < cols; i++) {
        const cell = document.createElement(
          tbody.tagName === "THEAD" ? "th" : "td"
        );
        cell.innerHTML = "&nbsp;";
        newRow.appendChild(cell);
      }
      if (after) tr.after(newRow);
      else tr.before(newRow);
      // focus first cell
      const range = document.createRange();
      range.setStart(newRow.children[0], 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      emitChange();
    },
    [emitChange]
  );

  const removeTableRow = useCallback(() => {
    const sel = window.getSelection();
    const td =
      sel?.focusNode?.nodeType === Node.ELEMENT_NODE
        ? (sel.focusNode as HTMLElement).closest?.("td, th")
        : sel?.focusNode?.parentElement?.closest?.("td, th");
    if (!td) return;
    const tr = td.closest("tr");
    if (!tr) return;
    const tbody = tr.closest("tbody") || tr.closest("thead");
    if (!tbody || tbody.children.length <= 1) return;
    const next = tr.nextElementSibling || tr.previousElementSibling;
    tr.remove();
    if (next) {
      const range = document.createRange();
      const firstCell = (next as HTMLElement).querySelector("td, th");
      if (firstCell) {
        range.setStart(firstCell, 0);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    emitChange();
  }, [emitChange]);

  const addTableCol = useCallback(
    (after: boolean) => {
      const sel = window.getSelection();
      const td =
        sel?.focusNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.focusNode as HTMLElement).closest?.("td, th")
          : sel?.focusNode?.parentElement?.closest?.("td, th");
      if (!td) return;
      const idx = Array.from(td.parentElement!.children).indexOf(td);
      const table = td.closest("table");
      if (!table) return;
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const cell = document.createElement(
          row.closest("thead") ? "th" : "td"
        );
        cell.innerHTML = "&nbsp;";
        const ref = row.children[idx];
        if (ref) {
          after ? ref.after(cell) : ref.before(cell);
        } else {
          row.appendChild(cell);
        }
      });
      emitChange();
    },
    [emitChange]
  );

  const removeTableCol = useCallback(() => {
    const sel = window.getSelection();
    const td =
      sel?.focusNode?.nodeType === Node.ELEMENT_NODE
        ? (sel.focusNode as HTMLElement).closest?.("td, th")
        : sel?.focusNode?.parentElement?.closest?.("td, th");
    if (!td) return;
    const idx = Array.from(td.parentElement!.children).indexOf(td);
    const table = td.closest("table");
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    let minCols = Infinity;
    rows.forEach((row) => {
      if (row.children.length < minCols) minCols = row.children.length;
    });
    if (minCols <= 1) return;
    rows.forEach((row) => {
      const cell = row.children[idx];
      if (cell) cell.remove();
    });
    emitChange();
  }, [emitChange]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL:");
    if (url) {
      document.execCommand("insertImage", false, url);
      emitChange();
    }
  }, [emitChange]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      if (!sel?.focusNode) return;

      const el =
        sel.focusNode.nodeType === Node.ELEMENT_NODE
          ? (sel.focusNode as HTMLElement)
          : sel.focusNode.parentElement;

      const checkParent = el?.closest?.('[data-type="checkline"]');
      if (checkParent) {
        e.preventDefault();
        const text = (checkParent as HTMLElement).innerText?.trim() || "";
        const isEmpty = text === "" || text === "\n" || text === "\u00a0";

        if (isEmpty) {
          const br = document.createElement("br");
          checkParent.replaceWith(br);
          const range = document.createRange();
          range.setStartAfter(br);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          const div = document.createElement("div");
          div.setAttribute("data-type", "checkline");
          div.innerHTML =
            '<input type="checkbox" style="margin:0 6px 0 0" contenteditable="false"><span contenteditable="true">&nbsp;</span>';
          checkParent.after(div);
          const range = document.createRange();
          const span = div.querySelector("span") as HTMLElement;
          range.setStart(span, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        emitChange();
        return;
      }
    }
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emitChange();
  }, [emitChange]);

  useImperativeHandle(ref, () => ({ exec, insertChecklist, insertTable, insertImage, addTableRow, removeTableRow, addTableCol, removeTableCol }), [exec, insertChecklist, insertTable, insertImage, addTableRow, removeTableRow, addTableCol, removeTableCol]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {!hideToolbar && (
        <Toolbar
          exec={exec}
          insertChecklist={insertChecklist}
          insertTable={insertTable}
          insertImage={insertImage}
        />
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 p-6 focus:outline-none text-base leading-relaxed overflow-y-auto"
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
    </div>
  );
});

export default RichTextEditor;

function Toolbar({
  exec,
  insertChecklist,
  insertTable,
  insertImage,
}: {
  exec: (cmd: string, val?: string) => void;
  insertChecklist: () => void;
  insertTable: () => void;
  insertImage: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 rounded-t-lg" onMouseDown={(e) => e.preventDefault()}>
      <TbBtn onClick={() => exec("bold")} label="B" style={{ fontWeight: "bold" }} title="Bold" />
      <TbBtn onClick={() => exec("italic")} label="I" style={{ fontStyle: "italic" }} title="Italic" />
      <TbBtn onClick={() => exec("underline")} label="U" style={{ textDecoration: "underline" }} title="Underline" />
      <span className="w-px h-5 bg-border mx-1" />
      <TbBtn onClick={() => exec("insertUnorderedList")} label="• Bullet" title="Bullet list — Enter for new item, Enter on empty to exit" />
      <TbBtn onClick={() => exec("insertOrderedList")} label="1. List" title="Numbered list" />
      <TbBtn onClick={insertChecklist} label="☑ Checklist" title="Checklist — Enter for new item, Enter on empty to exit" />
      <span className="w-px h-5 bg-border mx-1" />
      <TbBtn onClick={() => exec("formatBlock", "<h2>")} label="H2" title="Heading 2" />
      <TbBtn onClick={() => exec("formatBlock", "<h3>")} label="H3" title="Heading 3" />
      <TbBtn onClick={() => exec("formatBlock", "<p>")} label="P" title="Paragraph" />
      <span className="w-px h-5 bg-border mx-1" />
      <TbBtn onClick={insertTable} label="⊞ Table" title="Insert table" />
      <TbBtn onClick={insertImage} label="🖼 Img" title="Insert image (enter URL)" />
      <TbBtn onClick={() => exec("insertHorizontalRule")} label="—" title="Horizontal rule" />
    </div>
  );
}

function TbBtn({
  onClick,
  label,
  title,
  style,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="px-2 py-1 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors"
      style={style}
    >
      {label}
    </button>
  );
}
