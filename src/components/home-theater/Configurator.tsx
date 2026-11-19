"use client";

import { scrollToSection } from "@/lib/scroll";

import { Box, ButtonBase, Typography } from "@mui/material";
import { MotionSection, mergeSx } from "@/components/mui";
import { useState } from "react";
import { Monitor, Volume2, Armchair, Sparkles } from "lucide-react";
const ROOM_SIZES = [
    { id: "small", label: "Small", desc: "10×12 ft", icon: "🏠" },
    { id: "medium", label: "Medium", desc: "15×20 ft", icon: "🏡" },
    { id: "large", label: "Large", desc: "20×30 ft+", icon: "🏰" },
];
const BUDGETS = [
    { id: "basic", label: "₹2L – ₹5L", tier: "Essential" },
    { id: "premium", label: "₹5L – ₹15L", tier: "Premium" },
    { id: "ultra", label: "₹15L+", tier: "Ultra Luxury" },
];
const SETUPS = [
    { id: "stereo", label: "5.1 Surround", desc: "Classic home theater" },
    { id: "atmos", label: "7.1.4 Dolby Atmos", desc: "Immersive 3D sound" },
    { id: "cinema", label: "Dedicated Cinema", desc: "Full cinema room" },
];
interface Config {
    room: string;
    budget: string;
    setup: string;
}
const RECOMMENDATIONS: Record<string, {
    title: string;
    features: string[];
    estimate: string;
}> = {
    "small-basic-stereo": { title: "Compact Theater", features: ["55\" 4K OLED TV", "5.1 Soundbar System", "Basic acoustic panels", "Smart remote control"], estimate: "₹2.5L – ₹4L" },
    "small-basic-atmos": { title: "Mini Atmos Setup", features: ["65\" 4K TV", "5.1.2 Atmos soundbar", "2 upfiring speakers", "Room calibration"], estimate: "₹3.5L – ₹5L" },
    "small-basic-cinema": { title: "Compact Cinema", features: ["100\" motorized screen", "HD projector", "5.1 in-ceiling speakers", "Blackout curtains"], estimate: "₹4L – ₹5L" },
    "medium-premium-stereo": { title: "Premium Surround", features: ["75\" 4K OLED", "7.1 floorstanding speakers", "AV receiver (Denon/Marantz)", "Acoustic treatment", "Smart lighting"], estimate: "₹6L – ₹10L" },
    "medium-premium-atmos": { title: "Dolby Atmos Theater", features: ["120\" ALR screen", "4K laser projector", "7.1.4 Dolby Atmos", "In-ceiling Atmos speakers", "Full acoustic treatment", "Tiered seating for 6"], estimate: "₹8L – ₹15L" },
    "medium-premium-cinema": { title: "Home Cinema Room", features: ["130\" fixed frame screen", "4K HDR projector", "7.2.4 Atmos system", "Acoustic panels + bass traps", "Motorized recliners", "LED ambient lighting"], estimate: "₹10L – ₹15L" },
    "large-ultra-stereo": { title: "Executive Surround", features: ["85\" 8K TV", "B&W / KEF reference speakers", "McIntosh amplification", "Custom furniture", "Whole-home integration"], estimate: "₹15L – ₹20L" },
    "large-ultra-atmos": { title: "Reference Atmos Theater", features: ["150\" 4K screen", "JVC/Sony native 4K projector", "9.2.6 Dolby Atmos", "Full room acoustic design", "THX certification ready", "Custom seating for 10+"], estimate: "₹18L – ₹30L" },
    "large-ultra-cinema": { title: "Ultra Luxury Cinema", features: ["180\" screen", "Dual projector system", "13.2.8 Atmos + DTS:X Pro", "ISF calibration", "Custom interior design", "Bar + lobby area", "Starlight ceiling"], estimate: "₹25L – ₹50L+" },
};
function getRecommendation(config: Config) {
    const key = `${config.room}-${config.budget}-${config.setup}`;
    return RECOMMENDATIONS[key] || {
        title: "Custom Configuration",
        features: ["Tailored to your needs", "Professional consultation", "Best-in-class equipment", "Expert installation"],
        estimate: "Contact for quote",
    };
}
export default function Configurator() {
    const [config, setConfig] = useState<Config>({ room: "", budget: "", setup: "" });
    const recommendation = config.room && config.budget && config.setup ? getRecommendation(config) : null;
    return (<Box id="configurator" component="section" sx={{ paddingTop: "6rem", paddingBottom: "6rem", position: "relative" }}>
      <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
        <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", borderRadius: "9999px", backgroundColor: "rgb(255 255 255 / 0.05)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 0.6)", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", marginBottom: "1rem" }}>
            <Box component={Sparkles} sx={{ height: "0.875rem", width: "0.875rem" }}/> Interactive Tool
          </Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3rem", lineHeight: "1" }, fontWeight: "700", letterSpacing: "-0.025em" }}>Design Your Theater</Typography>
          <Typography component="p" variant="body1" sx={{ color: "rgb(255 255 255 / 0.4)", marginTop: "1rem", maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}>Configure your dream setup and get instant recommendations.</Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "3rem" }}>
          {/* Selectors */}
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "2rem" } }}>
            {/* Room Size */}
            <Box>
              <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "rgb(255 255 255 / 0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Box component={Armchair} sx={{ height: "1rem", width: "1rem" }}/> Room Size
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                {ROOM_SIZES.map(r => (<ButtonBase key={r.id} onClick={() => setConfig(p => ({ ...p, room: r.id }))} type="button" sx={mergeSx({ borderRadius: "1rem", borderWidth: "1px", padding: "1rem", textAlign: "center", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }, config.room === r.id ? { borderColor: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" } : { borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", "&:hover": { borderColor: "rgb(255 255 255 / 0.1)" } })}>
                    <Box sx={{ fontSize: "1.5rem", lineHeight: "2rem", marginBottom: "0.5rem" }}>{r.icon}</Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{r.label}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginTop: "0.125rem" }}>{r.desc}</Typography>
                  </ButtonBase>))}
              </Box>
            </Box>

            {/* Budget */}
            <Box>
              <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "rgb(255 255 255 / 0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Box component="span" sx={{ fontSize: "1rem", lineHeight: "1.5rem" }}>💰</Box> Budget Range
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                {BUDGETS.map(b => (<ButtonBase key={b.id} onClick={() => setConfig(p => ({ ...p, budget: b.id }))} type="button" sx={mergeSx({ borderRadius: "1rem", borderWidth: "1px", padding: "1rem", textAlign: "center", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }, config.budget === b.id ? { borderColor: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" } : { borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", "&:hover": { borderColor: "rgb(255 255 255 / 0.1)" } })}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginBottom: "0.25rem" }}>{b.tier}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{b.label}</Typography>
                  </ButtonBase>))}
              </Box>
            </Box>

            {/* Setup Type */}
            <Box>
              <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "rgb(255 255 255 / 0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Box component={Volume2} sx={{ height: "1rem", width: "1rem" }}/> Setup Type
              </Typography>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                {SETUPS.map(s => (<ButtonBase key={s.id} onClick={() => setConfig(p => ({ ...p, setup: s.id }))} type="button" sx={mergeSx({ width: "100%", borderRadius: "1rem", borderWidth: "1px", padding: "1rem", textAlign: "left", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms", display: "flex", alignItems: "center", gap: "1rem" }, config.setup === s.id ? { borderColor: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" } : { borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", "&:hover": { borderColor: "rgb(255 255 255 / 0.1)" } })}>
                    <Box component={Monitor} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, config.setup === s.id ? { color: "hsl(var(--primary))" } : { color: "rgb(255 255 255 / 0.3)" })}/>
                    <Box>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{s.label}</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)" }}>{s.desc}</Typography>
                    </Box>
                  </ButtonBase>))}
              </Box>
            </Box>
          </Box>

          {/* Recommendation */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {recommendation ? (<MotionSection key={`${config.room}-${config.budget}-${config.setup}`} sx={{ width: "100%", borderRadius: "1.5rem", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "color-mix(in srgb, hsl(var(--primary)) 5%, transparent) var(--alv-gradient-from-position)", "--alv-gradient-to": "transparent var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), rgb(255 255 255 / 0.02) var(--alv-gradient-via-position), var(--alv-gradient-to)", padding: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
                <Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--primary))", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Recommended Setup</Typography>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700" }}>{recommendation.title}</Typography>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  {recommendation.features.map((f, i) => (<Box key={i} sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Box sx={{ height: "0.375rem", width: "0.375rem", borderRadius: "9999px", backgroundColor: "hsl(var(--primary))" }}/>
                      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(255 255 255 / 0.7)" }}>{f}</Box>
                    </Box>))}
                </Box>
                <Box sx={{ paddingTop: "1rem", borderTopWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginBottom: "0.25rem" }}>Estimated Investment</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", backgroundImage: "linear-gradient(to right, var(--alv-gradient-stops))", "--alv-gradient-from": "hsl(var(--primary)) var(--alv-gradient-from-position)", "--alv-gradient-to": "hsl(var(--accent)) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", backgroundClip: "text", color: "transparent" }}>{recommendation.estimate}</Typography>
                </Box>
                <ButtonBase onClick={() => scrollToSection("consultation")} type="button" sx={{ width: "100%", borderRadius: "0.75rem", backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", paddingTop: "0.75rem", paddingBottom: "0.75rem", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 90%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                  Get Detailed Quote →
                </ButtonBase>
              </MotionSection>) : (<Box sx={{ width: "100%", borderRadius: "1.5rem", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", padding: "3rem", textAlign: "center" }}>
                <Box sx={{ fontSize: "3rem", lineHeight: "1", marginBottom: "1rem" }}>🎬</Box>
                <Typography component="p" variant="body1" sx={{ color: "rgb(255 255 255 / 0.4)" }}>Select room size, budget, and setup type to see your personalized recommendation.</Typography>
              </Box>)}
          </Box>
        </Box>
      </Box>
    </Box>);
}
