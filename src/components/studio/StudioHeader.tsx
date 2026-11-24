"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Divider, Drawer, IconButton, Typography } from "@mui/material";
import { Close, Menu } from "@mui/icons-material";
import { NAV, STUDIO_INFO } from "./content";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

const linkSx = {
  ...TYPE.label,
  position: "relative",
  color: STUDIO.graphite,
  textDecoration: "none",
  py: 0.5,
  "&::after": {
    content: '""',
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "1px",
    bgcolor: STUDIO.brass,
    transform: "scaleX(0)",
    transformOrigin: "left",
    transition: `transform 320ms ${EASE}`,
  },
  "@media (hover: hover)": { "&:hover::after": { transform: "scaleX(1)" } },
  "&:focus-visible": { outline: `1px solid ${STUDIO.brass}`, outlineOffset: 3 },
} as const;

export function StudioHeader({ overStage = false }: { overStage?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0);
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Box
      component="header"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: scrolled ? "rgba(234,231,221,0.92)" : "linear-gradient(180deg, rgba(234,231,221,0.88) 0%, rgba(234,231,221,0.45) 65%, transparent 100%)",
        backdropFilter: scrolled ? "saturate(1.1) blur(14px)" : "blur(6px)",
        borderBottom: `1px solid ${scrolled ? STUDIO.hair : "transparent"}`,
        transition: `background 420ms ${EASE}, border-color 420ms ${EASE}`,
        "@media print": { display: "none" },
      }}
    >
      <Box
        sx={{
          mx: "auto",
          maxWidth: 1520,
          px: { xs: 2.5, sm: 4, lg: 6 },
          height: { xs: 60, md: 68 },
          display: "flex",
          alignItems: "center",
          gap: { xs: 2, md: 5 },
          color: overStage ? STUDIO.graphite : STUDIO.graphite,
        }}
      >
        <Box component={Link} href="/" aria-label="ALVStore, home" sx={{ display: "flex", alignItems: "baseline", gap: 1.2, textDecoration: "none", color: STUDIO.graphite }}>
          <Typography component="span" sx={{ fontFamily: FONT.display, fontWeight: 700, fontStretch: "112%", fontSize: "1.18rem", letterSpacing: "-0.01em", lineHeight: 1 }}>
            ALVStore
          </Typography>
          <Box component="span" sx={{ width: "1px", height: 13, bgcolor: STUDIO.hairStrong }} />
          <Typography component="span" sx={{ ...TYPE.label, color: STUDIO.slate, fontWeight: 500, fontSize: "0.64rem", letterSpacing: "0.06em" }}>
            Cinema Studio
          </Typography>
        </Box>

        <Box component="nav" aria-label="Studio" sx={{ ml: "auto", display: { xs: "none", md: "flex" }, alignItems: "center", gap: 3.5 }}>
          {NAV.map(item => (
            <Box key={item.href} component="a" href={item.href} sx={linkSx}>
              {item.label}
            </Box>
          ))}
          <Box component={Link} href="/contact" sx={{ ...linkSx, color: STUDIO.graphite }}>
            Contact
          </Box>
        </Box>

        <IconButton
          aria-label="Open site navigation"
          onClick={() => setOpen(true)}
          sx={{ ml: { xs: "auto", md: 0 }, display: { md: "none" }, color: STUDIO.graphite, borderRadius: 1.5, "&:focus-visible": { outline: `2px solid ${STUDIO.brass}` } }}
        >
          <Menu fontSize="small" />
        </IconButton>
      </Box>

      {/* Subtle Scroll Reading Progress Indicator */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "1.5px",
          bgcolor: STUDIO.brass,
          transform: `scaleX(${progress})`,
          transformOrigin: "left",
          transition: "transform 60ms linear, opacity 300ms ease",
          opacity: scrolled ? 1 : 0,
          pointerEvents: "none",
          "@media (prefers-reduced-motion: reduce)": { display: "none" },
        }}
      />

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: "86vw", sm: 380 }, bgcolor: STUDIO.chalk, backgroundImage: "none", p: 0 } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, height: 60, borderBottom: `1px solid ${STUDIO.hair}` }}>
          <Typography sx={{ ...TYPE.label, color: STUDIO.slate }}>Where to go</Typography>
          <IconButton aria-label="Close site navigation" onClick={() => setOpen(false)} sx={{ color: STUDIO.graphite }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
        <Box component="nav" aria-label="Site navigation" sx={{ px: 3, py: 2 }}>
          {[...NAV, { label: "Contact", href: "/contact" }].map(item => (
            <Box key={item.href} component={Link} href={item.href} onClick={() => setOpen(false)} sx={{ display: "block", py: 2, textDecoration: "none", borderBottom: `1px solid ${STUDIO.hair}` }}>
              <Typography sx={{ ...TYPE.exhibit, color: STUDIO.graphite, fontSize: "1.4rem" }}>{item.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ px: 3, py: 2, mt: "auto" }}>
          <Divider sx={{ borderColor: STUDIO.hair, mb: 2 }} />
          <Typography sx={{ ...TYPE.placard, color: STUDIO.slate }}>{STUDIO_INFO.hours}</Typography>
          <Typography component="a" href={STUDIO_INFO.phoneHref} sx={{ ...TYPE.placard, color: STUDIO.graphite, display: "block", mt: 0.5, textDecoration: "none" }}>
            {STUDIO_INFO.phone}
          </Typography>
        </Box>
      </Drawer>
    </Box>
  );
}