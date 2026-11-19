"use client";

import { Box, Button, ButtonBase, FormLabel, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, toast } from "@/components/mui";
import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";
export default function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: window.location.origin,
            },
        });
        setLoading(false);
        if (error) {
            toast.error(error.message);
        }
        else {
            toast.success("Check your email to confirm your account!");
        }
    };
    return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex" }}>
      {/* Left brand panel */}
      <Box sx={{ display: "none", "@media (min-width: 1024px)": { display: "flex", width: "50%" }, backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "hsl(var(--primary)) var(--alv-gradient-from-position)", "--alv-gradient-to": "hsl(var(--accent)) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), color-mix(in srgb, hsl(var(--primary)) 90%, transparent) var(--alv-gradient-via-position), var(--alv-gradient-to)", position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ position: "absolute", inset: "0px", backgroundImage: "radial-gradient(circle at 30% 20%,color-mix(in srgb, hsl(var(--primary)) 30%, transparent),transparent 50%)" }}/>
        <Box sx={{ position: "relative", zIndex: "10", textAlign: "center", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" }, paddingLeft: "3rem", paddingRight: "3rem" }}>
          <Box sx={{ height: "5rem", width: "5rem", borderRadius: "1rem", backgroundColor: "rgb(255 255 255 / 0.1)", "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto" }}>
            <Box component={Zap} sx={{ height: "2.5rem", width: "2.5rem", color: "rgb(255 255 255 / 1)" }}/>
          </Box>
          <PageHeader title={"ALVStore"} subtitle={"ERP 2026"}/>
          <Typography component="p" variant="body1" sx={{ color: "rgb(255 255 255 / 0.7)", fontSize: "0.875rem", lineHeight: "1.625", maxWidth: "20rem", marginLeft: "auto", marginRight: "auto" }}>
            Join the platform trusted by businesses for complete operational control.
          </Typography>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box sx={{ flex: "1 1 0%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
        <Box sx={{ width: "100%", maxWidth: "24rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "2rem" } }}>
          <Box sx={{ "@media (min-width: 1024px)": { display: "none" }, textAlign: "center" }}>
            <Box sx={{ height: "3.5rem", width: "3.5rem", borderRadius: "0.75rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "hsl(var(--primary)) var(--alv-gradient-from-position)", "--alv-gradient-to": "hsl(var(--accent)) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem" }}>
              <Box component={Zap} sx={{ height: "1.75rem", width: "1.75rem", color: "rgb(255 255 255 / 1)" }}/>
            </Box>
          </Box>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            <Typography component="h2" variant="h2" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.025em" }}>Create account</Typography>
            <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem" }}>Get started with ALVStore ERP</Typography>
          </Box>

          <Box onSubmit={handleSignup} component="form" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>

              <TextField id="name" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required label={"Full Name"} size="small" fullWidth sx={{ height: "2.75rem" }}/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>

              <TextField id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required label={"Email"} size="small" fullWidth sx={{ height: "2.75rem" }}/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <FormLabel htmlFor="password">Password</FormLabel>
              <Box sx={{ position: "relative" }}>
                <TextField id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required size="small" fullWidth slotProps={{ htmlInput: { minLength: 6, "aria-label": "••••••••" } }} sx={{ height: "2.75rem", paddingRight: "2.5rem" }}/>
                <ButtonBase type="button" onClick={() => setShowPassword(!showPassword)} sx={{ position: "absolute", right: "0.75rem", top: "50%", "--alv-translate-y": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                  {showPassword ? <Box component={EyeOff} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/>}
                </ButtonBase>
              </Box>
            </Box>
            <Button type="submit" disabled={loading} variant="contained" sx={{ width: "100%", height: "2.75rem" }}>
              {loading ? <><Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>Creating account...</> : "Create Account"}
            </Button>
          </Box>

          <Typography component="p" variant="body1" sx={{ textAlign: "center", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
            Already have an account?{" "}
            <Link to="/login" sx={{ color: "hsl(var(--primary))", fontWeight: "500", "&:hover": { textDecorationLine: "underline" } }}>Sign in</Link>
          </Typography>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
