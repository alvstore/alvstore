"use client";

import { scrollToSection } from "@/lib/scroll";
import { Box, ButtonBase, Chip, Typography } from "@mui/material";
import { MotionSection, mergeSx } from "@/components/mui";
import { useState } from "react";
import { Monitor, Volume2, Armchair, Sparkles, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";

const ROOM_SIZES = [
  { id: "small", label: "Media Den", desc: "120 – 180 sqft", icon: "🏠", rt60: "0.22s" },
  { id: "medium", label: "Private Cinema", desc: "200 – 400 sqft", icon: "🏡", rt60: "0.28s" },
  { id: "large", label: "Grand Estate Hall", desc: "450 – 800+ sqft", icon: "🏰", rt60: "0.32s" },
];

const BUDGETS = [
  { id: "basic", label: "₹3L – ₹6L", tier: "Essential High-Fi" },
  { id: "premium", label: "₹8L – ₹18L", tier: "Signature Theater" },
  { id: "ultra", label: "₹20L – ₹50L+", tier: "Bespoke Ultra Reference" },
];

const SETUPS = [
  { id: "stereo", label: "5.1.2 Dolby Atmos", desc: "5 Bed + 1 Sub + 2 In-Ceiling Heights" },
  { id: "atmos", label: "7.2.4 THX Surround", desc: "7 Bed + Dual Subs + 4 In-Ceiling Heights" },
  { id: "cinema", label: "9.4.6 Flagship DCI", desc: "9 Bed + Quad Subs + 6 Zenith Overhead Channels" },
];

interface Config {
  room: string;
  budget: string;
  setup: string;
}

const RECOMMENDATIONS: Record<
  string,
  {
    title: string;
    features: string[];
    estimate: string;
    gear: string;
  }
> = {
  // Small Room (120 - 180 sqft)
  "small-basic-stereo": {
    title: "Compact 5.1.2 Atmos Media Den",
    features: [
      "75″ Sony BRAVIA XR 4K Mini-LED Display",
      "KEF In-Wall LCR + Dual Ceiling Height Speakers",
      "Denon 7.2 Ch 8K Ultra-HD AV Receiver",
      "Precision Suede Acoustic Absorption Panels (4x)",
      "Smart Lighting Scene Controller",
    ],
    estimate: "₹3.5L – ₹5.2L",
    gear: "Denon AVR-X2800H + KEF Architectural Series",
  },
  "small-basic-atmos": {
    title: "Studio Reference 7.1 Atmos",
    features: [
      "100″ Motorized Ambient Light Rejecting (ALR) Screen",
      "Optoma 4K Laser Cinema Projector",
      "7.1 Architectural Audio System with Powered Sub",
      "Custom Timber Bass Traps & Diffuser Slats",
    ],
    estimate: "₹4.8L – ₹6L",
    gear: "Optoma CinemaX + Marantz Stereo 70s",
  },
  "small-basic-cinema": {
    title: "Intimate Private Screening Room",
    features: [
      "110″ Fixed Zero-Edge Acoustically Transparent Screen",
      "4K Ultra-Short Throw Laser Engine",
      "5.2.2 Discrete In-Wall Dolby Atmos Transducers",
      "Sound Isolation Door & Decoupled Floor",
    ],
    estimate: "₹5.5L – ₹6.5L",
    gear: "Epson Pro Cinema + SVS Sealed Sub",
  },
  "small-premium-stereo": {
    title: "Audiophile Studio 5.2.2 Suite",
    features: [
      "85″ Sony BRAVIA Master Series OLED Display",
      "KEF Reference In-Wall LCR + In-Ceiling Heights",
      "Marantz Cinema 50 9.4 Ch AV Receiver",
      "Custom Timber Quadratic Diffusers & Bass Traps",
      "Lutron Intelligent Lighting Integration",
    ],
    estimate: "₹8L – ₹11L",
    gear: "Marantz Cinema 50 + KEF Reference Series",
  },
  "small-premium-atmos": {
    title: "Compact THX Reference 7.2.4 Cinema",
    features: [
      "110″ Fixed Zero-Edge 4K Laser Projector System",
      "Bowers & Wilkins CT700 Architectural Array",
      "Dual SVS 12″ Balanced Powered Subwoofers",
      "RT60 0.22s Studio Wall & Ceiling Absorption",
    ],
    estimate: "₹10L – ₹15L",
    gear: "Anthem MRX 740 + B&W CT-700 Series",
  },
  "small-premium-cinema": {
    title: "Bespoke Screening Salon",
    features: [
      "120″ 4K Ultra-Short Throw Laser Projection",
      "7.2.4 Dolby Atmos Timbre-Matched Transducers",
      "Acoustic Decoupled Floating Wall Treatment",
      "Motorized Top-Grain Leather Recliners for 4",
    ],
    estimate: "₹12L – ₹17L",
    gear: "Sony 4K UST + Parasound Amplification",
  },
  "small-ultra-stereo": {
    title: "Executive Mastering Lounge",
    features: [
      "98″ Sony Master Series QD-OLED Display",
      "Bowers & Wilkins 800 Series Diamond Monitors",
      "McIntosh Pure Class A/B Audiophile Power",
      "Calibrated Acoustic Diffusers & Floating Floor",
    ],
    estimate: "₹20L – ₹28L",
    gear: "McIntosh MC255 + B&W 804 D4 Array",
  },
  "small-ultra-atmos": {
    title: "Ultra Reference Studio Screening Suite",
    features: [
      "120″ Micro-Perf Woven 4K Laser Cinema",
      "Trinnov Altitude 16 Spatial Audio Processor",
      "KEF Ci-Reference Extreme In-Wall 7.4.4 Array",
      "Double-Stud STC 65 Sound Isolation Enclosure",
    ],
    estimate: "₹24L – ₹35L",
    gear: "Trinnov Altitude 16 + KEF Extreme Reference",
  },
  "small-ultra-cinema": {
    title: "Private VIP Screening Sanctum",
    features: [
      "130″ 2.35:1 Anamorphic Curved 4K Laser Cinema",
      "9.4.4 Discrete Channels with Quad Corner Subs",
      "D-BOX Haptic Actuator Cinema Seats (4-Seat)",
      "Crestron 1-Touch Architectural Automation",
    ],
    estimate: "₹28L – ₹42L",
    gear: "Barco Residential + Wisdom Audio Array",
  },

  // Medium Room (200 - 400 sqft)
  "medium-basic-stereo": {
    title: "Signature Family Media Cinema",
    features: [
      "100″ Motorized Ambient Light Rejecting Screen",
      "Sony 4K Laser Projection System",
      "5.2.2 Architectural Dolby Atmos System",
      "Acoustic Fabric Wall Panels & Suede Baffles",
    ],
    estimate: "₹4.5L – ₹6.5L",
    gear: "Denon AVR-X3800H + KEF Architectural",
  },
  "medium-basic-atmos": {
    title: "Immersive 7.1.4 Dolby Atmos Theater",
    features: [
      "120″ Fixed Frame Acoustically Transparent Screen",
      "Epson Pro Cinema 4K Laser Optical Engine",
      "7.1.4 In-Wall & In-Ceiling Transducers",
      "Acoustic Timber Corner Bass Traps",
    ],
    estimate: "₹5.8L – ₹7.8L",
    gear: "Marantz Cinema 60 + SVS Dual Subs",
  },
  "medium-basic-cinema": {
    title: "Dedicated Cinema Room (Essential)",
    features: [
      "130″ High-Gain Zero-Edge Woven Screen",
      "Optoma 4K Cinema Laser Engine",
      "7.2.4 Discrete Surround Soundfield",
      "Motorized Blackout Drapes & Step Lighting",
    ],
    estimate: "₹6.8L – ₹8.8L",
    gear: "Marantz Cinema 50 + KEF Ci Series",
  },
  "medium-premium-stereo": {
    title: "Signature 7.2.4 Atmos Cinema Suite",
    features: [
      "135″ 4K Micro-Perf Woven Acoustically Transparent Screen",
      "Sony Native 4K SXRD Laser Projector",
      "Bowers & Wilkins CT700 Series LCR & Surrounds",
      "Dual SVS 12″ High-Output Powered Subwoofers",
      "Room-Tuned Fabric Acoustic System with RT60 < 0.28s",
      "Lutron Wireless Motorized Blackout Curtains",
    ],
    estimate: "₹9L – ₹14L",
    gear: "Marantz Cinema 40 + B&W CT-700 Series",
  },
  "medium-premium-atmos": {
    title: "THX Certified Reference 7.2.4 Theater",
    features: [
      "140″ 2.35:1 Anamorphic Curved Cinema Screen",
      "JVC D-ILA Native 4K DCI-P3 Color Projector",
      "KEF Ci-Reference Extreme THX Certified Speakers",
      "Dual 15″ Balanced DSP Subwoofers",
      "Comprehensive Architectural Acoustic Treatment",
      "Crestron 1-Touch Cinema Automation Touchpad",
    ],
    estimate: "₹12L – ₹18L",
    gear: "Anthem AVM 70 Processor + KEF Ci Reference",
  },
  "medium-premium-cinema": {
    title: "Luxury Dedicated Home Cinema",
    features: [
      "150″ Fixed Acoustically Transparent Frame Screen",
      "Sony 4K Laser Engine with 2,500 Lumens",
      "9.2.4 Discrete Surround Soundfield Array",
      "Motorized Top-Grain Italian Leather Recliners (6 Seats)",
      "Full Starlight Fiber-Optic Constellation Ceiling",
    ],
    estimate: "₹14L – ₹18L",
    gear: "Marantz Cinema 30 + Parasound Halo Amplification",
  },
  "medium-ultra-stereo": {
    title: "Bespoke Audiophile Cinema Salon",
    features: [
      "140″ 4K Woven Micro-Perf Cinema Screen",
      "JVC D-ILA Reference Native 4K Laser Projector",
      "Bowers & Wilkins CT800 Diamond Array (7.2)",
      "McIntosh Multichannel Monoblock Amplification",
    ],
    estimate: "₹22L – ₹30L",
    gear: "McIntosh Multichannel + B&W Custom Theatre",
  },
  "medium-ultra-atmos": {
    title: "THX Master 9.4.6 Dolby Atmos Cinema",
    features: [
      "150″ Anamorphic Masking Micro-Perf Screen",
      "Sony Native 4K SXRD Flagship Laser Engine",
      "Trinnov Altitude 32 Processor with Active EQ",
      "Quad Balanced SVS PB16-Ultra Subwoofer Array",
      "Acoustic Decoupled Floating Shell (STC 68)",
    ],
    estimate: "₹26L – ₹38L",
    gear: "Trinnov Altitude 32 + KEF Extreme Reference",
  },
  "medium-ultra-cinema": {
    title: "Palatial 9.4.6 Screening Estate",
    features: [
      "165″ Fixed Frame 4K DCI Optical Engine",
      "Christie Professional Laser Cinema System",
      "Wisdom Audio Bi-Amplified Line Source Array",
      "Tiered 8-Seat Luxury Recliners with D-BOX Haptics",
      "Full Crestron Home Automation & Starlight Vault",
    ],
    estimate: "₹30L – ₹46L",
    gear: "Christie 4K Laser + Wisdom Audio Sage Series",
  },

  // Large Room (450 - 800+ sqft)
  "large-basic-stereo": {
    title: "Grand Estate Hall Audio-Visual Suite",
    features: [
      "135″ High-Output Ambient Light Screen",
      "Sony 4K Ultra-Bright Laser Projector",
      "7.2 Surround System with Dual 12″ Subs",
      "Perimeter Suede Wall Absorption Treatment",
    ],
    estimate: "₹5.5L – ₹7.5L",
    gear: "Marantz Cinema 50 + KEF Architectural",
  },
  "large-basic-atmos": {
    title: "Estate 7.2.4 Dolby Atmos Cinema",
    features: [
      "150″ Fixed Acoustically Transparent Screen",
      "4K Laser Projection with 3,000 Lumens",
      "7.2.4 Discrete In-Wall Multi-Channel Array",
      "Dual SVS High-Output Subwoofers & Bass Traps",
    ],
    estimate: "₹7.5L – ₹9.5L",
    gear: "Denon AVC-X6800H + SVS Balanced Subs",
  },
  "large-basic-cinema": {
    title: "Grand Screening Room (Essential)",
    features: [
      "160″ Micro-Perforated Fixed Cinema Screen",
      "Native 4K Laser Optical Projector",
      "9.2.4 Discrete Immersive Surround Setup",
      "Acoustic Wall Panels & Tiered Seating Platform",
    ],
    estimate: "₹8.5L – ₹11L",
    gear: "Marantz Cinema 40 + KEF Ci Series",
  },
  "large-premium-stereo": {
    title: "Executive Screening Lounge & Audiophile Salon",
    features: [
      "160″ 4K Micro-Perforated Fixed Cinema Screen",
      "Barco / JVC Reference Native 4K Optical Engine",
      "Bowers & Wilkins Custom Theatre 800 Diamond Array",
      "Quad Balanced SVS PB16-Ultra Subwoofer Array",
      "Acoustic Laboratory RT60 Tuning with Zero Flutter Echo",
    ],
    estimate: "₹15L – ₹22L",
    gear: "Anthem AVM 90 + B&W CT-700 Reference",
  },
  "large-premium-atmos": {
    title: "Grand Architectural 9.4.6 Atmos Theater",
    features: [
      "175″ Curved 2.35:1 Anamorphic Cinema Screen",
      "JVC Reference Native 4K Laser Projector",
      "19 Discrete Channels with Quad Subwoofers",
      "Custom Timber QRD Quadratic Residue Diffusers",
      "Tiered 10-Seat Luxury Motorized Leather Recliners",
    ],
    estimate: "₹18L – ₹26L",
    gear: "Marantz AV 10 + AMP 10 + KEF Ci Reference",
  },
  "large-premium-cinema": {
    title: "Estate DCI Screening Cinema",
    features: [
      "180″ Micro-Perf Woven Screen with Motorized Masking",
      "Sony 4K Flagship SXRD Laser Projector",
      "9.4.6 Discrete Surround Soundfield Array",
      "Room-Within-A-Room Acoustic Decoupling (STC 65)",
      "Crestron 1-Touch Cinema & Lighting Control",
    ],
    estimate: "₹20L – ₹30L",
    gear: "StormAudio Core 16 + Bowers & Wilkins CT",
  },
  "large-ultra-stereo": {
    title: "Palatial Audiophile Screening Hall",
    features: [
      "180″ 4K Micro-Perforated Fixed Cinema Screen",
      "Barco / JVC Reference Native 4K Optical Engine",
      "Bowers & Wilkins Custom Theatre 800 Diamond Array",
      "McIntosh Monoblock Pure High-Current Amplification",
      "Laboratory RT60 0.32s Modal Resonance Tuning",
    ],
    estimate: "₹22L – ₹32L",
    gear: "Trinnov Altitude 16 Processor + McIntosh Amps",
  },
  "large-ultra-atmos": {
    title: "Bespoke 9.4.6 Dolby Atmos DCI Cinema",
    features: [
      "180″ Micro-Perf Woven Screen with Motorized Masking",
      "Christie / Barco Professional Laser Cinema Projector",
      "19 Discretely Calibrated Architectural Transducers",
      "Quad Corner Bass Equalizers & Active Wave Cancellation",
      "Double-Stud Acoustical Room-Within-A-Room Isolation (STC 65)",
      "Tiered 10-Seat Luxury Recliner Platform with D-BOX Haptics",
      "Crestron Home Integrated Environmental Automation",
    ],
    estimate: "₹28L – ₹42L",
    gear: "Trinnov Altitude 32 + Wisdom Audio Line Source",
  },
  "large-ultra-cinema": {
    title: "Palatial 13.4.8 Flagship Screening Estate",
    features: [
      "220″ Custom Curved DCI Master Screen",
      "Commercial Dual Laser 8K Resolution System",
      "25 Discrete Audio Channels with Quad Infrasonic Subs",
      "ISF Level III Video & THX Certified Acoustic Commissioning",
      "Lobby Bar, Climate-Controlled Gear Rack & Starlight Vault",
    ],
    estimate: "₹38L – ₹65L+",
    gear: "Trinnov + Meyer Sound Cinema Series Ultra",
  },
};

function getRecommendation(config: Config) {
  const key = `${config.room}-${config.budget}-${config.setup}`;
  return (
    RECOMMENDATIONS[key] || {
      title: "Bespoke Custom Engineered Cinema",
      features: [
        "Architectural 3D room scan & acoustic simulation",
        "Dolby Atmos multi-channel configuration",
        "Acoustically transparent micro-perforated screen",
        "Turnkey white-glove delivery, cabling & calibration",
      ],
      estimate: "Custom Engineering Quote",
      gear: "Selected across KEF, Bowers & Wilkins, Marantz, SVS",
    }
  );
}

interface ConfiguratorProps {
  onBookSetup?: (specTitle: string) => void;
}

export default function Configurator({ onBookSetup }: ConfiguratorProps) {
  const [config, setConfig] = useState<Config>({ room: "medium", budget: "premium", setup: "atmos" });
  const recommendation = config.room && config.budget && config.setup ? getRecommendation(config) : null;

  const handleAction = () => {
    if (onBookSetup && recommendation) {
      onBookSetup(`${recommendation.title} (${recommendation.estimate})`);
    } else {
      scrollToSection("consultation");
    }
  };

  return (
    <Box
      id="configurator"
      component="section"
      sx={{
        py: { xs: 8, md: 12 },
        position: "relative",
        bgcolor: "#0E0B14",
        scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
      }}
    >
      <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
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
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              mb: 1.5,
            }}
          >
            <Box component={Sparkles} sx={{ width: 14, height: 14 }} />
            Interactive Cinema Builder
          </Box>
          <Typography
            component="h2"
            variant="h2"
            sx={{
              fontFamily: TYPOGRAPHY.fontDisplay,
              fontSize: { xs: "2.25rem", md: "3rem" },
              fontWeight: 700,
              color: CINEMA_COLORS.WARM_WHITE,
              mb: 1.5,
            }}
          >
            Configure Your Private Cinema
          </Typography>
          <Typography
            component="p"
            variant="body1"
            sx={{
              color: "rgba(245, 239, 227, 0.6)",
              maxWidth: "40rem",
              mx: "auto",
              fontSize: { xs: "0.875rem", md: "1rem" },
              lineHeight: 1.6,
            }}
          >
            Select your room dimensions, investment tier, and immersive sound topology to instantly receive an itemized
            turnkey engineering recommendation.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" },
            gap: 4,
            alignItems: "start",
          }}
        >
          {/* Selectors Column */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
            {/* Step 1: Room Size */}
            <Box>
              <Typography
                component="h3"
                variant="body2"
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: CINEMA_COLORS.GOLD,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component={Armchair} sx={{ width: 16, height: 16 }} />
                1. Room Dimensions & Acoustic Volume
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                {ROOM_SIZES.map((r) => {
                  const isSelected = config.room === r.id;
                  return (
                    <ButtonBase
                      key={r.id}
                      onClick={() => setConfig((p) => ({ ...p, room: r.id }))}
                      type="button"
                      sx={{
                        borderRadius: "1rem",
                        border: isSelected ? "1px solid #E8B86C" : "1px solid rgba(255, 255, 255, 0.08)",
                        bgcolor: isSelected ? "rgba(232, 184, 108, 0.12)" : "rgba(255, 255, 255, 0.02)",
                        p: { xs: 1.5, sm: 2 },
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? "0 0 20px rgba(232, 184, 108, 0.2)" : "none",
                        "&:hover": { borderColor: "rgba(232, 184, 108, 0.5)" },
                      }}
                    >
                      <Box sx={{ fontSize: "1.5rem", mb: 0.5 }}>{r.icon}</Box>
                      <Typography component="p" variant="body2" sx={{ fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE, fontSize: "0.875rem" }}>
                        {r.label}
                      </Typography>
                      <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem", mt: 0.25 }}>
                        {r.desc}
                      </Typography>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>

            {/* Step 2: Budget */}
            <Box>
              <Typography
                component="h3"
                variant="body2"
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: CINEMA_COLORS.GOLD,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component="span" sx={{ fontSize: "1rem" }}>💎</Box>
                2. Target Investment Tier
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
                {BUDGETS.map((b) => {
                  const isSelected = config.budget === b.id;
                  return (
                    <ButtonBase
                      key={b.id}
                      onClick={() => setConfig((p) => ({ ...p, budget: b.id }))}
                      type="button"
                      sx={{
                        borderRadius: "1rem",
                        border: isSelected ? "1px solid #E8B86C" : "1px solid rgba(255, 255, 255, 0.08)",
                        bgcolor: isSelected ? "rgba(232, 184, 108, 0.12)" : "rgba(255, 255, 255, 0.02)",
                        p: { xs: 1.5, sm: 2 },
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? "0 0 20px rgba(232, 184, 108, 0.2)" : "none",
                        "&:hover": { borderColor: "rgba(232, 184, 108, 0.5)" },
                      }}
                    >
                      <Typography component="p" variant="caption" sx={{ color: CINEMA_COLORS.GOLD, fontSize: "0.6875rem", fontWeight: 600, mb: 0.25 }}>
                        {b.tier}
                      </Typography>
                      <Typography component="p" variant="body2" sx={{ fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE, fontSize: "0.875rem" }}>
                        {b.label}
                      </Typography>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>

            {/* Step 3: Setup Type */}
            <Box>
              <Typography
                component="h3"
                variant="body2"
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: CINEMA_COLORS.GOLD,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box component={Volume2} sx={{ width: 16, height: 16 }} />
                3. Surround Audio Topology
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {SETUPS.map((s) => {
                  const isSelected = config.setup === s.id;
                  return (
                    <ButtonBase
                      key={s.id}
                      onClick={() => setConfig((p) => ({ ...p, setup: s.id }))}
                      type="button"
                      sx={{
                        width: "100%",
                        borderRadius: "1rem",
                        border: isSelected ? "1px solid #E8B86C" : "1px solid rgba(255, 255, 255, 0.08)",
                        bgcolor: isSelected ? "rgba(232, 184, 108, 0.12)" : "rgba(255, 255, 255, 0.02)",
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        textAlign: "left",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? "0 0 20px rgba(232, 184, 108, 0.2)" : "none",
                        "&:hover": { borderColor: "rgba(232, 184, 108, 0.5)" },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "0.75rem",
                          bgcolor: isSelected ? "rgba(232, 184, 108, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isSelected ? CINEMA_COLORS.GOLD : "rgba(245, 239, 227, 0.4)",
                          flexShrink: 0,
                        }}
                      >
                        <Monitor size={20} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography component="p" variant="body2" sx={{ fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE }}>
                          {s.label}
                        </Typography>
                        <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                          {s.desc}
                        </Typography>
                      </Box>
                      {isSelected && (
                        <Box sx={{ color: CINEMA_COLORS.GOLD }}>
                          <Check size={18} />
                        </Box>
                      )}
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>
          </Box>

          {/* Recommendation Column */}
          <Box sx={{ position: "sticky", top: 100 }}>
            {recommendation ? (
              <Box
                key={`${config.room}-${config.budget}-${config.setup}`}
                sx={{
                  borderRadius: "1.5rem",
                  border: "1px solid rgba(232, 184, 108, 0.35)",
                  bgcolor: "rgba(18, 14, 28, 0.9)",
                  backdropFilter: "blur(20px)",
                  p: { xs: 2.5, sm: 3.5 },
                  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Glow accent */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    bgcolor: "rgba(232, 184, 108, 0.1)",
                    filter: "blur(50px)",
                    pointerEvents: "none",
                  }}
                />

                <Box sx={{ mb: 2 }}>
                  <Chip
                    label="Turnkey Recommendation"
                    size="small"
                    sx={{
                      bgcolor: "rgba(232, 184, 108, 0.15)",
                      color: CINEMA_COLORS.GOLD,
                      border: "1px solid rgba(232, 184, 108, 0.3)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      mb: 1,
                    }}
                  />
                  <Typography
                    component="h3"
                    variant="h5"
                    sx={{
                      fontFamily: TYPOGRAPHY.fontDisplay,
                      fontWeight: 700,
                      color: CINEMA_COLORS.WARM_WHITE,
                    }}
                  >
                    {recommendation.title}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", mt: 0.5, display: "block" }}>
                    Reference Hardware: {recommendation.gear}
                  </Typography>
                </Box>

                {/* Features List */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, my: 2.5 }}>
                  {recommendation.features.map((feat, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: "rgba(232, 184, 108, 0.2)",
                          color: CINEMA_COLORS.GOLD,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        ✓
                      </Box>
                      <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.75)", fontSize: "0.8125rem", lineHeight: 1.4 }}>
                        {feat}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Pricing & CTA */}
                <Box sx={{ pt: 2.5, borderTop: "1px solid rgba(255, 255, 255, 0.08)", mb: 3 }}>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Estimated Complete Turnkey Budget
                  </Typography>
                  <Typography
                    component="p"
                    variant="h4"
                    sx={{
                      fontFamily: TYPOGRAPHY.fontDisplay,
                      fontWeight: 700,
                      color: CINEMA_COLORS.GOLD,
                      mt: 0.5,
                    }}
                  >
                    {recommendation.estimate}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.4)", fontSize: "0.75rem" }}>
                    Includes 3D acoustics design, equipment, installation, ISF/THX calibration & 5-year warranty.
                  </Typography>
                </Box>

                <ButtonBase
                  onClick={handleAction}
                  type="button"
                  sx={{
                    width: "100%",
                    py: 1.5,
                    borderRadius: "0.75rem",
                    bgcolor: CINEMA_COLORS.GOLD,
                    color: "#0E0B14",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    boxShadow: "0 0 24px rgba(232, 184, 108, 0.35)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    "&:hover": {
                      bgcolor: "#F4D9A8",
                      boxShadow: "0 0 32px rgba(232, 184, 108, 0.5)",
                    },
                  }}
                >
                  Book This Setup & Consultation
                  <Box component={ArrowRight} sx={{ width: 16, height: 16 }} />
                </ButtonBase>
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
