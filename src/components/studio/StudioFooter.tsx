"use client";

import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import { ArrowUpward } from "@mui/icons-material";
import { UDAIPUR_PILLARS } from "@/lib/udaipur-pillars";
import { NAV, STUDIO_INFO } from "./content";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

export function StudioFooter() {
  const year = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Box component="footer" sx={{ bgcolor: STUDIO.plaster, borderTop: `1px solid ${STUDIO.hairStrong}`, "@media print": { display: "none" } }}>
      <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr 1fr" },
            gap: { xs: 4, md: 6 },
            pb: 5,
            borderBottom: `1px solid ${STUDIO.hair}`,
          }}
        >
          {/* Column 1: Brand + Consistent Udaipur NAP */}
          <Box>
            <Box component={Link} href="/" sx={{ textDecoration: "none", display: "inline-block" }}>
              <Typography
                sx={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontStretch: "114%",
                  fontSize: { xs: "1.8rem", md: "2.3rem" },
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: STUDIO.graphite,
                }}
              >
                ALVStore
              </Typography>
            </Box>
            <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.88rem", mt: 1.25, maxWidth: "44ch" }}>
              Udaipur&apos;s audio-visual, home theater, pro cafe &amp; lounge speaker, 4K laser projection, RGBW lighting &amp; Zigbee 3.0 automation studio since 2009.
            </Typography>
            <Box sx={{ mt: 2.25, display: "grid", gap: 0.5 }}>
              <Typography sx={{ ...TYPE.placard, color: STUDIO.graphite, fontSize: "0.84rem" }}>
                {STUDIO_INFO.address}
              </Typography>
              <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.84rem" }}>
                <Box
                  component="a"
                  href={STUDIO_INFO.phoneHref}
                  sx={{ color: STUDIO.graphite, textDecoration: "none", "&:hover": { color: STUDIO.brass } }}
                >
                  {STUDIO_INFO.phone}
                </Box>
                {" · "}
                <Box
                  component="a"
                  href={STUDIO_INFO.emailHref}
                  sx={{ color: STUDIO.graphite, textDecoration: "none", "&:hover": { color: STUDIO.brass } }}
                >
                  {STUDIO_INFO.email}
                </Box>
              </Typography>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", mt: 0.4 }}>
                {STUDIO_INFO.hours} · {STUDIO_INFO.hoursSunday}
              </Typography>
            </Box>
          </Box>

          {/* Column 2: Udaipur Solution Pillars */}
          <Box component="nav" aria-label="Udaipur Solutions">
            <Typography
              sx={{
                ...TYPE.label,
                color: STUDIO.brass,
                fontSize: "0.66rem",
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                mb: 1.5,
              }}
            >
              Udaipur Solutions
            </Typography>
            <Box sx={{ display: "grid", gap: 1 }}>
              {UDAIPUR_PILLARS.map((pillar) => (
                <Box
                  key={pillar.slug}
                  component={Link}
                  href={`/${pillar.slug}`}
                  sx={{
                    fontFamily: FONT.text,
                    fontSize: "0.94rem",
                    color: STUDIO.graphite,
                    textDecoration: "none",
                    transition: `color 200ms ${EASE}`,
                    "&:hover": { color: STUDIO.brass },
                  }}
                >
                  {pillar.serviceName}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Column 3: Studio Navigation */}
          <Box component="nav" aria-label="Footer navigation">
            <Typography
              sx={{
                ...TYPE.label,
                color: STUDIO.brass,
                fontSize: "0.66rem",
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                mb: 1.5,
              }}
            >
              Studio
            </Typography>
            <Box sx={{ display: "grid", gap: 1 }}>
              {NAV.map((item) => (
                <Box
                  key={item.href}
                  component={Link}
                  href={item.href}
                  sx={{
                    ...TYPE.label,
                    color: STUDIO.graphite,
                    textDecoration: "none",
                    fontSize: "0.74rem",
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
                  fontSize: "0.74rem",
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
                  fontSize: "0.74rem",
                  transition: `color 200ms ${EASE}`,
                  "&:hover": { color: STUDIO.brass },
                }}
              >
                Staff sign-in
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, pt: 3 }}>
          <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontWeight: 500, fontSize: "0.64rem" }}>
            © {year} ALVStore · Sector 11, Hiran Magri, Udaipur. All rights reserved.
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
