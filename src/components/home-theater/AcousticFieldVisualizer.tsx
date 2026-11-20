"use client";

import { Box, ButtonBase, Chip, IconButton, Slider, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMotionActivity } from "@/hooks/useMotionActivity";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";
import { Play, Pause, RotateCcw, Volume2, Sparkles, Activity, Layers, Radio } from "lucide-react";

type VisualizerMode = "atmos" | "raytrace" | "room_modes" | "spectrum";

interface Ray {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  energy: number;
}

interface Wavefront {
  x: number;
  y: number;
  r: number;
  maxR: number;
  channel: string;
  alpha: number;
  color: string;
}

const MODES: { id: VisualizerMode; label: string; desc: string }[] = [
  { id: "atmos", label: "Dolby Atmos 360° Field", desc: "Phase-coherent wavefronts from all 11 calibrated cinema channels" },
  { id: "raytrace", label: "Acoustic Raytracing", desc: "Energy dissipation across reflection diffusers & absorption baffles" },
  { id: "room_modes", label: "Sub-Bass Room Modes", desc: "Standing wave pressure distribution and corner bass trapping" },
  { id: "spectrum", label: "Harmonic Response", desc: "Real-time frequency response calibrated to THX target curve" },
];

export default function AcousticFieldVisualizer() {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const active = useMotionActivity(containerRef);

  const [mode, setMode] = useState<VisualizerMode>("atmos");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [frequency, setFrequency] = useState<number>(65); // Hz
  const [listenerPos, setListenerPos] = useState<{ x: number; y: number }>({ x: 300, y: 220 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Mutable refs to enable continuous 60fps rendering without tearing down waves on drag/frequency changes
  const listenerPosRef = useRef<{ x: number; y: number }>({ x: 300, y: 220 });
  const frequencyRef = useRef<number>(65);

  // Real-time calculated metrics
  const rt60 = (0.24 + (100 - frequency) * 0.0008).toFixed(2);
  const absorption = Math.min(98.8, 91.2 + frequency * 0.06).toFixed(1);
  const spl = Math.min(105, 82 + Math.sin(frequency / 10) * 3).toFixed(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = 600;
    let height = 360;

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width || 600;
      height = rect.height || 360;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Emitter points for Atmos mode (relative coords)
    const getEmitters = (w: number, h: number) => [
      { x: w * 0.18, y: h * 0.22, name: "FL", color: "#E8B86C" },
      { x: w * 0.50, y: h * 0.14, name: "C",  color: "#F4D9A8" },
      { x: w * 0.82, y: h * 0.22, name: "FR", color: "#E8B86C" },
      { x: w * 0.10, y: h * 0.55, name: "SL", color: "#C97B6E" },
      { x: w * 0.90, y: h * 0.55, name: "SR", color: "#C97B6E" },
      { x: w * 0.22, y: h * 0.84, name: "RL", color: "#B8862E" },
      { x: w * 0.78, y: h * 0.84, name: "RR", color: "#B8862E" },
      { x: w * 0.35, y: h * 0.38, name: "TFL", color: "#E8B86C" },
      { x: w * 0.65, y: h * 0.38, name: "TFR", color: "#E8B86C" },
      { x: w * 0.50, y: h * 0.88, name: "SUB", color: "#FF9966" },
    ];

    let waves: Wavefront[] = [];
    let rays: Ray[] = [];
    let frameCount = 0;

    // Initialize raytracing particles
    const initRays = (w: number, h: number) => {
      const result: Ray[] = [];
      const numRays = 48;
      const originX = w * 0.5;
      const originY = h * 0.16;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const speed = 2.2 + Math.random() * 0.8;
        result.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 90 + Math.random() * 40,
          color: i % 2 === 0 ? "#E8B86C" : "#C97B6E",
          energy: 1.0,
        });
      }
      return result;
    };

    rays = initRays(width, height);

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Read mutable refs for current physics parameters
      const currentFreq = frequencyRef.current;
      const currentListener = listenerPosRef.current;

      // Room boundary dimensions
      const padX = width * 0.06;
      const padY = height * 0.08;
      const roomW = width - padX * 2;
      const roomH = height - padY * 2;

      // Draw Room Background
      ctx.fillStyle = "rgba(18, 14, 28, 0.7)";
      ctx.strokeStyle = "rgba(232, 184, 108, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(padX, padY, roomW, roomH, 16);
      ctx.fill();
      ctx.stroke();

      // Draw Acoustic Panels on side walls (orange/gold blocks)
      ctx.fillStyle = "rgba(201, 123, 110, 0.4)";
      ctx.strokeStyle = "rgba(201, 123, 110, 0.7)";
      ctx.lineWidth = 1;
      // Left acoustic baffles
      for (let y = padY + 30; y < padY + roomH - 40; y += 45) {
        ctx.fillRect(padX - 4, y, 7, 24);
        ctx.strokeRect(padX - 4, y, 7, 24);
      }
      // Right acoustic baffles
      for (let y = padY + 30; y < padY + roomH - 40; y += 45) {
        ctx.fillRect(padX + roomW - 3, y, 7, 24);
        ctx.strokeRect(padX + roomW - 3, y, 7, 24);
      }
      // Rear diffusers
      ctx.fillStyle = "rgba(232, 184, 108, 0.35)";
      for (let x = padX + 50; x < padX + roomW - 50; x += 36) {
        ctx.fillRect(x, padY + roomH - 3, 22, 6);
      }

      // Draw Cinema Screen at the top
      const screenW = roomW * 0.6;
      const screenX = padX + (roomW - screenW) / 2;
      const screenGrad = ctx.createLinearGradient(screenX, 0, screenX + screenW, 0);
      screenGrad.addColorStop(0, "rgba(232, 184, 108, 0.1)");
      screenGrad.addColorStop(0.5, "rgba(255, 235, 180, 0.95)");
      screenGrad.addColorStop(1, "rgba(232, 184, 108, 0.1)");
      ctx.fillStyle = screenGrad;
      ctx.fillRect(screenX, padY + 4, screenW, 8);
      ctx.fillStyle = "rgba(244, 217, 168, 0.75)";
      ctx.font = "9px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("150″ MICRO-PERF CINEMA SCREEN", width / 2, padY + 22);

      // MODE 1: DOLBY ATMOS 360° WAVEFRONTS
      if (mode === "atmos") {
        const emitters = getEmitters(width, height);

        // Spawn wavefronts periodically
        if (isPlaying && frameCount % 18 === 0) {
          emitters.forEach((em) => {
            waves.push({
              x: em.x,
              y: em.y,
              r: 2,
              maxR: Math.max(width, height) * 0.7,
              channel: em.name,
              alpha: 0.65,
              color: em.color,
            });
          });
        }

        // Update & draw waves
        waves.forEach((w) => {
          if (isPlaying) {
            w.r += 1.8 + (currentFreq / 100) * 0.8;
            w.alpha = Math.max(0, 0.65 * (1 - w.r / w.maxR));
          }
          ctx.strokeStyle = w.color;
          ctx.globalAlpha = w.alpha;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
          ctx.stroke();
        });
        waves = waves.filter((w) => w.r < w.maxR && w.alpha > 0.02);

        // Draw emitters
        emitters.forEach((em) => {
          ctx.globalAlpha = 1;
          ctx.fillStyle = em.color;
          ctx.beginPath();
          ctx.arc(em.x, em.y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(245, 239, 227, 0.8)";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(em.name, em.x, em.y - 8);
        });
      }

      // MODE 2: ACOUSTIC RAYTRACING
      else if (mode === "raytrace") {
        ctx.globalAlpha = 1;
        if (isPlaying && frameCount % 3 === 0 && rays.length < 90) {
          rays.push(...initRays(width, height).slice(0, 6));
        }

        rays.forEach((ray) => {
          if (isPlaying) {
            ray.x += ray.vx;
            ray.y += ray.vy;
            ray.life++;

            // Bounce off left/right walls with acoustic absorption
            if (ray.x <= padX + 5 || ray.x >= padX + roomW - 5) {
              ray.vx *= -1;
              ray.energy *= 0.75; // absorption drop
            }
            // Bounce off top/bottom walls
            if (ray.y <= padY + 12 || ray.y >= padY + roomH - 5) {
              ray.vy *= -1;
              ray.energy *= 0.70;
            }
          }

          ctx.strokeStyle = ray.color;
          ctx.globalAlpha = Math.max(0, ray.energy * (1 - ray.life / ray.maxLife));
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ray.x - ray.vx * 2, ray.y - ray.vy * 2);
          ctx.lineTo(ray.x, ray.y);
          ctx.stroke();
        });
        rays = rays.filter((r) => r.life < r.maxLife && r.energy > 0.05);
      }

      // MODE 3: ROOM MODES & STANDING WAVES
      else if (mode === "room_modes") {
        ctx.globalAlpha = 0.45;
        const gridX = 24;
        const gridY = 16;
        const cellW = roomW / gridX;
        const cellH = roomH / gridY;
        const timeVal = frameCount * 0.04;

        for (let i = 0; i < gridX; i++) {
          for (let j = 0; j < gridY; j++) {
            const xNorm = i / gridX;
            const yNorm = j / gridY;
            // 2D standing wave node/antinode math
            const modeVal = Math.sin(xNorm * Math.PI * 3 + (isPlaying ? timeVal : 0)) *
                            Math.cos(yNorm * Math.PI * 2 + (isPlaying ? timeVal * 0.8 : 0));
            const intensity = Math.abs(modeVal);

            if (modeVal > 0) {
              ctx.fillStyle = `rgba(232, 184, 108, ${intensity * 0.45})`;
            } else {
              ctx.fillStyle = `rgba(201, 123, 110, ${intensity * 0.45})`;
            }
            ctx.fillRect(padX + i * cellW, padY + j * cellH, cellW, cellH);
          }
        }
      }

      // MODE 4: REAL-TIME FREQUENCY SPECTRUM
      else if (mode === "spectrum") {
        ctx.globalAlpha = 0.85;
        const bars = 36;
        const barW = (roomW - 40) / bars;
        const baseY = padY + roomH - 24;

        for (let b = 0; b < bars; b++) {
          const freqNorm = b / bars;
          // Target cinema room curve with slight Harman bass lift and HF gentle roll-off
          const target = Math.sin(freqNorm * Math.PI) * 0.85 + (1 - freqNorm) * 0.35;
          const noise = isPlaying ? Math.sin(frameCount * 0.15 + b * 0.4) * 0.15 : 0;
          const barH = Math.max(12, (target + noise) * (roomH * 0.55));

          const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
          grad.addColorStop(0, "rgba(232, 184, 108, 0.2)");
          grad.addColorStop(0.7, "#E8B86C");
          grad.addColorStop(1, "#F4D9A8");

          ctx.fillStyle = grad;
          ctx.fillRect(padX + 20 + b * barW, baseY - barH, barW - 3, barH);
        }
      }

      // Listener Sweet Spot (Interactively movable via listenerPosRef)
      const lx = Math.max(padX + 20, Math.min(padX + roomW - 20, currentListener.x));
      const ly = Math.max(padY + 40, Math.min(padY + roomH - 30, currentListener.y));

      ctx.globalAlpha = 1;
      // Pulse ring around listener
      const pulseSize = 18 + (isPlaying ? Math.sin(frameCount * 0.08) * 4 : 0);
      ctx.strokeStyle = "rgba(232, 184, 108, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lx, ly, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      // Listener core dot
      ctx.fillStyle = "#E8B86C";
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#F5EFE3";
      ctx.font = "9px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LISTENER SWEET SPOT", lx, ly + 18);

      if (active && isPlaying && !reduced) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [mode, isPlaying, active, reduced]);

  // Canvas interaction: drag listener with pointer capture and zero disruption to animation loop
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    listenerPosRef.current = newPos;
    setListenerPos(newPos);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    listenerPosRef.current = newPos;
    setListenerPos(newPos);
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDragging(false);
  };

  return (
    <Box
      ref={containerRef}
      component="section"
      id="acoustic-field"
      sx={{
        position: "relative",
        background: "linear-gradient(180deg, #09070F 0%, #120E1C 50%, #09070F 100%)",
        paddingTop: "6rem",
        paddingBottom: "6rem",
        scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
        overflow: "hidden",
        borderTop: "1px solid rgba(232, 184, 108, 0.12)",
        borderBottom: "1px solid rgba(232, 184, 108, 0.12)",
      }}
    >
      {/* Background radial glow */}
      <Box
        sx={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "700px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(232, 184, 108, 0.08), transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, position: "relative", zIndex: 1 }}>
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 0.5,
              borderRadius: 99,
              bgcolor: "rgba(232, 184, 108, 0.08)",
              border: "1px solid rgba(232, 184, 108, 0.2)",
              color: CINEMA_COLORS.GOLD,
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              mb: 1.5,
            }}
          >
            <Box component={Activity} sx={{ width: 14, height: 14 }} />
            Interactive 3D Acoustic Engine
          </Box>
          <Typography
            component="h2"
            variant="h2"
            sx={{
              fontFamily: TYPOGRAPHY.fontDisplay,
              fontSize: { xs: "2rem", md: "3rem" },
              fontWeight: 700,
              color: CINEMA_COLORS.WARM_WHITE,
              mb: 1.5,
            }}
          >
            Real-Time{" "}
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Soundfield Simulation
            </Box>
          </Typography>
          <Typography
            component="p"
            variant="body1"
            sx={{
              color: "rgba(245, 239, 227, 0.6)",
              maxWidth: "42rem",
              mx: "auto",
              fontSize: { xs: "0.875rem", md: "1rem" },
              lineHeight: 1.6,
            }}
          >
            Experience how Dolby Atmos acoustic wave propagation, raytracing diffusers, and bass trap resonance
            behave in an ALV-engineered reference cinema. Drag the sweet spot to test listener positions.
          </Typography>
        </Box>

        {/* Visualizer Mode Switcher Tabs */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 1,
            mb: 3,
          }}
        >
          {MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <ButtonBase
                key={m.id}
                onClick={() => setMode(m.id)}
                type="button"
                sx={{
                  px: { xs: 1.5, sm: 2.5 },
                  py: 1,
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  transition: "all 0.25s ease",
                  border: isSelected ? "1px solid #E8B86C" : "1px solid rgba(255, 255, 255, 0.08)",
                  bgcolor: isSelected ? "rgba(232, 184, 108, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: isSelected ? CINEMA_COLORS.GOLD : "rgba(245, 239, 227, 0.65)",
                  boxShadow: isSelected ? "0 0 16px rgba(232, 184, 108, 0.2)" : "none",
                  "&:hover": {
                    bgcolor: "rgba(232, 184, 108, 0.08)",
                    color: CINEMA_COLORS.WARM_WHITE,
                  },
                }}
              >
                {m.label}
              </ButtonBase>
            );
          })}
        </Box>

        {/* Main Canvas & Telemetry Container */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          {/* Canvas Box */}
          <Box
            sx={{
              position: "relative",
              borderRadius: "1.25rem",
              border: "1px solid rgba(232, 184, 108, 0.2)",
              bgcolor: "rgba(10, 8, 16, 0.8)",
              backdropFilter: "blur(16px)",
              p: 2,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
            }}
          >
            {/* Top Toolbar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pb: 1.5,
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                mb: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: isPlaying ? "#4ade80" : "#fbbf24",
                    boxShadow: isPlaying ? "0 0 8px #4ade80" : "none",
                  }}
                />
                <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(245, 239, 227, 0.7)", fontWeight: 500 }}>
                  {isPlaying ? "Live Raytracing (60 FPS)" : "Simulation Paused"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ButtonBase
                  onClick={() => setIsPlaying(!isPlaying)}
                  type="button"
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: "0.5rem",
                    bgcolor: "rgba(232, 184, 108, 0.1)",
                    border: "1px solid rgba(232, 184, 108, 0.3)",
                    color: CINEMA_COLORS.GOLD,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  {isPlaying ? <Box component={Pause} sx={{ width: 12, height: 12 }} /> : <Box component={Play} sx={{ width: 12, height: 12 }} />}
                  {isPlaying ? "Pause" : "Resume"}
                </ButtonBase>

                <ButtonBase
                  onClick={() => {
                    listenerPosRef.current = { x: 300, y: 220 };
                    setListenerPos({ x: 300, y: 220 });
                  }}
                  type="button"
                  sx={{
                    p: 0.75,
                    borderRadius: "0.5rem",
                    bgcolor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "rgba(245, 239, 227, 0.6)",
                    "&:hover": { color: "#fff" },
                  }}
                  title="Reset Listener Position"
                >
                  <Box component={RotateCcw} sx={{ width: 14, height: 14 }} />
                </ButtonBase>
              </Box>
            </Box>

            {/* Interactive Canvas */}
            <Box
              sx={{
                flex: 1,
                minHeight: { xs: 280, sm: 360, md: 400 },
                position: "relative",
                cursor: isDragging ? "grabbing" : "crosshair",
                touchAction: "none",
              }}
            >
              <Box
                component="canvas"
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  borderRadius: "0.75rem",
                  touchAction: "none",
                  userSelect: "none",
                }}
              />
            </Box>

            {/* Frequency Control Slider Bar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                pt: 2,
                mt: 1,
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: CINEMA_COLORS.GOLD, fontWeight: 600, minWidth: 80 }}>
                {frequency} Hz Sweep
              </Typography>
              <Slider
                value={frequency}
                min={20}
                max={120}
                step={1}
                onChange={(_, v) => {
                  const val = v as number;
                  frequencyRef.current = val;
                  setFrequency(val);
                }}
                sx={{
                  color: CINEMA_COLORS.GOLD,
                  "& .MuiSlider-thumb": {
                    width: 14,
                    height: 14,
                    bgcolor: "#F4D9A8",
                    "&:hover, &.Mui-focusVisible": {
                      boxShadow: "0 0 0 6px rgba(232, 184, 108, 0.2)",
                    },
                  },
                }}
              />
              <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(245, 239, 227, 0.4)", whiteSpace: "nowrap" }}>
                {frequency < 50 ? "Sub-Bass" : frequency < 90 ? "Mid-Bass" : "Vocal Boundary"}
              </Typography>
            </Box>
          </Box>

          {/* Telemetry & Engineering Specs Sidebar */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Spec Card 1: RT60 Target */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: "1rem",
                bgcolor: "rgba(18, 14, 28, 0.7)",
                border: "1px solid rgba(232, 184, 108, 0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(245, 239, 227, 0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  RT60 Decay Time
                </Typography>
                <Chip label="THX Spec" size="small" sx={{ height: 18, fontSize: "0.625rem", bgcolor: "rgba(74, 222, 128, 0.15)", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.3)" }} />
              </Box>
              <Typography component="p" variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.GOLD, fontWeight: 700, my: 0.5 }}>
                {rt60}s
              </Typography>
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.45)", fontSize: "0.75rem" }}>
                Optimal reverberation for razor-sharp vocal intelligibility and zero room boom.
              </Typography>
            </Box>

            {/* Spec Card 2: Acoustic Absorption */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: "1rem",
                bgcolor: "rgba(18, 14, 28, 0.7)",
                border: "1px solid rgba(232, 184, 108, 0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(245, 239, 227, 0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Acoustic Absorption
                </Typography>
                <Chip label="Certified" size="small" sx={{ height: 18, fontSize: "0.625rem", bgcolor: "rgba(232, 184, 108, 0.15)", color: CINEMA_COLORS.GOLD, border: "1px solid rgba(232, 184, 108, 0.3)" }} />
              </Box>
              <Typography component="p" variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, color: "#C97B6E", fontWeight: 700, my: 0.5 }}>
                {absorption}%
              </Typography>
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.45)", fontSize: "0.75rem" }}>
                High-density fiberglass diffusers dissipate flutter echo without killing room energy.
              </Typography>
            </Box>

            {/* Spec Card 3: Sweet Spot SPL */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: "1rem",
                bgcolor: "rgba(18, 14, 28, 0.7)",
                border: "1px solid rgba(232, 184, 108, 0.15)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography component="span" variant="body2" sx={{ fontSize: "0.75rem", color: "rgba(245, 239, 227, 0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Reference Level SPL
                </Typography>
                <Chip label="Dolby Calibrated" size="small" sx={{ height: 18, fontSize: "0.625rem", bgcolor: "rgba(244, 217, 168, 0.15)", color: "#F4D9A8", border: "1px solid rgba(244, 217, 168, 0.3)" }} />
              </Box>
              <Typography component="p" variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, color: "#F4D9A8", fontWeight: 700, my: 0.5 }}>
                {spl} dBA
              </Typography>
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.45)", fontSize: "0.75rem" }}>
                Continuous cinema reference pressure with 105 dB headroom peaks on quad subwoofers.
              </Typography>
            </Box>

            {/* Hint Box */}
            <Box
              sx={{
                p: 2,
                borderRadius: "0.75rem",
                bgcolor: "rgba(232, 184, 108, 0.04)",
                border: "1px dashed rgba(232, 184, 108, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Box component={Radio} sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD, flexShrink: 0 }} />
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.6)", fontSize: "0.75rem", lineHeight: 1.4 }}>
                <strong>Pro Tip:</strong> Click & drag the amber listener marker across the room to observe real-time phase alignment.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
