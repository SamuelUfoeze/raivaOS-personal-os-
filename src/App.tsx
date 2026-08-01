import React, { useState, useEffect } from "react";
import Layout from "./components/Layout";
import { prefetchAll } from "./lib/db";
import ThemeProvider from "./components/ThemeProvider";
import Dashboard from "./screens/Dashboard";
import NotesList from "./screens/NotesList";
import NoteEditor from "./screens/NoteEditor";
import ProjectsScreen from "./screens/ProjectsScreen";
import HabitsScreen from "./screens/HabitsScreen";
import TasksScreen from "./screens/TasksScreen";
import ProductivityScreen from "./screens/ProductivityScreen";
import ChatScreen from "./screens/ChatScreen";
import KnowledgeAndLibrary from "./screens/KnowledgeAndLibrary";
import AboutMeScreen from "./screens/AboutMeScreen";
import KnowledgeGraphScreen from "./screens/KnowledgeGraphScreen";
import AuditScreen from "./screens/AuditScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefetchAll().then(() => setReady(true));
  }, []);

  const handleNavigate = (s: string) => {
    setScreen(s);
    setSelectedNoteId(null);
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-lg">
        Loading…
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Layout activeScreen={screen} onNavigate={handleNavigate}>
        {screen === "dashboard" && <Dashboard onNavigate={handleNavigate} onOpenNote={(id) => { setSelectedNoteId(id); setScreen("note-editor"); }} />}
        {screen === "notes" && <NotesList onNavigate={handleNavigate} onOpenNote={(id) => { setSelectedNoteId(id); setScreen("note-editor"); }} />}
        {screen === "note-editor" && <NoteEditor key={selectedNoteId ?? "new"} noteId={selectedNoteId} onBack={() => setScreen("notes")} />}
        {screen === "projects" && <ProjectsScreen />}
        {screen === "habits" && <HabitsScreen />}
        {screen === "tasks" && <TasksScreen />}
        {screen === "productivity" && <ProductivityScreen />}
        {screen === "chat" && <ChatScreen />}
        {screen === "knowledge-library" && <KnowledgeAndLibrary />}
        {screen === "about" && <AboutMeScreen />}
        {screen === "knowledge-graph" && <KnowledgeGraphScreen />}
        {screen === "audit" && <AuditScreen />}
        {screen === "settings" && <SettingsScreen />}
      </Layout>
    </ThemeProvider>
  );
}
