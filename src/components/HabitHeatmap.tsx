import React, { useEffect, useRef } from "react";

interface HabitHeatmapProps {
  logs: { date_string: string; status: boolean }[];
  habitColor: string;
  year?: number;
}

export default function HabitHeatmap({ logs, habitColor, year }: HabitHeatmapProps) {
  const yr = year ?? new Date().getFullYear();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = 14;
    const gap = 3;
    const cols = 53;

    const startDate = new Date(yr, 0, 1);
    const endDate = new Date(yr, 11, 31);

    // day of week for Jan 1 (0=Sun)
    const startDow = startDate.getDay();

    // Build a lookup: date_string -> true/false
    const logMap: Record<string, boolean> = {};
    logs.forEach((l) => {
      logMap[l.date_string] = l.status;
    });

    const h = 7 * (cellSize + gap) + gap;
    const w = cols * (cellSize + gap) + gap;

    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, w, h);

    let current = new Date(startDate);
    while (current <= endDate) {
      const ds = current.toISOString().slice(0, 10);
      const dayOfYear = Math.floor(
        (current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const col = Math.floor((dayOfYear + startDow) / 7);
      const row = (dayOfYear + startDow) % 7;

      const x = gap + col * (cellSize + gap);
      const y = gap + row * (cellSize + gap);

      const done = logMap[ds];

      ctx.fillStyle = done
        ? habitColor
        : "hsl(var(--muted))";
      ctx.globalAlpha = done ? 0.85 : 0.3;
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      current.setDate(current.getDate() + 1);
    }

    // Month labels
    ctx.fillStyle = "hsl(var(--muted-foreground))";
    ctx.font = "10px sans-serif";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((m, i) => {
      const monthStart = new Date(yr, i, 1);
      const doy = Math.floor(
        (monthStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const col = Math.floor((doy + startDow) / 7);
      const x = gap + col * (cellSize + gap);
      ctx.fillText(m, x, 8);
    });
  }, [logs, habitColor, yr]);

  const countDone = logs.filter((l) => l.status).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{countDone} days completed</span>
        <span>{yr}</span>
      </div>
      <canvas ref={canvasRef} className="max-w-full" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-muted opacity-30" />
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: habitColor, opacity: 0.4 }}
        />
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: habitColor, opacity: 0.7 }}
        />
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: habitColor, opacity: 1 }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
