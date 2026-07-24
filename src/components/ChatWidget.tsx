import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/db";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function ChatWidget({ onClose }: { onClose: () => void }) {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const threads = await api.getChatThreads();
      if (threads.length > 0) {
        setActiveThread(threads[0].id);
        const msgs = await api.getChatMessages(threads[0].id);
        setMessages(msgs);
      } else {
        const t = await api.createChatThread("Quick Chat");
        setActiveThread(t.id);
      }
    }
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !activeThread) return;
    const msg = input.trim();
    setInput("");
    setProcessing(true);
    setMessages((prev) => [...prev, { id: "temp-" + Date.now(), role: "user", content: msg, created_at: new Date().toISOString() }]);
    try {
      const { processChatMessage } = await import("../lib/ai");
      await processChatMessage(msg, activeThread, [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: msg },
      ]);
      const updated = await api.getChatMessages(activeThread);
      setMessages(updated);
    } catch (err) {
      console.error(err);
      await api.saveChatMessage(activeThread, "user", msg);
      await api.saveChatMessage(activeThread, "assistant", "I encountered an error. Please try again.");
      const updated = await api.getChatMessages(activeThread);
      setMessages(updated);
    }
    setProcessing(false);
  }

  function renderMessage(content: string): React.ReactNode {
    let rendered = content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    rendered = rendered.replace(/\*(.+?)\*/g, "<em>$1</em>");
    rendered = rendered.replace(/\n/g, "<br/>");
    rendered = rendered.replace(/^• /gm, "&nbsp;&nbsp;• ");
    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  }

  return (
    <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-96 bg-card border rounded-xl shadow-2xl flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">🧠 AI Chat</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !processing && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
            <span className="text-2xl">🧠</span>
            <p className="text-xs">Ask me anything about your data</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {m.role === "assistant" ? renderMessage(m.content) : m.content}
            </div>
          </div>
        ))}
        {processing && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 text-sm bg-secondary text-secondary-foreground">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Ask RAIVA AI..."
            disabled={processing}
            className="text-sm"
          />
          <Button onClick={handleSend} disabled={processing} size="sm">
            {processing ? "..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
