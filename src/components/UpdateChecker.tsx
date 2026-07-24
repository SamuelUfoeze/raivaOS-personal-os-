import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await check();
        if (result?.available) {
          setUpdateAvailable(true);
        }
      } catch {
        // not in Tauri env or no network
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setChecking(true);
    try {
      const result = await check();
      if (result?.available) {
        await result.downloadAndInstall();
        await relaunch();
      }
    } catch {
      setChecking(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <button
      onClick={handleInstall}
      disabled={checking}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
    >
      <span>📦</span>
      <span>{checking ? "Installing..." : "Update available"}</span>
    </button>
  );
}
