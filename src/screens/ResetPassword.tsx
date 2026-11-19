"use client";

import { Box, Button, ButtonBase, FormLabel, TextField, Typography } from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const searchParams = useSearchParams();
    const token = searchParams?.get("token") ?? "";
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (token) {
                // Token-based reset (from the forgot-password email/link)
                const res = await fetch("/api/backend/auth/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, password }),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    toast.error(body?.error?.message ?? "Reset failed");
                }
                else {
                    toast.success("Password updated! You can sign in now.");
                    navigate("/login");
                }
            }
            else {
                // Signed-in user changing their password
                const { error } = await supabase.auth.updateUser({ password });
                if (error) {
                    toast.error(error.message);
                }
                else {
                    toast.success("Password updated!");
                    navigate("/");
                }
            }
        }
        finally {
            setLoading(false);
        }
    };
    return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
      <Box sx={{ width: "100%", maxWidth: "24rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "2rem" } }}>
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ height: "3.5rem", width: "3.5rem", borderRadius: "0.75rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "hsl(var(--primary)) var(--alv-gradient-from-position)", "--alv-gradient-to": "hsl(var(--accent)) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto", marginBottom: "1rem" }}>
            <Box component={Zap} sx={{ height: "1.75rem", width: "1.75rem", color: "rgb(255 255 255 / 1)" }}/>
          </Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.025em" }}>Set New Password</Typography>
          <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.25rem" }}>Enter your new password below</Typography>
        </Box>

        <Box onSubmit={handleUpdate} component="form" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            <FormLabel htmlFor="password">New Password</FormLabel>
            <Box sx={{ position: "relative" }}>
              <TextField id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required size="small" fullWidth slotProps={{ htmlInput: { minLength: 6, "aria-label": "••••••••" } }} sx={{ height: "2.75rem", paddingRight: "2.5rem" }}/>
              <ButtonBase type="button" onClick={() => setShowPassword(!showPassword)} sx={{ position: "absolute", right: "0.75rem", top: "50%", "--alv-translate-y": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                {showPassword ? <Box component={EyeOff} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/>}
              </ButtonBase>
            </Box>
          </Box>
          <Button type="submit" disabled={loading} variant="contained" sx={{ width: "100%", height: "2.75rem" }}>
            {loading ? <><Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>Updating...</> : "Update Password"}
          </Button>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
