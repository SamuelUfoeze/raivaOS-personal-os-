import React, { useState } from "react";
import { cn } from "../lib/utils";
import UpdateChecker from "./UpdateChecker";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const mainNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "notes", label: "Notes", icon: "📝" },
  { id: "projects", label: "Projects", icon: "📊" },
  { id: "habits", label: "Habits", icon: "🔄" },
  { id: "tasks", label: "Tasks", icon: "✅" },
  { id: "productivity", label: "Productivity", icon: "📈" },
];

const secondaryNav: NavItem[] = [
  { id: "chat", label: "AI Chat", icon: "💬" },
  { id: "knowledge-library", label: "Knowledge & Library", icon: "🌳" },
  { id: "about", label: "About Me", icon: "👤" },
  { id: "knowledge-graph", label: "Knowledge Graph", icon: "🔗" },
  { id: "audit", label: "Life Audit", icon: "📋" },
];

const bottomNav: NavItem[] = [
  { id: "settings", label: "Settings", icon: "⚙️" },
];

interface LayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  children: React.ReactNode;
}

export default function Layout({ activeScreen, onNavigate, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar-background transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          {!collapsed && (
            <h1 className="text-lg font-bold text-sidebar-foreground">RAIVA OS</h1>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-lg"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "▶" : "◀"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {mainNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeScreen === item.id}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}
          {!collapsed && <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 pt-4 pb-1">Tools</div>}
          {collapsed && <div className="border-t my-2" />}
          {secondaryNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeScreen === item.id}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}
          {!collapsed && <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 pt-4 pb-1">System</div>}
          {collapsed && <div className="border-t my-2" />}
          {bottomNav.map((item) => (
            <NavButton key={item.id} item={item} active={activeScreen === item.id} collapsed={collapsed} onClick={onNavigate} />
          ))}
        </nav>

        <div className="p-2 border-t space-y-1">
          <UpdateChecker />
          <div className="text-xs text-sidebar-foreground/40 text-center">
            {!collapsed && "RAIVA OS v1.0.0"}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(item.id)}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary border-l-[3px] border-primary rounded-l-none"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.label : undefined}
    >
      <span className="text-lg">{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </button>
  );
}
