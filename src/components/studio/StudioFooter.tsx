"use client";

import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import { ArrowUpward } from "@mui/icons-material";
import { NAV } from "./content";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

export function StudioFooter() {
  const year = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Box component="footer" sx={{ bgcolor: STUDIO.plaster, borderTop: `1px solid ${STUDIO.hairStrong}`, "@media print": { display: "none" } }}>
      <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 5, md: 7 } }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 4, pb: 4, borderBottom: `1px solid ${STUDIO.hair}` }}>
          <Box>
            <Box component={Link} href="/" sx={{ textDecoration: "none", display: "inline-block" }}>
              <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontStretch: "114%", fontSize: { xs: "1.8rem", md: "2.4rem" }, lineHeight: 1, letterSpacing: "-0.02em", color: STUDIO.graphite }}>
                ALVStore
              </Typography>
            </Box>
            <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.86rem", mt: 1, maxWidth: "42ch" }}>
              Bespoke private cinemas, native 4K laser projection &amp; architectural acoustics · Nationwide installation &amp; calibration.
            </Typography>
          </Box>

          <Box component="nav" aria-label="Footer navigation" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 2.5, sm: 4 } }}>
            {NAV.map(item => (
              <Box
                key={item.href}
                component="a"
                href={item.href}
                sx={{
                  ...TYPE.label,
                  color: STUDIO.graphite,
                  textDecoration: "none",
                  fontSize: "0.72rem",
                  transition: `color 200ms ${EASE}`,
                  "&:hover": { color: STUDIO.brass },
                }}
              >
                {item.label}
              </Box>
            ))}
            <Box
              component={Link}
              href="/contact"
              sx={{
                ...TYPE.label,
                color: STUDIO.graphite,
                textDecoration: "none",
                fontSize: "0.72rem",
                transition: `color 200ms ${EASE}`,
                "&:hover": { color: STUDIO.brass },
              }}
            >
              Contact
            </Box>
            <Box
              component={Link}
              href="/login"
              sx={{
                ...TYPE.label,
                color: STUDIO.slate,
                textDecoration: "none",
                fontSize: "0.72rem",
                transition: `color 200ms ${EASE}`,
                "&:hover": { color: STUDIO.brass },
              }}
            >
              Staff sign-in
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, pt: 3 }}>
          <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontWeight: 500, fontSize: "0.64rem" }}>
            © {year} ALVStore. All rights reserved.
          </Typography>
          <Button
            onClick={scrollToTop}
            variant="text"
            endIcon={<ArrowUpward sx={{ fontSize: "0.85rem !important" }} />}
            sx={{
              ...TYPE.label,
              color: STUDIO.slate,
              fontSize: "0.64rem",
              p: 0,
              minWidth: "auto",
              transition: `color 200ms ${EASE}`,
              "&:hover": { color: STUDIO.brass, bgcolor: "transparent" },
            }}
          >
            Back to top
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
