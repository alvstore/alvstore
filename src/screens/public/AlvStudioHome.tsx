"use client";

import Link from "next/link";
import { ArrowOutward } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { AnimatedPage } from "@/components/mui";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { ExhibitsStage } from "@/components/studio/ExhibitsStage";
import { CollectionSection } from "@/components/studio/CollectionSection";
import { ProcessSection } from "@/components/studio/ProcessSection";
import { VisitSection } from "@/components/studio/VisitSection";
import { StudioFooter } from "@/components/studio/StudioFooter";
import { EASE, STUDIO, TYPE, FONT } from "@/components/studio/tokens";
import { UDAIPUR_CORRIDORS, UDAIPUR_PILLARS } from "@/lib/udaipur-pillars";

const BRANDS = [
  { name: "Denon", badge: "DEN", role: "AV Receivers & Multi-Room Audio", tag: "Spatial AVR" },
  { name: "Marantz", badge: "MAR", role: "Reference Cinema Separates", tag: "Reference Audio" },
  { name: "JBL", badge: "JBL", role: "High-SPL Architectural Speakers", tag: "Cinema Sound" },
  { name: "JBL Synthesis", badge: "SYN", role: "Master Reference Theatre Systems", tag: "Synthesis Lab" },
  { name: "Arcam", badge: "ARC", role: "Audiophile Class G Amplification", tag: "Class G Power" },
  { name: "Polk Audio", badge: "POLK", role: "Dynamic Balance Cinema Sound", tag: "Dynamic Audio" },
  { name: "Bowers & Wilkins", badge: "B&W", role: "Reference Studio Loudspeakers", tag: "Studio Reference" },
  { name: "KEF", badge: "KEF", role: "Uni-Q Architectural Audio", tag: "Uni-Q Array" },
  { name: "Sony", badge: "SONY", role: "Native 4K SXRD Laser Cinema", tag: "Laser 4K" },
  { name: "JVC", badge: "JVC", role: "D-ILA Laser Optical Engines", tag: "D-ILA Optics" },
] as const;

const containerMotion = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * The public studio: a scroll-driven gallery of the pieces ALV builds
 * rooms around, then the collection, after-sales service and the consultation.
 */
