"use client";

import { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import type { Gallery } from "./gallery-scene";
import { STUDIO, TYPE, FONT } from "./tokens";

/**
 * Hosts the WebGL gallery inside a sticky stage. Scroll progress across the
 * stage's scroll container is the only input; rendering is capped, paused
 * offscreen, and replaced by a static frame under reduced motion.
 */
export function GalleryCanvas({
  containerRef,
  stageRef,
  onProgress,
  onReady,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  stageRef: React.RefObject<HTMLElement | null>;
  onProgress?: (p: number) => void;
  onReady?: (ready: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  const progress = useRef(onProgress);
  progress.current = onProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!canvas || !container || !stage) return;

    let gallery: Gallery | null = null;
    let cancelled = false;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => reducedQuery.matches;

    // Import the scene lazily so three.js stays out of the initial payload.
    import("./gallery-scene").then(({ createGallery }) => {
      if (cancelled) return;
      gallery = createGallery(canvas, { reduced: reduced() });
      if (!gallery) {
        if (failedRef.current) failedRef.current.style.display = "flex";
        onReady?.(false);
        return;
      }
      onReady?.(true);
      update();
    });

    let frame = 0;
    let visible = true;

    function measure() {
      const rect = container!.getBoundingClientRect();
      const total = Math.max(1, container!.offsetHeight - stage!.offsetHeight);
      const p = Math.min(1, Math.max(0, -rect.top / total));
      return p;
    }

    let last = -1;
    function update() {
      frame = 0;
      const p = measure();
      if (Math.abs(p - last) < 0.0004) return;
      last = p;
      gallery?.setProgress(p);
      progress.current?.(p);
    }

    function queue() {
      if (!frame && visible) frame = requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver(
      entries => {
        visible = entries[0]?.isIntersecting ?? true;
        gallery?.setPaused(!visible);
        if (visible) queue();
      },
      { rootMargin: "80px" },
    );
    observer.observe(stage);

    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      gallery?.setPaused(hidden || !visible);
      if (!hidden && visible) queue();
    };

    const onReduced = () => gallery?.setReduced(reduced());

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReduced);
    queue();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReduced);
      gallery?.dispose();
      gallery = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, overflow: "hidden", bgcolor: STUDIO.plaster }}>
      <Box component="canvas" ref={canvasRef} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <Box
        ref={failedRef}
        sx={{
          display: "none",
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          px: 4,
          textAlign: "center",
        }}
      >
        <Typography sx={{ ...TYPE.label, color: STUDIO.slate, maxWidth: 320 }}>
          This exhibit is drawn in WebGL, which your browser has turned off. The notes below still describe every piece.
        </Typography>
      </Box>
    </Box>
  );
}