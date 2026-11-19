"use client";

import { Box, Button, FormLabel, TextField, Typography } from "@mui/material";
import { useRef, useState, useEffect, useCallback } from "react";
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
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
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
        if (!canvas)
            return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);
    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (disabled)
            return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx)
            return;
        setIsDrawing(true);
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled)
            return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx)
            return;
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
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        setHasDrawn(false);
    };
    if (existingSignature && disabled) {
        return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
        <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Digital Signature</FormLabel>
        <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", padding: "0.75rem" }}>
          <Box src={existingSignature} alt="Signature" component="img" sx={{ height: "4rem", marginLeft: "auto", marginRight: "auto" }}/>
          {existingName && <Typography component="p" variant="body1" sx={{ textAlign: "center", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", marginTop: "0.25rem" }}>{existingName}</Typography>}
        </Box>
      </Box>);
    }
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Digital Signature</FormLabel>
        {hasDrawn && !disabled && (<Button onClick={clear} variant="text" size="small" sx={{ height: "1.5rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
            <Box component={Eraser} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Clear
          </Button>)}
      </Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "2px", borderStyle: "dashed", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", overflow: "hidden" }}>
        <Box ref={canvasRef} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} component="canvas" sx={{ width: "100%", height: "6rem", cursor: "crosshair", touchAction: "none" }}/>
      </Box>
      <TextField placeholder="Full name" value={name} onChange={e => {
        setName(e.target.value);
        if (hasDrawn && canvasRef.current) {
            onSignature(canvasRef.current.toDataURL("image/png"), e.target.value);
        }
    }} disabled={disabled} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Full name" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}/>
    </Box>);
}
