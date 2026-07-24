import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/db";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

export default function ChatScreen() {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    try {
      const t = await api.getChatThreads();
      setThreads(t);
      if (t.length > 0 && !activeThread) setActiveThread(t[0].id);
    } catch (err) { console.error(err); }
  }

  async function loadMessages() {
    if (!activeThread) return;
    try {
      const m = await api.getChatMessages(activeThread);
      setMessages(m);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { loadMessages(); }, [activeThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function handleNewThread() {
    const t = await api.createChatThread("New Chat");
    setActiveThread(t.id);
    loadThreads();
  }

  async function handleSend() {
    if (!input.trim() || !activeThread) return;
    const msg = input.trim();
    setInput("");
    setProcessing(true);
    setThinking(null);
    setShowThinking(false);
    setSuggestions([]);

    setMessages((prev) => [...prev, { id: "temp-" + Date.now(), role: "user", content: msg, created_at: new Date().toISOString() }]);

    try {
      const { processChatMessage } = await import("../lib/ai");
      const result = await processChatMessage(msg, activeThread, [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: msg },
      ]);

      if (result.thinking) {
        setThinking(result.thinking);
        setShowThinking(false);
      }
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
      await loadMessages();
    } catch (err) {
      console.error(err);
      await api.saveChatMessage(activeThread, "user", msg);
      await api.saveChatMessage(activeThread, "assistant", "I encountered an error processing your request. Please try again.");
      await loadMessages();
    }
    setProcessing(false);
  }

  async function handleDeleteThread(id: string) {
    await api.deleteChatThread(id);
    if (activeThread === id) { setActiveThread(null); setMessages([]); }
    loadThreads();
  }

  function renderMessage(content: string): React.ReactNode {
    // Bold
    let rendered = content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    rendered = rendered.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Newlines
    rendered = rendered.replace(/\n/g, "<br/>");
    // Bullet points
    rendered = rendered.replace(/^• /gm, "&nbsp;&nbsp;• ");
    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  }

  const SUGGESTION_CHIPS = [
    "How many tasks do I have?",
    "Create a project called 'Learn Piano'",
    "What's in my inbox?",
    "Analyze my productivity",
    "Plan based on my visions",
    "Run a life audit",
    "What does David Ogilvy say about headlines?",
    "Show me my projects",
    "Search the web for latest AI news",
    "What's the weather today?",
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 border-r p-3 space-y-2 flex flex-col bg-sidebar-background shrink-0">
          <Button size="sm" onClick={handleNewThread} className="w-full">+ New Chat</Button>
          <div className="flex-1 overflow-y-auto space-y-1">
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 p-2 rounded-md cursor-pointer text-sm ${
                  activeThread === t.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex-1 truncate" onClick={() => setActiveThread(t.id)}>
                  {t.title}
                </div>
                <button onClick={() => handleDeleteThread(t.id)} className="text-xs text-muted-foreground hover:text-destructive shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="shrink-0 px-1.5 border-r hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center"
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? "◀" : "▶"}
      </button>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!activeThread ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <span className="text-4xl">🧠</span>
            <p className="text-sm">RAIVA AI has full access to all your data</p>
            <p className="text-xs">I can read, create, update, and manage everything in your system</p>
            <Button onClick={handleNewThread}>Start a conversation</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !processing && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
                  <span className="text-3xl">🧠</span>
                  <p className="text-sm font-medium">RAIVA AI Assistant</p>
                  <p className="text-xs max-w-md">
                    I have full awareness of your notes, projects, tasks, habits, visions, library packs, and knowledge tree.
                    Ask me anything or tell me what to create.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center max-w-lg">
                    {SUGGESTION_CHIPS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setInput(suggestion); }}
                        className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-accent transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? renderMessage(m.content) : m.content}
                  </div>
                </div>
              ))}

              {/* Thinking trace */}
              {thinking && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2 text-xs bg-muted/50 text-muted-foreground">
                    <button
                      onClick={() => setShowThinking(!showThinking)}
                      className="font-medium text-xs mb-1 flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {showThinking ? "▼" : "▶"} {showThinking ? "Hide thinking" : "Show thinking trace"}
                    </button>
                    {showThinking && (
                      <pre className="whitespace-pre-wrap font-mono text-xs opacity-80 leading-relaxed">
                        {thinking}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Suggested next steps:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s); }}
                          className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {processing && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm bg-secondary text-secondary-foreground">
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
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Ask RAIVA AI anything about your data..."
                  disabled={processing}
                />
                <Button onClick={handleSend} disabled={processing}>
                  {processing ? "..." : "Send"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Try: "What tasks do I have?" • "Create a project called..." • "What does Ogilvy say about headlines?"
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