export default function AlvStudioHome() {
  return (
    <AnimatedPage sx={{ bgcolor: STUDIO.plaster }}>
      <Box data-static-speaker-evolution>
        <StudioHeader overStage />
        <Box component="main">
          <ExhibitsStage />

          {/* Animated Studio Statement Section */}
          <Box
            component="section"
            aria-label="Studio statement"
            sx={{
              bgcolor: STUDIO.plaster,
              borderTop: `1px solid ${STUDIO.hairStrong}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              component={motion.div}
              variants={containerMotion}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              sx={{
                mx: "auto",
                maxWidth: 1520,
                px: { xs: 2.5, sm: 4, lg: 6 },
                py: { xs: 8, md: 12 },
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 2.4fr" },
                gap: { xs: 4, md: 8 },
              }}
            >
              {/* Left Column: Heritage & Metrics */}
              <Box component={motion.div} variants={itemMotion} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: STUDIO.brass,
                      boxShadow: `0 0 0 3px rgba(156,123,73,0.22)`,
                    }}
                  />
                  <Typography sx={{ ...TYPE.label, color: STUDIO.brass, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.68rem" }}>
                    Established 2009
                  </Typography>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr" }, gap: { xs: 2.5, md: 3 }, pt: { md: 1 } }}>
                  <Box>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Experience
                    </Typography>
                    <Typography sx={{ fontFamily: FONT.display, fontSize: "1.4rem", fontWeight: 600, color: STUDIO.graphite, lineHeight: 1.2, mt: 0.4 }}>
                      16+ Years
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.82rem", mt: 0.2 }}>
                      Cinema engineering &amp; acoustic design
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Reach
                    </Typography>
                    <Typography sx={{ fontFamily: FONT.display, fontSize: "1.4rem", fontWeight: 600, color: STUDIO.graphite, lineHeight: 1.2, mt: 0.4 }}>
                      Pan-India
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.82rem", mt: 0.2 }}>
                      On-site surveys, engineering &amp; acoustic calibration nationwide
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Right Column: Statement & Brand Ecosystem */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Box component={motion.div} variants={itemMotion}>
                  <Typography
                    sx={{
                      fontFamily: FONT.text,
                      fontSize: { xs: "1.35rem", sm: "1.65rem", md: "2.05rem" },
                      lineHeight: 1.38,
                      fontWeight: 400,
                      color: STUDIO.graphite,
                      letterSpacing: "-0.01em",
                      textWrap: "balance",
                    }}
                  >
                    <Box component="strong" sx={{ fontWeight: 600, color: STUDIO.graphite }}>
                      From Sector 11, Udaipur
                    </Box>
                    , we design, supply and calibrate private home theaters, native 4K laser projectors,
                    hi-fi and commercial speakers, multi-zone cafe and lounge sound systems, RGBW lighting,
                    and Zigbee 3.0 automation. Every room pairs Denon &amp; Marantz amplification with measured acoustics.
                  </Typography>
                </Box>

                <Box
                  component={motion.div}
                  variants={itemMotion}
                  sx={{
                    pt: 3.5,
                    borderTop: `1px solid ${STUDIO.hairStrong}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                  }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography component="h2" sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      Authorised Cinema Partners
                    </Typography>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem" }}>
                      Official Indian distribution &amp; direct warranty
                    </Typography>
                  </Box>

                  {/* Brand Cards Grid: 10 partners with unified monogram emblem badges */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
                      gap: 1.5,
                    }}
                  >
                    {BRANDS.map(brand => (
                      <Box
                        key={brand.name}
                        component={motion.div}
                        variants={itemMotion}
                        sx={{
                          p: { xs: 1.75, sm: 2 },
                          bgcolor: "rgba(246,244,238,0.72)",
                          border: `1px solid ${STUDIO.hair}`,
                          borderRadius: "3px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          minHeight: { xs: 140, sm: 148 },
                          position: "relative",
                          transition: `transform 240ms ${EASE}, border-color 240ms ${EASE}, background-color 240ms ${EASE}, box-shadow 240ms ${EASE}`,
                          cursor: "default",
                          "&:hover": {
                            transform: "translateY(-3px)",
                            borderColor: STUDIO.brass,
                            bgcolor: STUDIO.chalk,
                            boxShadow: "0 8px 24px rgba(156,123,73,0.12)",
                            "& [data-brand-badge]": {
                              borderColor: STUDIO.brass,
                              bgcolor: "rgba(156,123,73,0.15)",
                              color: STUDIO.brass,
                              boxShadow: "0 0 12px rgba(156,123,73,0.25)",
                            },
                            "& h3": { color: STUDIO.brass },
                          },
                        }}
                      >
                        {/* Top: Uniform Pattern Emblem Badge + Tag */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                          <Box
                            data-brand-badge="true"
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              border: `1px solid ${STUDIO.hairStrong}`,
                              bgcolor: "rgba(156,123,73,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: `all 220ms ${EASE}`,
                              flexShrink: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                fontFamily: FONT.display,
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                color: STUDIO.graphite,
                                lineHeight: 1,
                              }}
                            >
                              {brand.badge}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              ...TYPE.label,
                              fontSize: "0.55rem",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: STUDIO.brass,
                              px: 0.7,
                              py: 0.2,
                              borderRadius: "2px",
                              bgcolor: "rgba(156,123,73,0.08)",
                              lineHeight: 1.2,
                            }}
                          >
                            {brand.tag}
                          </Typography>
                        </Box>

                        {/* Bottom: Brand Name & Specialty */}
                        <Box sx={{ mt: "auto" }}>
                          <Typography
                            component="h3"
                            sx={{
                              fontFamily: FONT.display,
                              fontSize: { xs: "0.95rem", sm: "1.02rem" },
                              fontWeight: 600,
                              color: STUDIO.graphite,
                              transition: `color 200ms ${EASE}`,
                              m: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {brand.name}
                          </Typography>
                          <Typography
                            sx={{
                              ...TYPE.placard,
                              color: STUDIO.slate,
                              fontSize: "0.72rem",
                              mt: 0.4,
                              lineHeight: 1.3,
                            }}
                          >
                            {brand.role}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Typography
                    sx={{
                      ...TYPE.placard,
                      color: STUDIO.slate,
                      fontSize: "0.85rem",
                      mt: 1,
                      lineHeight: 1.5,
                    }}
                  >
                    Flagship engineering lab · Turnkey pan-India installation · Lifetime after-sales care on every room.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Udaipur Solutions & Verticals Grid (Hub-and-Spoke Pillar Architecture) */}
          <Box
            component="section"
            id="solutions"
            aria-label="Udaipur audio visual, lighting and automation solutions"
            sx={{
              bgcolor: STUDIO.plaster,
              borderTop: `1px solid ${STUDIO.hairStrong}`,
              scrollMarginTop: 44,
            }}
          >
            <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 8, md: 11 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
                  gap: { xs: 3, md: 8 },
                  alignItems: "end",
                  mb: { xs: 4, md: 6 },
                }}
              >
                <Box>
                  <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", mb: 1.25 }}>
                    Udaipur Specialties · Five Pillars
                  </Typography>
                  <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.graphite, textWrap: "balance" }}>
                    Engineered for homes,
                    <Box component="span" sx={{ display: "block", fontFamily: FONT.text, fontStyle: "italic", fontWeight: 400, fontSize: "0.86em" }}>
                      cafes, lounges &amp; villas.
                    </Box>
                  </Typography>
                </Box>
                <Typography sx={{ ...TYPE.lead, color: STUDIO.slate, maxWidth: "56ch" }}>
                  Explore dedicated guides for every system we architect in Udaipur — from marble-treated Dolby Atmos rooms and 4K laser screens to IP65 rooftop lounge audio and zero-chase Zigbee 3.0 RGBW lighting control.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                  gap: 2.5,
                }}
              >
                {UDAIPUR_PILLARS.map((pillar, idx) => (
                  <Box
                    key={pillar.slug}
                    component={Link}
                    href={`/${pillar.slug}`}
                    sx={{
                      p: { xs: 2.5, md: 3 },
                      bgcolor: STUDIO.chalk,
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "3px",
                      textDecoration: "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 1.5,
                      transition: `transform 220ms ${EASE}, border-color 220ms ${EASE}, box-shadow 220ms ${EASE}`,
                      "&:hover": {
                        transform: "translateY(-3px)",
                        borderColor: STUDIO.brass,
                        boxShadow: "0 10px 28px rgba(156,123,73,0.12)",
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
                        <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          0{idx + 1} · {pillar.navLabel}
                        </Typography>
                        <ArrowOutward sx={{ fontSize: "0.95rem !important", color: STUDIO.brass }} />
                      </Box>
                      <Typography component="h3" sx={{ fontFamily: FONT.display, fontSize: "1.18rem", fontWeight: 600, color: STUDIO.graphite, lineHeight: 1.25, mb: 1 }}>
                        {pillar.serviceName}
                      </Typography>
                      <Typography sx={{ ...TYPE.placard, fontSize: "0.9rem", color: STUDIO.slate, lineHeight: 1.55 }}>
                        {pillar.seoDescription}
                      </Typography>
                    </Box>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.66rem", pt: 1.25, borderTop: `1px solid ${STUDIO.hair}` }}>
                      Read Udaipur specifications &amp; room tiers →
                    </Typography>
                  </Box>
                ))}
                <Box
                  component={Link}
                  href="/contact"
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    bgcolor: STUDIO.graphite,
                    color: STUDIO.chalk,
                    border: `1px solid ${STUDIO.graphite}`,
                    borderRadius: "3px",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 1.5,
                    transition: `transform 220ms ${EASE}, border-color 220ms ${EASE}, box-shadow 220ms ${EASE}`,
                    "&:hover": {
                      transform: "translateY(-3px)",
                      borderColor: STUDIO.brass,
                      boxShadow: "0 10px 28px rgba(22,24,26,0.22)",
                    },
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
                      <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        06 · Experience Studio
                      </Typography>
                      <ArrowOutward sx={{ fontSize: "0.95rem !important", color: STUDIO.brass }} />
                    </Box>
                    <Typography component="h3" sx={{ fontFamily: FONT.display, fontSize: "1.18rem", fontWeight: 600, color: STUDIO.chalk, lineHeight: 1.25, mb: 1 }}>
                      Book a Sector 11 Studio Audition or On-Site Survey
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, fontSize: "0.9rem", color: "rgba(246,244,238,0.78)", lineHeight: 1.55 }}>
                      Share your villa blueprint, cafe terrace dimensions, or lighting layout with our Udaipur engineering desk for a free written proposal.
                    </Typography>
                  </Box>
                  <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.66rem", pt: 1.25, borderTop: `1px solid ${STUDIO.hairLight}` }}>
                    Schedule Udaipur studio visit →
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.08em", mr: 1 }}>
                  Serving Udaipur &amp; Mewar:
                </Typography>
                {UDAIPUR_CORRIDORS.map((zone) => (
                  <Box
                    key={zone}
                    component="span"
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.62rem",
                      color: STUDIO.slate,
                      px: 1,
                      py: 0.45,
                      bgcolor: "rgba(246,244,238,0.7)",
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "2px",
                    }}
                  >
                    {zone}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <CollectionSection />
          <ProcessSection />

          {/* Architectural Planning Questions & Engineering Reference (Answer-first for clarity & search citability) */}
          <Box
            component="section"
            id="engineering-notes"
            aria-label="Engineering specifications and planning answers"
            sx={{ bgcolor: STUDIO.plaster, borderTop: `1px solid ${STUDIO.hairStrong}`, borderBottom: `1px solid ${STUDIO.hairStrong}` }}
          >
            <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 7, md: 10 } }}>
              <Box sx={{ maxWidth: "56ch", mb: { xs: 4, md: 6 } }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", mb: 1.25 }}>
                  Engineering Reference
                </Typography>
                <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.graphite, textWrap: "balance" }}>
                  Planning a private cinema
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                  gap: { xs: 3, md: 4 },
                }}
              >
                {[
                  {
                    q: "What room dimensions work for a dedicated home theater?",
                    a: "Dedicated ALVStore rooms start around 14 × 11 ft for single-row 5.1.2 cinemas up to 110 inches diagonal, while 18 × 14 ft and larger spaces comfortably support dual-row stadium risers, acoustically transparent 135–180 inch screens, dual subwoofers, and 7.2.4 Dolby Atmos arrays.",
                  },
                  {
                    q: "Which projectors, AV receivers, and speakers are supported?",
                    a: "ALVStore is an authorised Indian integration partner for Sony SXRD and JVC D-ILA native 4K laser projectors, Denon AVC and Marantz Cinema separates, Arcam Class G amplification, and JBL Synthesis, Bowers & Wilkins, KEF, and Polk Audio loudspeakers with official warranty coverage.",
                  },
                  {
                    q: "Why does ALVStore calibrate with Dirac Live and ISF tools?",
                    a: "Raw speakers interact heavily with walls, ceilings, and glass surfaces. Our engineers pair measured broadband acoustic absorption and bass trapping with Dirac Live room correction and ISF color calibration so dialogue stays anchored to the screen and bass stays tight across every seat.",
                  },
                  {
                    q: "Does ALVStore handle projects and after-sales outside Udaipur?",
                    a: "Yes. From our flagship studio at Sector 11, Hiran Magri in Udaipur, Rajasthan, our team conducts pan-India site surveys across Udaipur division, Rajasthan, Delhi NCR, Gujarat, and Maharashtra, managing CAD blueprints, turnkey acoustic installation, and periodic optical care.",
                  },
                  {
                    q: "Do you install permanent sound and lighting systems for cafes, rooftops & lounges?",
                    a: "Yes. We design concealed 70V/100V background music networks, weatherproof IP65 rooftop speaker arrays, high-SPL club subwoofers, and directional sound spill control alongside synchronized DMX/RGBW bar and terrace lighting across Shobhagpura, Fatehsagar, and Pichola.",
                  },
                  {
                    q: "Can RGBW architectural lights and Zigbee 3.0 automation be installed without rewiring?",
                    a: "Yes. Compact Zigbee 3.0 smart dimmer modules fit inside existing switch boxes without breaking painted or sandstone heritage walls, coordinating 24V RGBCW cove lights, curtains, and home theater AV scenes locally with zero cloud lag.",
                  },
                ].map(entry => (
                  <Box
                    key={entry.q}
                    sx={{
                      p: { xs: 2.5, md: 3 },
                      bgcolor: "rgba(246,244,238,0.72)",
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "3px",
                    }}
                  >
                    <Typography component="h3" sx={{ fontFamily: FONT.text, fontSize: "1.14rem", fontWeight: 500, color: STUDIO.graphite, mb: 1 }}>
                      {entry.q}
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.9rem", lineHeight: 1.6 }}>
                      {entry.a}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <VisitSection />
        </Box>
        <StudioFooter />
      </Box>
    </AnimatedPage>
  );
}
