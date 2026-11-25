"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { OpenInNew, Visibility, VisibilityOff } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { Link, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedPage, BrandMark } from "@/components/mui";
import { signInFailure } from "@/lib/auth-errors";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [loginError, setLoginError] = useState<{ message: string; code?: string } | null>(null);
  const navigate = useNavigate();
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoginError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setLoginError(error);
      else navigate("/dashboard");
    } catch { setLoginError(signInFailure()); }
    finally { setLoading(false); }
  };
  return <AnimatedPage><Box sx={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
    <Box sx={theme => ({ display: { xs: "none", lg: "grid" }, placeItems: "center", p: 8, color: theme.palette.primary.contrastText, background: `radial-gradient(circle at 25% 15%, ${alpha(theme.palette.secondary.light, 0.45)}, transparent 55%), linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})` })}>
      <Stack spacing={3} sx={{ alignItems: "center", maxWidth: 420, textAlign: "center" }}>
        <BrandMark size={76} badgeColor="rgba(255,255,255,.14)" foregroundColor="#FFFFFF" crescentColor="rgba(0,0,0,.14)" sx={{ border: "1px solid rgba(255,255,255,.2)" }} />
        <Box><Typography variant="h3" sx={{ fontWeight: 800 }}>ALVStore</Typography><Typography variant="overline" sx={{ letterSpacing: ".25em", opacity: .7 }}>ERP 2026</Typography></Box>
        <Typography sx={{ opacity: .8 }}>Complete business management — CRM, Repairs, POS, Finance, and Inventory in one unified platform.</Typography>
        <Stack direction="row" spacing={1}>{["CRM", "POS", "Repairs", "Finance"].map(label => <Chip key={label} label={label} sx={{ color: "inherit", bgcolor: "rgba(255,255,255,.12)" }} />)}</Stack>
      </Stack>
    </Box>
    <Box sx={{ display: "grid", placeItems: "center", p: { xs: 3, sm: 5 }, bgcolor: "background.default" }}>
      <Box sx={{ width: "100%", maxWidth: 380 }}>
        <Typography variant="h5" sx={{ display: { lg: "none" }, color: "primary.main", fontWeight: 800, mb: 5 }}>ALVStore ERP</Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 750, mb: 1 }}>Welcome back</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 4 }}>Sign in to your account to continue</Typography>
        <Box component="form" onSubmit={handleLogin} sx={{ display: "grid", gap: 2.5 }}>
          {loginError && <Alert severity="error">{loginError.message}</Alert>}
          <TextField id="email" label="Email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required fullWidth autoFocus />
          <TextField id="password" label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required fullWidth
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} onMouseDown={event => event.preventDefault()} edge="end">{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }} />
          <Link to="/forgot-password" sx={{ justifySelf: "end", fontSize: 12, color: "primary.main" }}>Forgot password?</Link>
          <Button type="submit" variant="contained" disabled={loading} size="large" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>{loading ? "Signing in…" : "Sign In"}</Button>
        </Box>
        {(embedded || loginError?.code === "AUTH_COOKIES_BLOCKED" || loginError?.code === "AUTH_SESSION_UNAVAILABLE") && <Button
          component="a" href="/login" target="_blank" rel="noopener noreferrer" variant="text" startIcon={<OpenInNew fontSize="small" />}
          sx={{ mt: 2, width: "100%" }}>Open sign-in in a new tab</Button>}
        <Typography component="div" variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>Don’t have an account? <Link to="/signup" sx={{ color: "primary.main", fontWeight: 600 }}>Create account</Link></Typography>
      </Box>
    </Box>
  </Box></AnimatedPage>;
}
