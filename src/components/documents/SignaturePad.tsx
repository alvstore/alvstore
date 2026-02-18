import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onSignature: (data: string, name: string) => void;
  existingSignature?: string | null;
  existingName?: string | null;
  disabled?: boolean;
}

export function SignaturePad({ onSignature, existingSignature, existingName, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [name, setName] = useState(existingName || "");
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "hsl(222, 47%, 11%)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = existingSignature;
    }
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSignature(canvasRef.current.toDataURL("image/png"), name);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  if (existingSignature && disabled) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Digital Signature</Label>
        <div className="rounded-lg border border-border bg-card p-3">
          <img src={existingSignature} alt="Signature" className="h-16 mx-auto" />
          {existingName && <p className="text-center text-sm font-medium mt-1">{existingName}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Digital Signature</Label>
        {hasDrawn && !disabled && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clear}>
            <Eraser className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>
      <div className="rounded-lg border-2 border-dashed border-border bg-card overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-24 cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <Input
        placeholder="Full name"
        value={name}
        onChange={e => {
          setName(e.target.value);
          if (hasDrawn && canvasRef.current) {
            onSignature(canvasRef.current.toDataURL("image/png"), e.target.value);
          }
        }}
        className="h-8 text-sm"
        disabled={disabled}
      />
    </div>
  );
}
