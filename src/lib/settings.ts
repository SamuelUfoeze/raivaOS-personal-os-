export type ThemeMode = "light" | "dark";
export type ColorScheme = "purple" | "blue" | "green" | "orange" | "rose" | "zinc" | "emerald";
export type WebSearchMode = "always" | "ask" | "never";
export type ModelTier = "micro" | "standard" | "pro";

export interface ModelRegistryEntry {
  id: string;
  filename: string;
  downloaded: boolean;
  path: string | null;
  downloadedAt: string | null;
}

export interface VaultHandle {
  name: string;
  path: string;
  type: "obsidian" | "logseq" | "other";
  lastIndexed: string | null;
}

export interface LlamaServerConfig {
  port: number;
  ngl: number;
  autoStart: boolean;
  lastModel: string | null;
}

export interface SyncConfig {
  enabled: boolean;
  provider: "none" | "download";
  lastSyncedAt: string | null;
  relayEndpoint: string;
}

export interface AppSettings {
  theme: ThemeMode;
  colorScheme: ColorScheme;
  webSearch: WebSearchMode;
  modelTier: ModelTier;
  sidebarCollapsed: boolean;
  vaults: VaultHandle[];
  modelRegistry: ModelRegistryEntry[];
  llamaServer: LlamaServerConfig;
  userName: string;
  userInfo: string;
  sync: SyncConfig;
}

const SETTINGS_KEY = "raiva_settings";

const DEFAULTS: AppSettings = {
  theme: "light",
  colorScheme: "purple",
  webSearch: "ask",
  modelTier: "standard",
  sidebarCollapsed: false,
  vaults: [],
  modelRegistry: [],
  llamaServer: {
    port: 8080,
    ngl: 32,
    autoStart: false,
    lastModel: null,
  },
  userName: "",
  userInfo: "",
  sync: {
    enabled: false,
    provider: "none",
    lastSyncedAt: null,
    relayEndpoint: "",
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyTheme(theme: ThemeMode, colorScheme: ColorScheme): void {
  const root = document.documentElement;

  // Dark mode
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Color scheme — override primary/ring CSS variables
  const schemes: Record<ColorScheme, { primary: string; primaryForeground: string; ring: string }> = {
    purple: { primary: "262.1 83.3% 57.8%", primaryForeground: "210 40% 98%", ring: "262.1 83.3% 57.8%" },
    blue: { primary: "217.2 91.2% 59.8%", primaryForeground: "210 40% 98%", ring: "217.2 91.2% 59.8%" },
    green: { primary: "142.1 76.2% 36.3%", primaryForeground: "210 40% 98%", ring: "142.1 76.2% 36.3%" },
    orange: { primary: "24.6 95% 53.1%", primaryForeground: "210 40% 98%", ring: "24.6 95% 53.1%" },
    rose: { primary: "346.8 77.2% 49.8%", primaryForeground: "210 40% 98%", ring: "346.8 77.2% 49.8%" },
    zinc: { primary: "240 5.9% 10%", primaryForeground: "0 0% 98%", ring: "240 5.9% 10%" },
    emerald: { primary: "160.1 84.1% 39.4%", primaryForeground: "210 40% 98%", ring: "160.1 84.1% 39.4%" },
  };

  const scheme = schemes[colorScheme] || schemes.purple;
  root.style.setProperty("--primary", scheme.primary);
  root.style.setProperty("--primary-foreground", scheme.primaryForeground);
  root.style.setProperty("--ring", scheme.ring);

  // Dark mode variant for primary
  const darkPrimary: Record<ColorScheme, string> = {
    purple: "263.4 70% 50.4%",
    blue: "217.2 91.2% 59.8%",
    green: "142.1 70% 45%",
    orange: "20.5 90% 48%",
    rose: "346.8 77% 45%",
    zinc: "240 5% 65%",
    emerald: "160.1 80% 45%",
  };
  root.style.setProperty("--dark-primary", darkPrimary[colorScheme] || darkPrimary.purple);
}

// Subscribers for reactive settings
type Subscriber = (settings: AppSettings) => void;
const subscribers = new Set<Subscriber>();

export function subscribeSettings(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  applyTheme(updated.theme, updated.colorScheme);
  subscribers.forEach((fn) => fn(updated));
  return updated;
}

// Initialize on load
applyTheme(DEFAULTS.theme, DEFAULTS.colorScheme);
