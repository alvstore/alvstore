"use client";

import Link from "next/link";
import { ArrowOutward } from "@mui/icons-material";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedPage } from "@/components/mui";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { VisitSection } from "@/components/studio/VisitSection";
import { StudioFooter } from "@/components/studio/StudioFooter";
import { STUDIO_INFO } from "@/components/studio/content";
import { EASE, FONT, STUDIO, TYPE } from "@/components/studio/tokens";
import {
  UDAIPUR_CORRIDORS,
  UDAIPUR_PILLAR_MAP,
  type UdaipurSolutionPillar,
} from "@/lib/udaipur-pillars";

const WHATSAPP = "https://wa.me/919887601200";

export default function UdaipurSolutionScreen({
  pillar,
}: {
  pillar: UdaipurSolutionPillar;
}) {
  const reduced = useReducedMotion();
  const related = pillar.relatedSlugs
    .map((slug) => UDAIPUR_PILLAR_MAP[slug])
    .filter(Boolean);

  return (
    <AnimatedPage sx={{ bgcolor: STUDIO.plaster }}>
      <StudioHeader />

      <Box component="main" sx={{ pt: { xs: 10, md: 13 } }}>
        {/* 1. Above-the-Fold Hero & Answer-First Citability Summary */}
        <Box
          component="section"
          sx={{
            mx: "auto",
            maxWidth: 1520,
            px: { xs: 2.5, sm: 4, lg: 6 },
            pb: { xs: 6, md: 9 },
          }}
        >
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.6,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1.25,
                mb: { xs: 2.5, md: 3.5 },
              }}
            >
              <Box
                component={Link}
                href="/"
                sx={{
                  ...TYPE.label,
                  color: STUDIO.slate,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  "&:hover": { color: STUDIO.brass },
                }}
              >
                ALVStore Studio
              </Box>
              <Typography
                component="span"
                sx={{ ...TYPE.label, color: STUDIO.mist }}
              >
                /
              </Typography>
              <Typography
                component="span"
                sx={{
                  ...TYPE.label,
                  color: STUDIO.brass,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                {pillar.eyebrow}
              </Typography>
            </Box>

            <Typography
              component="h1"
              sx={{
                ...TYPE.hero,
                fontSize: "clamp(2.25rem, 4.9vw, 4.35rem)",
                color: STUDIO.graphite,
                maxWidth: "22ch",
                textWrap: "balance",
              }}
            >
              {pillar.h1Main}
              <Box
                component="span"
                sx={{
                  display: "block",
                  fontFamily: FONT.text,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: "0.84em",
                  letterSpacing: "-0.015em",
                  color: STUDIO.slate,
                  mt: 0.4,
                }}
              >
                {pillar.h1Accent}
              </Box>
            </Typography>
          </Box>

          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" },
              gap: { xs: 3.5, lg: 6 },
              alignItems: "start",
            }}
          >
            <Box
              sx={{
                p: { xs: 2.5, md: 3.5 },
                bgcolor: STUDIO.chalk,
                border: `1px solid ${STUDIO.hairStrong}`,
                borderRadius: "3px",
              }}
            >
              <Typography
                sx={{
                  ...TYPE.label,
                  color: STUDIO.brass,
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  mb: 1.25,
                }}
              >
                Sector 11, Hiran Magri · Udaipur Studio Overview
              </Typography>
              <Typography
                sx={{
                  fontFamily: FONT.text,
                  fontSize: { xs: "1.05rem", md: "1.14rem" },
                  lineHeight: 1.65,
                  color: STUDIO.graphite,
                }}
              >
                {pillar.answerFirstSummary}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1.25,
                  mt: 3,
                }}
              >
                <Button
                  component="a"
                  href="#visit"
                  variant="contained"
                  disableElevation
                  endIcon={<ArrowOutward sx={{ fontSize: "0.95rem !important" }} />}
                  sx={{
                    ...TYPE.label,
                    bgcolor: STUDIO.graphite,
                    color: STUDIO.chalk,
                    borderRadius: "2px",
                    minHeight: 40,
                    px: 2.5,
                    transition: `transform 200ms ${EASE}, background-color 200ms ${EASE}`,
                    "&:hover": {
                      bgcolor: STUDIO.ink,
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  Book Udaipur Site Survey
                </Button>
                <Button
                  component="a"
                  href={`${WHATSAPP}?text=${encodeURIComponent(
                    `Hello ALVStore Udaipur, I'd like a consultation for ${pillar.navLabel}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  endIcon={<ArrowOutward sx={{ fontSize: "0.9rem !important" }} />}
                  sx={{
                    ...TYPE.label,
                    borderRadius: "2px",
                    minHeight: 40,
                    px: 2.25,
                    borderColor: STUDIO.hairStrong,
                    color: STUDIO.verdigris,
                    "&:hover": {
                      borderColor: STUDIO.verdigris,
                      bgcolor: "rgba(78,105,96,0.06)",
                    },
                  }}
                >
                  WhatsApp Studio
                </Button>
                <Button
                  component={Link}
                  href="/#collection"
                  variant="text"
                  sx={{
                    ...TYPE.label,
                    minHeight: 40,
                    color: STUDIO.slate,
                    "&:hover": { color: STUDIO.brass, bgcolor: "transparent" },
                  }}
                >
                  Interactive Room Planner
                </Button>
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                borderTop: `2px solid ${STUDIO.graphite}`,
                bgcolor: "rgba(246,244,238,0.55)",
              }}
            >
              <Typography
                sx={{
                  ...TYPE.label,
                  color: STUDIO.brass,
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  mb: 1.25,
                }}
              >
                Where We Serve Across Udaipur
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.1,
                }}
              >
                {pillar.udaipurZones.map((zone) => (
                  <Typography
                    key={zone}
                    sx={{
                      ...TYPE.placard,
                      fontSize: "0.92rem",
                      color: STUDIO.graphite,
                      pl: 1.5,
                      borderLeft: `2px solid ${STUDIO.brass}`,
                    }}
                  >
                    {zone}
                  </Typography>
                ))}
              </Box>
              <Box
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: `1px solid ${STUDIO.hair}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.6rem",
                      color: STUDIO.mist,
                    }}
                  >
                    Studio Phone
                  </Typography>
                  <Typography
                    component="a"
                    href={STUDIO_INFO.phoneHref}
                    sx={{
                      fontFamily: FONT.text,
                      fontSize: "0.95rem",
                      color: STUDIO.graphite,
                      textDecoration: "none",
                      "&:hover": { color: STUDIO.brass },
                    }}
                  >
                    {STUDIO_INFO.phone}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.6rem",
                      color: STUDIO.mist,
                    }}
                  >
                    Hours
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: FONT.text,
                      fontSize: "0.95rem",
                      color: STUDIO.slate,
                    }}
                  >
                    {STUDIO_INFO.hours}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 2. Udaipur Local Engineering Challenges */}
        <Box
          component="section"
          sx={{
            bgcolor: STUDIO.chalk,
            borderTop: `1px solid ${STUDIO.hairStrong}`,
            borderBottom: `1px solid ${STUDIO.hairStrong}`,
          }}
        >
          <Box
            sx={{
              mx: "auto",
              maxWidth: 1520,
              px: { xs: 2.5, sm: 4, lg: 6 },
              py: { xs: 7, md: 10 },
            }}
          >
            <Typography
              sx={{
                ...TYPE.label,
                color: STUDIO.brass,
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1,
              }}
            >
              Local Engineering Discipline
            </Typography>
            <Typography
              component="h2"
              sx={{
                ...TYPE.section,
                color: STUDIO.graphite,
                mb: { xs: 4, md: 5 },
              }}
            >
              {pillar.challengesTitle}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: { xs: 3, md: 4 },
              }}
            >
              {pillar.challenges.map((item, idx) => (
                <Box
                  key={item.title}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    bgcolor: STUDIO.plaster,
                    border: `1px solid ${STUDIO.hair}`,
                    borderRadius: "3px",
                  }}
                >
                  <Typography
                    sx={{
                      ...TYPE.label,
                      color: STUDIO.brass,
                      fontSize: "0.64rem",
                      mb: 1,
                    }}
                  >
                    0{idx + 1}
                  </Typography>
                  <Typography
                    component="h3"
                    sx={{
                      fontFamily: FONT.display,
                      fontSize: "1.12rem",
                      fontWeight: 600,
                      color: STUDIO.graphite,
                      mb: 1,
                      lineHeight: 1.25,
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    sx={{
                      ...TYPE.placard,
                      color: STUDIO.slate,
                      fontSize: "0.94rem",
                      lineHeight: 1.62,
                    }}
                  >
                    {item.body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* 3. Specifications Comparison Matrix (GEO + Search Clarity Table) */}
        <Box
          component="section"
          sx={{
            mx: "auto",
            maxWidth: 1520,
            px: { xs: 2.5, sm: 4, lg: 6 },
            py: { xs: 7, md: 10 },
          }}
        >
          <Box sx={{ maxWidth: "60ch", mb: 4 }}>
            <Typography
              sx={{
                ...TYPE.label,
                color: STUDIO.brass,
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1,
              }}
            >
              Architecture Tiers &amp; Specs
            </Typography>
            <Typography
              component="h2"
              sx={{ ...TYPE.section, color: STUDIO.graphite }}
            >
              {pillar.specTableTitle}
            </Typography>
          </Box>

          <TableContainer
            sx={{
              bgcolor: STUDIO.chalk,
              border: `1px solid ${STUDIO.hairStrong}`,
              borderRadius: "3px",
            }}
          >
            <Table aria-label={pillar.specTableTitle}>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: "rgba(22,24,26,0.03)",
                    "& th": {
                      ...TYPE.label,
                      color: STUDIO.graphite,
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      py: 2,
                      borderBottom: `1px solid ${STUDIO.hairStrong}`,
                    },
                  }}
                >
                  <TableCell>System Tier</TableCell>
                  <TableCell>Core Configuration</TableCell>
                  <TableCell>Recommended Room / Venue</TableCell>
                  <TableCell>Key Engineering Highlights</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pillar.specs.map((row) => (
                  <TableRow
                    key={row.label}
                    sx={{
                      "& td": {
                        fontFamily: FONT.text,
                        fontSize: "0.95rem",
                        color: STUDIO.slate,
                        py: 2.25,
                        verticalAlign: "top",
                        borderBottom: `1px solid ${STUDIO.hair}`,
                      },
                      "&:last-child td": { borderBottom: "none" },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontFamily: `${FONT.display} !important`,
                        fontWeight: 600,
                        color: `${STUDIO.graphite} !important`,
                      }}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell sx={{ color: `${STUDIO.graphite} !important` }}>
                      {row.configuration}
                    </TableCell>
                    <TableCell>{row.recommendedFor}</TableCell>
                    <TableCell>{row.keyHighlights}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Supported Systems & Udaipur Coverage Strip */}
          <Box
            sx={{
              mt: { xs: 5, md: 6 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" },
              gap: 4,
            }}
          >
            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                bgcolor: "rgba(246,244,238,0.72)",
                border: `1px solid ${STUDIO.hair}`,
                borderRadius: "3px",
              }}
            >
              <Typography
                component="h3"
                sx={{
                  ...TYPE.label,
                  color: STUDIO.brass,
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  mb: 2,
                }}
              >
                Hardware &amp; Protocol Ecosystem
              </Typography>
              <Box sx={{ display: "grid", gap: 1.4 }}>
                {pillar.systemsOrBrands.map((sys) => (
                  <Box
                    key={sys.name}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "190px 1fr" },
                      gap: 1,
                      pb: 1.2,
                      borderBottom: `1px solid ${STUDIO.hair}`,
                      "&:last-child": { pb: 0, borderBottom: "none" },
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: FONT.display,
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: STUDIO.graphite,
                      }}
                    >
                      {sys.name}
                    </Typography>
                    <Typography
                      sx={{
                        ...TYPE.placard,
                        fontSize: "0.88rem",
                        color: STUDIO.slate,
                      }}
                    >
                      {sys.note}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                bgcolor: "rgba(246,244,238,0.72)",
                border: `1px solid ${STUDIO.hair}`,
                borderRadius: "3px",
              }}
            >
              <Typography
                component="h3"
                sx={{
                  ...TYPE.label,
                  color: STUDIO.brass,
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  mb: 2,
                }}
              >
                Udaipur &amp; Mewar Local Service Corridors
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {UDAIPUR_CORRIDORS.map((corridor) => (
                  <Box
                    key={corridor}
                    component="span"
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.64rem",
                      color: STUDIO.graphite,
                      px: 1.15,
                      py: 0.65,
                      bgcolor: STUDIO.chalk,
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "2px",
                    }}
                  >
                    {corridor}
                  </Box>
                ))}
              </Box>
              <Typography
                sx={{
                  ...TYPE.placard,
                  fontSize: "0.86rem",
                  color: STUDIO.slate,
                  mt: 2.25,
                }}
              >
                On-site room dimension inspection, acoustic measurement, conduit layout coordination, and calibration support available across Udaipur division &amp; pan-India.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 4. Hub-and-Spoke Related Udaipur Pages + Technical FAQs */}
        <Box
          component="section"
          sx={{
            bgcolor: STUDIO.chalk,
            borderTop: `1px solid ${STUDIO.hairStrong}`,
          }}
        >
          <Box
            sx={{
              mx: "auto",
              maxWidth: 1520,
              px: { xs: 2.5, sm: 4, lg: 6 },
              py: { xs: 7, md: 10 },
            }}
          >
            <Typography
              sx={{
                ...TYPE.label,
                color: STUDIO.brass,
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1,
              }}
            >
              Questions &amp; Planning Notes
            </Typography>
            <Typography
              component="h2"
              sx={{
                ...TYPE.section,
                color: STUDIO.graphite,
                mb: { xs: 4, md: 5 },
              }}
            >
              Frequently asked in Udaipur
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 3,
              }}
            >
              {pillar.faqs.map((faq) => (
                <Box
                  key={faq.q}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    bgcolor: STUDIO.plaster,
                    border: `1px solid ${STUDIO.hair}`,
                    borderRadius: "3px",
                  }}
                >
                  <Typography
                    component="h3"
                    sx={{
                      fontFamily: FONT.text,
                      fontSize: "1.12rem",
                      fontWeight: 500,
                      color: STUDIO.graphite,
                      mb: 1,
                      lineHeight: 1.35,
                    }}
                  >
                    {faq.q}
                  </Typography>
                  <Typography
                    sx={{
                      ...TYPE.placard,
                      fontSize: "0.9rem",
                      color: STUDIO.slate,
                      lineHeight: 1.62,
                    }}
                  >
                    {faq.a}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Related Pillars Internal Linking */}
            <Box sx={{ mt: { xs: 6, md: 8 }, pt: 5, borderTop: `1px solid ${STUDIO.hairStrong}` }}>
              <Typography
                sx={{
                  ...TYPE.label,
                  color: STUDIO.mist,
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  mb: 2.5,
                }}
              >
                Explore Integrated Udaipur Systems
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                  gap: 2.5,
                }}
              >
                {related.map((rel) => (
                  <Box
                    key={rel.slug}
                    component={Link}
                    href={`/${rel.slug}`}
                    sx={{
                      p: 2.5,
                      bgcolor: STUDIO.plaster,
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "3px",
                      textDecoration: "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 1,
                      transition: `transform 220ms ${EASE}, border-color 220ms ${EASE}`,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: STUDIO.brass,
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        ...TYPE.label,
                        color: STUDIO.brass,
                        fontSize: "0.62rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {rel.eyebrow}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: FONT.display,
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        color: STUDIO.graphite,
                      }}
                    >
                      {rel.serviceName}
                    </Typography>
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        mt: 0.5,
                        color: STUDIO.graphite,
                      }}
                    >
                      <Typography sx={{ ...TYPE.label, fontSize: "0.66rem" }}>
                        View specifications
                      </Typography>
                      <ArrowOutward sx={{ fontSize: "0.85rem !important", color: STUDIO.brass }} />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        <VisitSection defaultRoom={pillar.defaultRoomType} />
      </Box>

      <StudioFooter />
    </AnimatedPage>
  );
}
