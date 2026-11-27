"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { ArrowDownward, ArrowOutward } from "@mui/icons-material";
import { keyframes } from "@emotion/react";
import { GalleryCanvas } from "./GalleryCanvas";
import { EXHIBITS } from "./content";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

const rise = keyframes`
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** alpha window with soft shoulders */
const window01 = (p: number, a: number, b: number, shoulder = 0.035) =>
  Math.min(smooth(clamp01((p - (a - shoulder)) / shoulder)), smooth(clamp01(((b + shoulder) - p) / shoulder)));

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
};

export function ExhibitsStage() {
  const showroomRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const placardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railFillRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const spans = EXHIBITS.map(e => e.span);
    void spans;

    const paint = (p: number) => {
      // hero recedes as the walk begins
      if (heroRef.current) {
        const a = 1 - smooth(clamp01((p - 0.012) / 0.062));
        heroRef.current.style.opacity = String(a);
        heroRef.current.style.transform = `translateY(${(1 - a) * -28}px)`;
        heroRef.current.style.pointerEvents = a < 0.2 ? "none" : "auto";
        heroRef.current.style.visibility = a < 0.01 ? "hidden" : "visible";
      }
      // Each exhibit owns an explicit label window: fade in [a,b], out [c,d].
      // Between windows the wall is bare — the camera is walking to the next
      // room — so a label is never up while its object is out of frame.
      const idx = EXHIBITS.findIndex(exhibit => p >= exhibit.label[1] && p < exhibit.label[3]);
      if (railFillRef.current) railFillRef.current.style.transform = p < 1 && window.innerWidth < 900 ? `scaleX(${Math.max(0.02, p)})` : `scaleY(${Math.max(0.02, p)})`;
      EXHIBITS.forEach((exhibit, i) => {
        const el = placardRefs.current[i];
        if (!el) return;
        const [a, b, c, d] = exhibit.label;
        const alpha = smooth(clamp01((p - a) / Math.max(0.001, b - a))) * (1 - smooth(clamp01((p - c) / Math.max(0.001, d - c))));
        el.style.opacity = String(alpha);
        el.style.transform = `translateY(${(1 - alpha) * 18}px)`;
        el.style.visibility = alpha < 0.01 ? "hidden" : "visible";
        el.style.pointerEvents = alpha < 0.4 ? "none" : "auto";
      });
      setActive(current => (current === idx ? current : idx));
      if (counterRef.current) {
        const total = spans.length;
        // between labels, keep showing the room just left behind
        const passed = idx >= 0 ? idx : EXHIBITS.reduce((best, exhibit, i) => (p >= exhibit.label[0] ? i : best), 0);
        const shown = Math.min(total, Math.max(1, passed + 1));
        counterRef.current.textContent = `${String(shown).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      }
      if (captionRef.current) {
        captionRef.current.style.opacity = String(1 - smooth(clamp01((p - 0.9) / 0.08)));
      }
    };

    const measure = () => {
      const container = showroomRef.current;
      const stage = stageRef.current;
      if (!container || !stage) return 0;
      const rect = container.getBoundingClientRect();
      const total = Math.max(1, container.offsetHeight - stage.offsetHeight);
      return clamp01(-rect.top / total);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint(measure());
      });
    };

    paint(measure());
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <Box
        ref={showroomRef}
        id="exhibits"
        sx={{
          position: "relative",
          // 100svh of hero + 3 × ~105svh of walking
          height: { xs: "420svh", md: "400svh" },
          scrollMarginTop: 0,
        }}
      >
        <Box
          ref={stageRef}
          sx={{
            position: "sticky",
            top: 0,
            height: "100svh",
            overflow: "hidden",
            bgcolor: STUDIO.plaster,
          }}
        >
          <GalleryCanvas containerRef={showroomRef} stageRef={stageRef} onReady={setReady} />

          {/* the hero: an opening statement over the establishing view */}
          <Box
            ref={heroRef}
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: { xs: "flex-end", md: "center" },
              pt: { xs: 8, md: "calc(74px + 3svh)" },
              pb: { xs: "64px", sm: "72px", md: 5 },
              pl: { xs: 2.5, sm: 4, lg: 6 },
              pr: { xs: 2.5, sm: 4, md: 12, lg: 13 },
              boxSizing: "border-box",
              pointerEvents: "auto",
              "@media (min-width: 600px) and (max-height: 480px)": {
                alignItems: "center",
                pt: "58px",
                pb: "48px",
                pr: 4,
              },
            }}
          >
            <Box
              sx={{
                ml: { xs: 0, md: "auto" },
                width: { xs: "100%", md: "44%", lg: "41%", xl: "40%" },
                maxWidth: { xs: "100%", sm: 580, md: 440, lg: 510, xl: 580 },
                my: { md: "auto" },
                "@media (min-width: 600px) and (max-height: 480px)": {
                  ml: "auto",
                  width: "48%",
                  maxWidth: 380,
                },
              }}
            >
              <Typography
                component="h1"
                sx={{
                  ...TYPE.hero,
                  color: STUDIO.graphite,
                  textWrap: "balance",
                  "& span": { display: "block" },
                  "@media (min-width: 600px) and (max-height: 480px)": {
                    fontSize: "clamp(1.65rem, 3.6vw, 2.35rem)",
                  },
                }}
              >
                <Box component="span" sx={{ animation: `${rise} 900ms ${EASE} both`, animationDelay: "80ms" }}>
                  A room that
                </Box>
                <Box component="span" sx={{ animation: `${rise} 900ms ${EASE} both`, animationDelay: "200ms" }}>
                  sounds like
                </Box>
                <Box component="span" sx={{ animation: `${rise} 900ms ${EASE} both`, animationDelay: "320ms", color: STUDIO.brass }}>
                  nowhere else.
                </Box>
              </Typography>
              <Typography
                sx={{
                  ...TYPE.placard,
                  color: STUDIO.slate,
                  fontSize: { xs: "0.92rem", sm: "1rem" },
                  lineHeight: 1.55,
                  mt: 2,
                  maxWidth: "42ch",
                  animation: `${rise} 900ms ${EASE} both`,
                  animationDelay: "380ms",
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              >
                Udaipur&apos;s bespoke studio for private home theaters, Sony &amp; JVC 4K laser projectors, Denon &amp; Marantz speakers, cafe &amp; lounge pro audio, RGBW lighting, and Zigbee 3.0 automation.
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1.5,
                  mt: { xs: 3.5, md: 5 },
                  animation: `${rise} 900ms ${EASE} both`,
                  animationDelay: "440ms",
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              >
                <Button
                  onClick={() => scrollToId("visit")}
                  variant="contained"
                  disableElevation
                  endIcon={<ArrowOutward sx={{ fontSize: "1rem !important" }} />}
                  sx={{
                    ...TYPE.label,
                    bgcolor: STUDIO.graphite,
                    color: STUDIO.chalk,
                    px: 3,
                    py: 1.3,
                    borderRadius: "2px",
                    letterSpacing: "0.06em",
                    transition: `transform 220ms ${EASE}, background-color 220ms ${EASE}, box-shadow 220ms ${EASE}`,
                    "&:hover": { bgcolor: STUDIO.ink, transform: "translateY(-1px)", boxShadow: "0 6px 20px rgba(22,24,26,0.14)" },
                    "&:active": { transform: "scale(0.98)" },
                  }}
                >
                  Schedule consultation
                </Button>
                <Button
                  onClick={() => scrollToId("collection")}
                  variant="text"
                  sx={{
                    ...TYPE.label,
                    color: STUDIO.graphite,
                    px: 2,
                    py: 1.3,
                    letterSpacing: "0.06em",
                    transition: `color 220ms ${EASE}`,
                    "&:hover": { color: STUDIO.brass, bgcolor: "transparent" },
                    "&:active": { transform: "scale(0.98)" },
                  }}
                >
                  Explore collection
                </Button>
              </Box>
            </Box>
          </Box>

          {/* exhibit placards: the museum labels for each object */}
          {EXHIBITS.map((exhibit, i) => (
            <Box
              key={exhibit.id}
              data-placard={exhibit.id}
              ref={(el: HTMLDivElement | null) => {
                placardRefs.current[i] = el;
              }}
              sx={{
                position: "absolute",
                left: { xs: "20px", sm: "32px", lg: "48px" },
                bottom: { xs: "62px", sm: "68px", md: "40px", lg: "48px" },
                width: { xs: "calc(100% - 40px)", sm: 390, md: 420, lg: 440 },
                maxHeight: { xs: "36svh", sm: "42svh", md: "54svh" },
                overflowY: "auto",
                overscrollBehavior: "contain",
                pr: { md: 1 },
                opacity: 0,
                visibility: "hidden",
                willChange: "opacity, transform",
                pt: { xs: 1.5, md: 2 },
                borderTop: `1px solid ${STUDIO.hairStrong}`,
                "@media (min-width: 600px) and (max-height: 480px)": {
                  bottom: "48px",
                  maxHeight: "calc(100svh - 115px)",
                  width: 340,
                  pt: 1,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1 }}>
                <Typography component="span" sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.78rem" }}>
                  {exhibit.index}
                </Typography>
                <Typography component="span" sx={{ ...TYPE.label, color: STUDIO.slate, fontWeight: 500 }}>
                  {exhibit.room}
                </Typography>
              </Box>
              <Typography component="h2" sx={{ ...TYPE.exhibit, color: STUDIO.graphite }}>
                {exhibit.title}
              </Typography>
              <Typography sx={{ fontFamily: FONT.text, fontSize: "1.02rem", fontStyle: "italic", color: STUDIO.slate, mt: 0.75, lineHeight: 1.4 }}>
                {exhibit.line}
              </Typography>
              {/* The long-form body is a desktop reading; on a phone it would
                  push the fact rows past the fold, so the label stays terse. */}
              <Typography sx={{ ...TYPE.placard, color: "rgba(22,24,26,0.78)", mt: 1.5, display: { xs: "none", sm: "block" } }}>
                {exhibit.body}
              </Typography>
              <Box component="dl" sx={{ m: 0, mt: 2, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.45rem 1.2rem" }}>
                {exhibit.facts.map(fact => (
                  <Box key={fact.k} sx={{ display: "contents" }}>
                    <Typography component="dt" sx={{ ...TYPE.label, color: STUDIO.mist, fontWeight: 500, fontSize: "0.66rem", pt: "2px" }}>
                      {fact.k}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, fontFamily: FONT.text, fontSize: "0.86rem", color: STUDIO.graphite, lineHeight: 1.45 }}>
                      {fact.v}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}

          {/* stage chrome: counter, rail, caption */}
          <Box
            sx={{
              position: "absolute",
              right: { xs: "20px", sm: "32px", lg: "48px" },
              // on phones & portrait tablets the label sits in the lower band,
              // so the rail sits cleanly along the bottom edge below the placard
              top: { xs: "auto", md: "50%" },
              bottom: { xs: "14px", sm: "18px", md: "auto" },
              transform: { md: "translateY(-50%)" },
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: { xs: 1, md: 1.5 },
              isolation: "isolate",
              px: { xs: 0, md: 1.1 },
              py: { xs: 0.5, md: 1.5 },
              borderRadius: { xs: 0, md: "999px" },
              bgcolor: { xs: "transparent", md: "rgba(234,231,221,0.82)" },
              backdropFilter: { xs: "none", md: "blur(8px)" },
              border: { xs: "none", md: `1px solid ${STUDIO.hair}` },
            }}
          >
            <Box component="span" ref={counterRef} sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.68rem", writingMode: { md: "vertical-rl" }, transform: { md: "rotate(180deg)" } }}>
              01 / 03
            </Box>
            <Box
              component="nav"
              aria-label="Exhibits"
              sx={{
                position: "relative",
                width: { xs: 96, md: 2 },
                height: { xs: 2, md: 148 },
                bgcolor: STUDIO.hair,
                borderRadius: 2,
              }}
            >
              <Box
                ref={railFillRef}
                sx={{
                  position: "absolute",
                  inset: 0,
                  bgcolor: STUDIO.brass,
                  transformOrigin: { xs: "left", md: "top" },
                  transform: { xs: "scaleX(0.02)", md: "scaleY(0.02)" },
                  borderRadius: 2,
                }}
              />
              {EXHIBITS.map((exhibit, i) => (
                <Box
                  key={exhibit.id}
                  component="a"
                  href="#exhibits"
                  aria-label={`Show exhibit ${exhibit.index}: ${exhibit.title}`}
                  onClick={event => {
                    event.preventDefault();
                    const container = showroomRef.current;
                    const stage = stageRef.current;
                    if (!container || !stage) return;
                    const total = container.offsetHeight - stage.offsetHeight;
                    // land at the middle of the label window: the object is framed there
                    const frame = (exhibit.label[1] + exhibit.label[2]) / 2;
                    const target = container.offsetTop + total * frame;
                    window.scrollTo({ top: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                  }}
                  sx={{
                    position: "absolute",
                    left: { xs: `${((exhibit.label[1] + exhibit.label[2]) / 2) * 100}%`, md: "50%" },
                    top: { xs: "50%", md: `${((exhibit.label[1] + exhibit.label[2]) / 2) * 100}%` },
                    width: 13,
                    height: 13,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: `1px solid ${STUDIO.hairStrong}`,
                    bgcolor: active === i ? STUDIO.brass : STUDIO.plaster,
                    transition: `background-color 260ms ${EASE}, transform 260ms ${EASE}`,
                    "&:hover": { transform: "translate(-50%, -50%) scale(1.25)" },
                    "&:focus-visible": { outline: `2px solid ${STUDIO.brass}`, outlineOffset: 3 },
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              position: "absolute",
              left: "50%",
              bottom: { xs: "2.5svh", md: "3svh" },
              transform: "translateX(-50%)",
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box component="span" ref={captionRef} sx={{ ...TYPE.label, color: STUDIO.mist, fontWeight: 500, fontSize: "0.64rem" }}>
              Scroll to walk the room
            </Box>
            <ArrowDownward sx={{ fontSize: "0.85rem", color: STUDIO.mist }} />
          </Box>

          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(22,24,26,0.07) 100%)",
              opacity: ready ? 1 : 0,
              transition: `opacity 900ms ${EASE}`,
            }}
          />
        </Box>
      </Box>
    </>
  );
}