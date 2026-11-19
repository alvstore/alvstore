"use client";

import { Box, Button, Typography } from "@mui/material";
import { AnimatedPage, Marquee, PageHeader, mergeSx } from "@/components/mui";
import { useNavigate } from "@/lib/router-compat";
import { ArrowRight, Wrench, Shield, Zap, Headphones, Monitor, Smartphone, Speaker, Music, Star, CheckCircle, ChevronRight, Play, } from "lucide-react";
const CATEGORIES = [
    {
        title: "Apple Products",
        desc: "iPhone, iPad, Mac, Apple Watch & accessories. Authorized sales with expert guidance.",
        icon: Smartphone,
        gradient: { "--alv-gradient-from": "#2563eb var(--alv-gradient-from-position)", "--alv-gradient-to": "#06b6d4 var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        shadowColor: { "--alv-shadow-color": "rgb(59 130 246 / 0.2)", "--alv-shadow": "var(--alv-shadow-colored)" },
    },
    {
        title: "Home Theater",
        desc: "Immersive cinema experiences. Projectors, AV receivers, Dolby Atmos setups & calibration.",
        icon: Monitor,
        gradient: { "--alv-gradient-from": "#9333ea var(--alv-gradient-from-position)", "--alv-gradient-to": "#ec4899 var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        shadowColor: { "--alv-shadow-color": "rgb(168 85 247 / 0.2)", "--alv-shadow": "var(--alv-shadow-colored)" },
    },
    {
        title: "Professional Audio",
        desc: "Studio monitors, PA systems, mixers & pro-grade equipment for professionals.",
        icon: Music,
        gradient: { "--alv-gradient-from": "#f59e0b var(--alv-gradient-from-position)", "--alv-gradient-to": "#ea580c var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        shadowColor: { "--alv-shadow-color": "rgb(245 158 11 / 0.2)", "--alv-shadow": "var(--alv-shadow-colored)" },
    },
];
const SERVICES = [
    { icon: Wrench, title: "Expert Repairs", desc: "Certified technicians for Apple & AV equipment" },
    { icon: Headphones, title: "Custom Installation", desc: "Professional home theater & audio setup" },
    { icon: Shield, title: "Extended Warranty", desc: "Peace of mind with comprehensive coverage" },
    { icon: Zap, title: "Trade-In Program", desc: "Upgrade your devices with best trade-in values" },
];
const BRANDS = ["Apple", "Sonos", "Bose", "JBL", "Harman Kardon", "Sony", "Denon", "Marantz", "KEF", "B&W", "Sennheiser", "Bang & Olufsen"];
const STATS = [
    { number: "500+", label: "Devices Repaired" },
    { number: "1000+", label: "Products Sold" },
    { number: "98%", label: "Satisfaction Rate" },
    { number: "5+", label: "Years Experience" },
];
export default function LandingPage() {
    const navigate = useNavigate();
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(0 0% 4% / 1)", color: "rgb(255 255 255 / 1)", overflow: "hidden" }}>
      {/* Nav */}
      <Box component="nav" sx={{ position: "sticky", top: "0px", zIndex: "50", backgroundColor: "hsl(0 0% 4% / 0.8)", "--alv-backdrop-blur": "blur(40px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderBottomWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1rem", paddingBottom: "1rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "1rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "#3b82f6 var(--alv-gradient-from-position)", "--alv-gradient-to": "#9333ea var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(59 130 246 / 0.2)" }}>
              <Box component={Speaker} sx={{ height: "1.25rem", width: "1.25rem", color: "rgb(255 255 255 / 1)" }}/>
            </Box>
            <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", letterSpacing: "-0.025em" }}>ALV Store</Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Button onClick={() => navigate("/login")} variant="text" size="small" sx={{ color: "rgb(255 255 255 / 0.7)", "&:hover": { color: "rgb(255 255 255 / 1)", backgroundColor: "rgb(255 255 255 / 0.05)" } }}>Sign In</Button>
            <Button onClick={() => navigate("/signup")} variant="contained" size="small" sx={{ backgroundColor: "rgb(255 255 255 / 1)", color: "rgb(0 0 0 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.9)" }, borderRadius: "0.75rem" }}>
              Get Started <Box component={ArrowRight} sx={{ height: "0.875rem", width: "0.875rem", marginLeft: "0.25rem" }}/>
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Hero */}
      <Box component="section" sx={{ position: "relative", minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Ambient gradient orbs */}
        <Box sx={{ position: "absolute", top: "5rem", left: "25%", width: "500px", height: "500px", backgroundColor: "rgb(37 99 235 / 0.2)", borderRadius: "9999px", "--alv-blur": "blur(120px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }}/>
        <Box sx={{ position: "absolute", bottom: "5rem", right: "25%", width: "400px", height: "400px", backgroundColor: "rgb(147 51 234 / 0.15)", borderRadius: "9999px", "--alv-blur": "blur(100px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }}/>
        <Box sx={{ position: "absolute", top: "50%", right: "33.333333%", width: "300px", height: "300px", backgroundColor: "rgb(245 158 11 / 0.1)", borderRadius: "9999px", "--alv-blur": "blur(80px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }}/>

        <PageHeader title={<>
              Sound.
              <Box component="br"/>
              <Box component="span" sx={{ backgroundImage: "linear-gradient(to right, var(--alv-gradient-stops))", "--alv-gradient-from": "#60a5fa var(--alv-gradient-from-position)", "--alv-gradient-to": "#f472b6 var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), #c084fc var(--alv-gradient-via-position), var(--alv-gradient-to)", backgroundClip: "text", color: "transparent" }}>Vision.</Box>
              <Box component="br"/>
              Perfection.
            </>} subtitle={"Your destination for Apple products, home theater systems, and professional audio equipment. Premium experience, expert service."} actions={<><Box sx={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", borderRadius: "9999px", backgroundColor: "rgb(255 255 255 / 0.05)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 0.8)", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)" }}>
              <Box sx={{ height: "0.5rem", width: "0.5rem", borderRadius: "9999px", backgroundColor: "rgb(74 222 128 / 1)" }}/>
              Premium Apple & Audio Experience
            </Box><Box sx={{ display: "flex", alignItems: "center", gap: "1rem", paddingTop: "0.5rem" }}>
              <Button onClick={() => navigate("/signup")} variant="contained" size="large" sx={{ backgroundColor: "rgb(255 255 255 / 1)", color: "rgb(0 0 0 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.9)" }, borderRadius: "0.75rem", paddingLeft: "2rem", paddingRight: "2rem", height: "3rem", fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(255 255 255 / 0.1)" }}>
                Explore Store <Box component={ArrowRight} sx={{ height: "1rem", width: "1rem", marginLeft: "0.5rem" }}/>
              </Button>
              <Button onClick={() => navigate("/login")} variant="outlined" size="large" sx={{ borderColor: "rgb(255 255 255 / 0.1)", backgroundColor: "rgb(255 255 255 / 0.05)", color: "rgb(255 255 255 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.1)" }, borderRadius: "0.75rem", height: "3rem", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
                <Box component={Play} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", fill: "currentColor" }}/> Watch Demo
              </Button>
            </Box>{/* 3D Product Cards */}<Box sx={mergeSx({ position: "relative", display: "none", "@media (min-width: 1024px)": { display: "block" }, height: "500px" }, { perspective: "1200px" })}>
            {/* Card 1 - iPhone silhouette */}
            <Box sx={mergeSx({ position: "absolute", top: "0px", right: "2.5rem", width: "14rem", height: "18rem", borderRadius: "1.5rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "rgb(37 99 235 / 0.3) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(30 64 175 / 0.2) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "flex-end", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(59 130 246 / 0.1)", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "700ms", animationDuration: "700ms", "&:hover": { "--alv-scale-x": "1.05", "--alv-scale-y": "1.05", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }, { transform: "rotateY(-15deg) rotateX(5deg)" })}>
              <Box component={Smartphone} sx={{ height: "4rem", width: "4rem", color: "rgb(96 165 250 / 0.6)", marginBottom: "1rem" }}/>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "rgb(255 255 255 / 0.9)" }}>iPhone</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginTop: "0.25rem" }}>Latest models available</Typography>
            </Box>

            {/* Card 2 - Home Theater */}
            <Box sx={mergeSx({ position: "absolute", top: "6rem", left: "0px", width: "15rem", height: "16rem", borderRadius: "1.5rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "rgb(147 51 234 / 0.3) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(88 28 135 / 0.2) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "flex-end", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(168 85 247 / 0.1)", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "700ms", animationDuration: "700ms", "&:hover": { "--alv-scale-x": "1.05", "--alv-scale-y": "1.05", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }, { transform: "rotateY(10deg) rotateX(-5deg)" })}>
              <Box component={Monitor} sx={{ height: "3.5rem", width: "3.5rem", color: "rgb(192 132 252 / 0.6)", marginBottom: "1rem" }}/>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "rgb(255 255 255 / 0.9)" }}>Home Theater</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginTop: "0.25rem" }}>Cinematic experience</Typography>
            </Box>

            {/* Card 3 - Audio */}
            <Box sx={mergeSx({ position: "absolute", bottom: "0px", right: "0px", width: "13rem", height: "15rem", borderRadius: "1.5rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "rgb(245 158 11 / 0.3) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(146 64 14 / 0.2) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "flex-end", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(245 158 11 / 0.1)", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "700ms", animationDuration: "700ms", "&:hover": { "--alv-scale-x": "1.05", "--alv-scale-y": "1.05", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }, { transform: "rotateY(-8deg) rotateX(8deg)" })}>
              <Box component={Headphones} sx={{ height: "3.5rem", width: "3.5rem", color: "rgb(251 191 36 / 0.6)", marginBottom: "1rem" }}/>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "rgb(255 255 255 / 0.9)" }}>Pro Audio</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)", marginTop: "0.25rem" }}>Studio-grade sound</Typography>
            </Box>
          </Box></>}/>
      </Box>

      {/* Product Categories */}
      <Box component="section" sx={{ paddingTop: "6rem", paddingBottom: "6rem", position: "relative" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "rgb(255 255 255 / 0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Our Collections</Typography>
            <Typography component="h2" variant="h2" sx={{ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3rem", lineHeight: "1" }, fontWeight: "700", letterSpacing: "-0.025em" }}>Premium Categories</Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "2rem" }}>
            {CATEGORIES.map(cat => (<Box key={cat.title} sx={mergeSx(mergeSx({ position: "relative", borderRadius: "1.5rem", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", padding: "2rem", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms", "&:hover": { borderColor: "rgb(255 255 255 / 0.1)", backgroundColor: "rgb(255 255 255 / 0.04)", "--alv-shadow": "0 25px 50px -12px rgb(0 0 0 / 0.25)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" } }, cat.shadowColor, { cursor: "pointer", overflow: "hidden" }), { perspective: "600px" })}>
                <Box sx={{ transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms", "[data-ui-group]:hover &": { "--alv-translate-y": "-4px", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }}>
                  <Box sx={mergeSx({ height: "4rem", width: "4rem", borderRadius: "1rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))" }, cat.gradient, { display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", "--alv-shadow": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, cat.shadowColor)}>
                    <Box component={cat.icon} sx={{ height: "2rem", width: "2rem", color: "rgb(255 255 255 / 1)" }}/>
                  </Box>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", marginBottom: "0.75rem" }}>{cat.title}</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "rgb(255 255 255 / 0.4)", lineHeight: "1.25rem", fontSize: "0.875rem" }}>{cat.desc}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem", color: "rgb(255 255 255 / 0.6)", "[data-ui-group]:hover &": { color: "rgb(255 255 255 / 1)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                    <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>Explore</Box>
                    <Box component={ChevronRight} sx={{ height: "1rem", width: "1rem", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "[data-ui-group]:hover &": { "--alv-translate-x": "0.25rem", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }}/>
                  </Box>
                </Box>
                {/* Hover glow */}
                <Box sx={mergeSx({ position: "absolute", inset: "0px", borderRadius: "1.5rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))" }, cat.gradient, { opacity: "0", "[data-ui-group]:hover &": { opacity: "0.05" }, transitionProperty: "opacity", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms" })}/>
              </Box>))}
          </Box>
        </Box>
      </Box>

      {/* Services */}
      <Box component="section" sx={{ paddingTop: "6rem", paddingBottom: "6rem", backgroundColor: "rgb(255 255 255 / 0.01)", borderTopWidth: "1px", borderBottomWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "rgb(255 255 255 / 0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>What We Offer</Typography>
            <Typography component="h2" variant="h2" sx={{ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3rem", lineHeight: "1" }, fontWeight: "700", letterSpacing: "-0.025em" }}>Expert Services</Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1.5rem" }}>
            {SERVICES.map(s => (<Box key={s.title} sx={{ padding: "1.5rem", borderRadius: "1rem", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", backgroundColor: "rgb(255 255 255 / 0.02)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", "&:hover": { borderColor: "rgb(255 255 255 / 0.1)" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }}>
                <Box sx={{ height: "3rem", width: "3rem", borderRadius: "0.75rem", backgroundColor: "rgb(255 255 255 / 0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                  <Box component={s.icon} sx={{ height: "1.5rem", width: "1.5rem", color: "rgb(255 255 255 / 0.6)" }}/>
                </Box>
                <Typography component="h3" variant="h3" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600", marginBottom: "0.5rem" }}>{s.title}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.625", color: "rgb(255 255 255 / 0.4)" }}>{s.desc}</Typography>
              </Box>))}
          </Box>
        </Box>
      </Box>

      {/* Stats */}
      <Box component="section" sx={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "2rem" }}>
            {STATS.map(s => (<Box key={s.label} sx={{ textAlign: "center" }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3rem", lineHeight: "1" }, fontWeight: "800", backgroundImage: "linear-gradient(to right, var(--alv-gradient-stops))", "--alv-gradient-from": "#60a5fa var(--alv-gradient-from-position)", "--alv-gradient-to": "#c084fc var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", backgroundClip: "text", color: "transparent" }}>{s.number}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(255 255 255 / 0.4)", marginTop: "0.5rem", fontWeight: "500" }}>{s.label}</Typography>
              </Box>))}
          </Box>
        </Box>
      </Box>

      {/* Brands Marquee */}
      <Box component="section" sx={{ paddingTop: "4rem", paddingBottom: "4rem", borderTopWidth: "1px", borderBottomWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", overflow: "hidden" }}>
        <Box sx={{ position: "relative" }}>
          <Marquee label="Partner brands" gap={6}>
            {BRANDS.map((brand, i) => (<Box key={i} component="span" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "rgb(255 255 255 / 0.1)", letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: "0" }}>{brand}</Box>))}
          </Marquee>
        </Box>
      </Box>

      {/* CTA */}
      <Box component="section" sx={{ paddingTop: "8rem", paddingBottom: "8rem", position: "relative" }}>
        <Box sx={{ position: "absolute", inset: "0px", backgroundImage: "linear-gradient(to bottom, var(--alv-gradient-stops))", "--alv-gradient-from": "transparent var(--alv-gradient-from-position)", "--alv-gradient-to": "transparent var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), rgb(37 99 235 / 0.05) var(--alv-gradient-via-position), var(--alv-gradient-to)", pointerEvents: "none" }}/>
        <Box sx={{ maxWidth: "56rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", textAlign: "center", position: "relative" }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", borderRadius: "9999px", backgroundColor: "rgb(255 255 255 / 0.05)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 0.6)", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", marginBottom: "2rem" }}>
            <Box component={Star} sx={{ height: "0.875rem", width: "0.875rem", color: "rgb(251 191 36 / 1)" }}/> Trusted by audio enthusiasts
          </Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "2.25rem", lineHeight: "2.5rem", "@media (min-width: 768px)": { fontSize: "3.75rem", lineHeight: "1" }, fontWeight: "700", letterSpacing: "-0.025em", marginBottom: "1.5rem" }}>
            Elevate your
            <Box component="span" sx={{ backgroundImage: "linear-gradient(to right, var(--alv-gradient-stops))", "--alv-gradient-from": "#60a5fa var(--alv-gradient-from-position)", "--alv-gradient-to": "#c084fc var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", backgroundClip: "text", color: "transparent" }}> experience</Box>
          </Typography>
          <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", color: "rgb(255 255 255 / 0.4)", maxWidth: "36rem", marginLeft: "auto", marginRight: "auto", marginBottom: "2.5rem" }}>
            Visit our store or get in touch for personalized recommendations and expert consultation.
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
            <Button onClick={() => navigate("/signup")} variant="contained" size="large" sx={{ backgroundColor: "rgb(255 255 255 / 1)", color: "rgb(0 0 0 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.9)" }, borderRadius: "0.75rem", paddingLeft: "2.5rem", paddingRight: "2.5rem", height: "3rem", fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(255 255 255 / 0.1)" }}>
              Get Started <Box component={ArrowRight} sx={{ height: "1rem", width: "1rem", marginLeft: "0.5rem" }}/>
            </Button>
            <Button onClick={() => navigate("/login")} variant="outlined" size="large" sx={{ borderColor: "rgb(255 255 255 / 0.1)", backgroundColor: "rgb(255 255 255 / 0.05)", color: "rgb(255 255 255 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.1)" }, borderRadius: "0.75rem", height: "3rem", paddingLeft: "2rem", paddingRight: "2rem" }}>
              Sign In
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ borderTopWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 768px)": { flexDirection: "row" }, alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Box sx={{ height: "2.25rem", width: "2.25rem", borderRadius: "0.75rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "#3b82f6 var(--alv-gradient-from-position)", "--alv-gradient-to": "#9333ea var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Box component={Speaker} sx={{ height: "1rem", width: "1rem", color: "rgb(255 255 255 / 1)" }}/>
              </Box>
              <Box component="span" sx={{ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700" }}>ALV Store</Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(255 255 255 / 0.3)" }}>
              <Box component="span">Apple Products</Box>
              <Box component="span">Home Theater</Box>
              <Box component="span">Professional Audio</Box>
              <Box component="span">Repairs</Box>
            </Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.2)" }}>© {new Date().getFullYear()} ALV Store. All rights reserved.</Typography>
          </Box>
        </Box>
      </Box>

    </Box></AnimatedPage>;
}
