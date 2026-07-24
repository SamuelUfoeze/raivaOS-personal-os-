import React, { useEffect, useState } from "react";
import { loadSettings, subscribeSettings, applyTheme, AppSettings } from "../lib/settings";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Apply saved theme on mount
    const settings = loadSettings();
    applyTheme(settings.theme, settings.colorScheme);
    setReady(true);

    // React to settings changes
    const unsub = subscribeSettings((s: AppSettings) => {
      applyTheme(s.theme, s.colorScheme);
    });
    return unsub;
  }, []);

  // Render children immediately; theme class is applied on DOM
  return <>{children}</>;
}
