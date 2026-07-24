import React, { useState } from "react";
import Layout from "./components/Layout";
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

  const handleNavigate = (s: string) => {
    setScreen(s);
    setSelectedNoteId(null);
  };

  return (
    <ThemeProvider>
      <Layout activeScreen={screen} onNavigate={handleNavigate}>
        {screen === "dashboard" && <Dashboard onNavigate={handleNavigate} onOpenNote={(id) => { setSelectedNoteId(id); setScreen("note-editor"); }} />}
        {screen === "notes" && <NotesList onNavigate={handleNavigate} onOpenNote={(id) => { setSelectedNoteId(id); setScreen("note-editor"); }} />}
        {screen === "note-editor" && <NoteEditor noteId={selectedNoteId} onBack={() => setScreen("notes")} />}
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
