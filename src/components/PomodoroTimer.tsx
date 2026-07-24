import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";

interface PomodoroTimerProps {
  taskTitle?: string;
  defaultMinutes?: number;
  onComplete?: (completedMins: number) => void;
  onPause?: (elapsedMins: number) => void;
}

export default function PomodoroTimer({
  taskTitle,
  defaultMinutes = 25,
  onComplete,
  onPause,
}: PomodoroTimerProps) {
  const [totalMins, setTotalMins] = useState(defaultMinutes);
  const [remainingSecs, setRemainingSecs] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalSecs = totalMins * 60;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "hsl(var(--muted))";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Progress arc
    const progress = 1 - remainingSecs / totalSecs;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * progress;

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = completed
      ? "#22c55e"
      : remainingSecs <= 300
        ? "#ef4444"
        : "#7c3aed";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();

    // Time text
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    ctx.fillStyle = "hsl(var(--foreground))";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      cx,
      cy - 8
    );

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "hsl(var(--muted-foreground))";
    ctx.fillText(
      completed ? "COMPLETE" : running ? (paused ? "PAUSED" : "FOCUS") : "READY",
      cx,
      cy + 22
    );
  }, [remainingSecs, totalSecs, running, paused, completed]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const start = useCallback(() => {
    if (completed) {
      setRemainingSecs(totalSecs);
      setCompleted(false);
      elapsedRef.current = 0;
    }
    setRunning(true);
    setPaused(false);
  }, [completed, totalSecs]);

  const pause = useCallback(() => {
    setPaused(true);
    setRunning(false);
    const elapsed = Math.round(elapsedRef.current / 60);
    onPause?.(elapsed);
  }, [onPause]);

  const stop = useCallback(() => {
    setRunning(false);
    setPaused(false);
    const elapsed = Math.round(elapsedRef.current / 60);
    onPause?.(elapsed);
    setRemainingSecs(totalSecs);
    elapsedRef.current = 0;
    setCompleted(false);
  }, [totalSecs, onPause]);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setRemainingSecs((prev) => {
        const next = prev - 1;
        elapsedRef.current += 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          setRunning(false);
          setCompleted(true);
          const elapsed = Math.round(elapsedRef.current / 60);
          onComplete?.(elapsed);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, onComplete]);

  const handleTotalChange = (mins: number) => {
    if (!running && !paused) {
      const clamped = Math.max(1, Math.min(120, mins));
      setTotalMins(clamped);
      setRemainingSecs(clamped * 60);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} width={200} height={200} className="w-48 h-48" />
      {taskTitle && (
        <p className="text-sm text-muted-foreground text-center max-w-[200px] truncate">
          {taskTitle}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleTotalChange(totalMins - 5)}
          disabled={running || paused || totalMins <= 5}
        >
          -5
        </Button>
        <span className="text-sm font-mono w-12 text-center">{totalMins}m</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleTotalChange(totalMins + 5)}
          disabled={running || paused || totalMins >= 120}
        >
          +5
        </Button>
      </div>
      <div className="flex gap-2">
        {!running && !paused && (
          <Button onClick={start} size="sm">
            {completed ? "Reset" : "Start"}
          </Button>
        )}
        {running && (
          <Button onClick={pause} variant="secondary" size="sm">
            Pause
          </Button>
        )}
        {paused && (
          <Button onClick={start} size="sm">
            Resume
          </Button>
        )}
        {(running || paused) && (
          <Button onClick={stop} variant="destructive" size="sm">
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
