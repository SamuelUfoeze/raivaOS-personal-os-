import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "./ui/button";

interface DrawingCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const COLORS = ["#000000", "#7C3AED", "#3B82F6", "#22C55E", "#EF4444", "#F59E0B", "#EC4899", "#6B7280"];
const SIZES = [2, 4, 6, 10];

export default function DrawingCanvas({ onSave, onCancel }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [color, brushSize]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    lastPos.current = pos;
    setDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setDrawing(false);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        className="w-full h-auto rounded-lg border cursor-crosshair touch-none"
        style={{ backgroundColor: "white" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${
                color === c ? "border-primary" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`rounded-full border ${
                brushSize === s ? "border-primary" : "border-border"
              }`}
              style={{ width: s + 8, height: s + 8, backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="secondary" size="sm" onClick={handleClear} disabled={!hasDrawn}>
          Clear
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!hasDrawn}>
          Attach Drawing
        </Button>
      </div>
    </div>
  );
}
