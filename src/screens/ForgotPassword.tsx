"use client";

import { Box, Button, TextField, Typography } from "@mui/material";
import { AnimatedPage, mergeSx, toast } from "@/components/mui";
import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ArrowLeft, Loader2, Mail } from "lucide-react";
export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [devResetLink, setDevResetLink] = useState<string | null>(null);
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        setLoading(false);
        if (error) {
            toast.error(error.message);
        }
        else {
            setSent(true);
            toast.success("Check your email for the reset link!");
            // Dev mode (no SMTP configured): the API returns the link directly.
            const devLink = (data as {
                dev_reset_link?: string;
            } | null)?.dev_reset_link;
            if (devLink) {
                toast.info("Dev mode: open the reset link printed below / in server logs", { duration: 15000 });
                console.log("[forgot-password] reset link:", devLink);
                setDevResetLink(devLink);
            }
        }
    };
    return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
      <Box sx={{ width: "100%", maxWidth: "24rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "2rem" } }}>
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ height: "3.5rem", width: "3.5rem", borderRadius: "0.75rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "hsl(var(--primary)) var(--alv-gradient-from-position)", "--alv-gradient-to": "hsl(var(--accent)) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto", marginBottom: "1rem" }}>
            <Box component={Zap} sx={{ height: "1.75rem", width: "1.75rem", color: "rgb(255 255 255 / 1)" }}/>
          </Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.025em" }}>Reset Password</Typography>
          <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.25rem" }}>
            {sent ? "Check your email" : "Enter your email to receive a reset link"}
          </Typography>
        </Box>

        {sent ? (<Box sx={{ textAlign: "center", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ height: "4rem", width: "4rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto" }}>
              <Box component={Mail} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--success))" }}/>
            </Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
              We've sent a password reset link to <Box component="strong" sx={{ color: "hsl(var(--foreground))" }}>{email}</Box>
            </Typography>
            {devResetLink && (<Box sx={{ borderRadius: "calc(var(--radius) - 2px)", borderWidth: "1px", borderColor: "rgb(245 158 11 / 0.3)", backgroundColor: "rgb(245 158 11 / 0.1)", padding: "0.75rem", fontSize: "0.75rem", lineHeight: "1rem", wordBreak: "break-all", textAlign: "left" }}>
                <Box component="span" sx={{ fontWeight: "500" }}>Dev mode (no SMTP) — reset link:</Box>{" "}
                <Box href={devResetLink} component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { color: "hsl(var(--primary))", textDecorationLine: "underline" })}>{devResetLink}</Box>
              </Box>)}
            <Link to="/login">
              <Button variant="outlined" sx={{ width: "100%", height: "2.75rem" }}>
                <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Back to login
              </Button>
            </Link>
          </Box>) : (<Box onSubmit={handleReset} component="form" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>

              <TextField id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required label={"Email"} size="small" fullWidth sx={{ height: "2.75rem" }}/>
            </Box>
            <Button type="submit" disabled={loading} variant="contained" sx={{ width: "100%", height: "2.75rem" }}>
              {loading ? <><Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>Sending...</> : "Send Reset Link"}
            </Button>
            <Link to="/login" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
              <Box component={ArrowLeft} sx={{ height: "0.875rem", width: "0.875rem" }}/>Back to login
            </Link>
          </Box>)}
      </Box>
    </Box></AnimatedPage>;
}
