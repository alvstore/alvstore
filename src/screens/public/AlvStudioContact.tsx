"use client";

import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { ArrowOutward } from "@mui/icons-material";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedPage } from "@/components/mui";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { VisitSection } from "@/components/studio/VisitSection";
import { StudioFooter } from "@/components/studio/StudioFooter";
import { STUDIO_INFO } from "@/components/studio/content";
import { STUDIO, TYPE, FONT } from "@/components/studio/tokens";

const CHANNELS = [
  {
    label: "Phone",
    value: STUDIO_INFO.phone,
    note: "Mon – Sat, 10:00 – 20:00. If we are in a room, leave a message and we will call back the same day.",
    href: STUDIO_INFO.phoneHref,
    cta: "Call",
  },
  {
    label: "Email",
    value: STUDIO_INFO.email,
    note: "Include room dimensions, drawings, or photos. Estimates and acoustic plans come back in writing, free.",
    href: STUDIO_INFO.emailHref,
    cta: "Write",
  },
  {
    label: "WhatsApp",
    value: "+91 98876 01200",
    note: "Quickest for home theater consultations, 4K projector advice, and Denon & Marantz system quotes.",
    href: "https://wa.me/919887601200",
    cta: "Message",
  },
  {
    label: "Studio & Experience Room",
    value: "Sector 11, Udaipur",
    note: "Shop No. 2, 229, Alok School Road, Sector 11, Hiran Magri, Udaipur. Demos and acoustic sessions by appointment.",
    href: STUDIO_INFO.mapsUrl,
    cta: "Directions on Maps",
  },
];

export default function AlvStudioContact() {
  const reduced = useReducedMotion();

  return (
    <AnimatedPage sx={{ bgcolor: STUDIO.plaster }}>
      <StudioHeader />
      <Box component="main" sx={{ pt: { xs: 10, md: 14 } }}>
        <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, pb: { xs: 6, md: 8 } }}>
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Box component={Link} href="/" sx={{ ...TYPE.label, color: STUDIO.slate, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.75, mb: { xs: 3, md: 5 }, "&:hover": { color: STUDIO.brass } }}>
              <ArrowOutward sx={{ fontSize: "0.9rem !important", transform: "rotate(-90deg)" }} />
              The gallery
            </Box>
            <Typography component="h1" sx={{ ...TYPE.hero, fontSize: "clamp(2.4rem, 5.4vw, 4.6rem)", color: STUDIO.graphite, maxWidth: "16ch", textWrap: "balance" }}>
              Talk to the people
              <Box component="span" sx={{ display: "block", fontFamily: FONT.text, fontStyle: "italic", fontWeight: 400, fontSize: "0.8em", letterSpacing: "-0.015em", color: STUDIO.slate }}>
                who build the room.
              </Box>
            </Typography>
          </Box>

          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
            sx={{
              mt: { xs: 5, md: 8 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
              borderTop: `1px solid ${STUDIO.hairStrong}`,
            }}
          >
            {CHANNELS.map((channel, i) => (
              <Box
                key={channel.label}
                component="a"
                href={channel.href}
                target={channel.href.startsWith("http") ? "_blank" : undefined}
                rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  py: { xs: 3.5, md: 4 },
                  px: { xs: 0, sm: 3, lg: i === 0 ? 0 : 3.5 },
                  borderBottom: { xs: `1px solid ${STUDIO.hair}`, lg: "none" },
                  borderLeft: {
                    xs: "none",
                    sm: i % 2 === 0 ? "none" : `1px solid ${STUDIO.hair}`,
                    lg: i === 0 ? "none" : `1px solid ${STUDIO.hair}`,
                  },
                  textDecoration: "none",
                  color: STUDIO.graphite,
                  transition: "background-color 260ms ease, transform 260ms ease",
                  "&:hover": { bgcolor: "rgba(22,24,26,0.025)", transform: "translateY(-2px)" },
                  "&:focus-visible": { outline: `2px solid ${STUDIO.brass}`, outlineOffset: -2 },
                }}
              >
                <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.66rem" }}>{channel.label}</Typography>
                <Typography sx={{ fontFamily: FONT.text, fontSize: { xs: "1.3rem", md: "1.5rem" }, color: STUDIO.graphite, lineHeight: 1.25 }}>{channel.value}</Typography>
                <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.92rem", flexGrow: 1 }}>{channel.note}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
                  <Typography sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.68rem" }}>{channel.cta}</Typography>
                  <ArrowOutward sx={{ fontSize: "0.9rem !important", color: STUDIO.brass }} />
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reduced ? 0 : 0.65, delay: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            sx={{ mt: { xs: 5, md: 7 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 4, md: 8 } }}
          >
            <Box>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", mb: 1 }}>Studio &amp; engineering office</Typography>
              <Typography sx={{ fontFamily: FONT.text, fontSize: "1.15rem", color: STUDIO.graphite, lineHeight: 1.5 }}>{STUDIO_INFO.address}</Typography>
              <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, mt: 1.5, maxWidth: "42ch" }}>
                Flagship engineering studio located in Udaipur, Rajasthan with pan-India deployment. In-person cinema consultations, room blueprints,
                acoustic treatment planning, and dedicated equipment staging.
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", mb: 1 }}>In-home consultation &amp; after-sales</Typography>
              <Typography sx={{ fontFamily: FONT.text, fontSize: "1.15rem", color: STUDIO.graphite, lineHeight: 1.5 }}>
                Site surveys &amp; ongoing calibration
              </Typography>
              <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, mt: 1.5, maxWidth: "42ch" }}>
                We survey your room's physical dimensions, ambient light, and wall reflections before you buy.
                Dirac Live calibration, 4K projector optical maintenance, and warranty support provided pan-India.
              </Typography>
            </Box>
          </Box>
        </Box>
        <VisitSection />
      </Box>
      <StudioFooter />
    </AnimatedPage>
  );
}