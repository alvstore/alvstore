"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from "@mui/material";
import { ArrowOutward, ContentCopy, Check } from "@mui/icons-material";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { STUDIO_INFO } from "./content";
import {
  formatConsultationNote,
  mergeConsultationNote,
  STUDIO_ROOM_SELECT_EVENT,
  type StudioRoomSelectionPayload,
} from "./room-calculator";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

/** Theme overrides used by the studio's form fields (standard variant, hairline). */
export const studioFieldSx = {
  "& .MuiInputLabel-root": { ...TYPE.label, color: STUDIO.slate },
  "& .MuiInputLabel-root.Mui-focused": { color: STUDIO.brass },
  "& .MuiInputBase-input": { fontFamily: FONT.text, fontSize: "1rem", color: STUDIO.graphite, py: 1 },
  "& .MuiInput-underline:before": { borderColor: STUDIO.hair },
  "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderColor: STUDIO.hairStrong },
  "& .MuiInput-underline:after": { borderColor: STUDIO.brass },
  "& .MuiFormHelperText-root": { fontFamily: FONT.text, fontSize: "0.74rem", color: STUDIO.mist },
} as const;

const WHATSAPP = `https://wa.me/919887601200`;

const ROOM_TYPES = ["A private cinema", "A 4K laser projector setup", "A dedicated listening room", "Living-room surround audio", "After-sales service & calibration", "Something else"];

/**
 * Consultation enquiry form wired to the backend CRM (`public-lead`) so every
 * room specification and message lands directly in Leads with an admin alert,
 * while preserving WhatsApp, email app, and copy fallbacks.
 */
export function VisitSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [room, setRoom] = useState(ROOM_TYPES[0]);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [loadedRoomHint, setLoadedRoomHint] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedState, setSubmittedState] = useState<{ leadId?: string; messageSnapshot: string } | null>(null);

  useEffect(() => {
    const onRoomSelect = (event: Event) => {
      const detail = (event as CustomEvent<StudioRoomSelectionPayload & { formattedNote?: string }>).detail;
      if (!detail) return;
      const formatted = detail.formattedNote ?? formatConsultationNote(detail);
      setRoom(ROOM_TYPES[0]);
      setNote(prev => mergeConsultationNote(prev, formatted));
      setSubmitError(null);
      setSubmittedState(null);
      setLoadedRoomHint(
        `Loaded your ${detail.lengthFt} × ${detail.widthFt} ft · ${detail.configId} (${detail.screenIn}″) configuration into the message below.`,
      );
    };
    window.addEventListener(STUDIO_ROOM_SELECT_EVENT, onRoomSelect);
    return () => window.removeEventListener(STUDIO_ROOM_SELECT_EVENT, onRoomSelect);
  }, []);

  const message = useMemo(() => {
    const lines = [
      `Hello ALVStore,`,
      ``,
      `I'd like to arrange a consultation about: ${room}.`,
      note.trim() ? `${note.trim()}` : null,
      ``,
      `Name: ${name.trim() || "—"}`,
      `Mobile: ${phone.trim() || "—"}`,
      `Email: ${email.trim() || "—"}`,
      `City: ${city.trim() || "—"}`,
    ].filter(line => line !== null);
    return lines.join("\n");
  }, [name, phone, email, city, room, note]);

  const activeMessage = name.trim() || note.trim() || !submittedState ? message : submittedState.messageSnapshot;

  const nameOk = name.trim().length > 1;
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = nameOk && phoneOk && emailOk;

  const submitEnquiry = async () => {
    setTouched(true);
    setSubmitError(null);
    if (!valid || submitting) return;

    setSubmitting(true);
    const snapshot = message;
    const { data, error } = await supabase.functions.invoke("public-lead", {
      body: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        room,
        note: note.trim(),
        website,
      },
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message || "Could not send your enquiry right now. Please reach out on WhatsApp or call us.");
      return;
    }

    const payload = (data ?? {}) as { lead_id?: string };
    setSubmittedState({ leadId: payload.lead_id, messageSnapshot: snapshot });
    setLoadedRoomHint(null);
    setTouched(false);
    setName("");
    setPhone("");
    setEmail("");
    setCity("");
    setNote("");
  };

  const openMailApp = () => {
    const subject = encodeURIComponent(`Cinema consultation — ${room} — ${city.trim() || "India"}`);
    window.location.href = `mailto:${STUDIO_INFO.email}?subject=${subject}&body=${encodeURIComponent(activeMessage)}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const reduced = useReducedMotion();

  return (
    <Box component="section" id="visit" sx={{ bgcolor: STUDIO.chalk, scrollMarginTop: 44, position: "relative" }}>
      <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 9, md: 13 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" }, gap: { xs: 6, md: 10 } }}>
          {/* Left Column: Studio Consultation & Contact Channels with Motion */}
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reduced ? 0 : 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <Typography sx={{ ...TYPE.label, color: STUDIO.brass, mb: 1.5 }}>The consultation</Typography>
            <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.graphite, textWrap: "balance" }}>
              Start with a
              <Box component="span" sx={{ display: "block", fontFamily: FONT.text, fontStyle: "italic", fontWeight: 400, fontSize: "0.86em", letterSpacing: "-0.01em" }}>
                room consultation.
              </Box>
            </Typography>
            <Typography sx={{ ...TYPE.lead, color: STUDIO.slate, mt: 2.5, maxWidth: "46ch" }}>
              A focused consultation with no obligation: we evaluate your room dimensions, sightlines,
              4K laser projection throw, and acoustic dynamics to give you an honest, engineered proposal.
            </Typography>

            <Box component="dl" sx={{ m: 0, mt: 4, display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.05rem 2.2rem", borderTop: `1px solid ${STUDIO.hairStrong}`, pt: 3 }}>
              {[
                { k: "Studio", v: STUDIO_INFO.address, href: STUDIO_INFO.mapsUrl, external: true },
                { k: "Phone", v: STUDIO_INFO.phone, href: STUDIO_INFO.phoneHref, external: false },
                { k: "Email", v: STUDIO_INFO.email, href: STUDIO_INFO.emailHref, external: false },
                { k: "Hours", v: `${STUDIO_INFO.hours} · ${STUDIO_INFO.hoursSunday}`, href: undefined, external: false },
              ].map(row => (
                <Box key={row.k} sx={{ display: "contents" }}>
                  <Typography component="dt" sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.66rem", pt: "3px" }}>
                    {row.k}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0 }}>
                    {row.href ? (
                      <Box
                        component="a"
                        href={row.href}
                        target={row.external ? "_blank" : undefined}
                        rel={row.external ? "noopener noreferrer" : undefined}
                        sx={{
                          fontFamily: FONT.text,
                          fontSize: "1rem",
                          color: STUDIO.graphite,
                          textDecoration: "none",
                          borderBottom: `1px solid ${STUDIO.hairStrong}`,
                          transition: `color 180ms ${EASE}, border-color 180ms ${EASE}`,
                          "&:hover": { color: STUDIO.brass, borderColor: STUDIO.brass },
                        }}
                      >
                        {row.v} {row.external ? "↗" : ""}
                      </Box>
                    ) : (
                      <Typography component="span" sx={{ fontFamily: FONT.text, fontSize: "1rem", color: STUDIO.graphite }}>{row.v}</Typography>
                    )}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.2 }}>
              <Button
                component="a"
                href={STUDIO_INFO.phoneHref}
                variant="outlined"
                sx={{
                  ...TYPE.label,
                  borderRadius: "2px",
                  borderColor: STUDIO.hairStrong,
                  color: STUDIO.graphite,
                  px: 2.4,
                  py: 1,
                  transition: `transform 200ms ${EASE}, border-color 200ms ${EASE}`,
                  "&:hover": { borderColor: STUDIO.graphite, bgcolor: "transparent", transform: "translateY(-1px)" },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                Call the studio
              </Button>
              <Button
                component="a"
                href={STUDIO_INFO.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<ArrowOutward sx={{ fontSize: "0.85rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  borderRadius: "2px",
                  borderColor: STUDIO.hairStrong,
                  color: STUDIO.graphite,
                  px: 2.2,
                  py: 1,
                  transition: `transform 200ms ${EASE}, border-color 200ms ${EASE}`,
                  "&:hover": { borderColor: STUDIO.brass, color: STUDIO.brass, bgcolor: "transparent", transform: "translateY(-1px)" },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                Directions on Maps
              </Button>
              <Button
                component="a"
                href={`${WHATSAPP}?text=${encodeURIComponent("Hello ALVStore, I'd like to book a private cinema consultation for my home.")}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="text"
                endIcon={<ArrowOutward sx={{ fontSize: "0.95rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  color: STUDIO.verdigris,
                  transition: `color 200ms ${EASE}, transform 200ms ${EASE}`,
                  "&:hover": { bgcolor: "transparent", color: STUDIO.graphite, transform: "translateX(2px)" },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                Message on WhatsApp
              </Button>
            </Box>
          </Box>

          {/* Right Column: Interactive Consultation Note with Motion */}
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reduced ? 0 : 0.65, delay: reduced ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Box
              component="form"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                void submitEnquiry();
              }}
              aria-labelledby="visit-form-title"
              sx={{ borderTop: `1px solid ${STUDIO.graphite}`, pt: 3, position: "relative" }}
            >
            <Box
              component="input"
              type="text"
              name="website"
              value={website}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              sx={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: loadedRoomHint || submittedState || submitError ? 1.5 : 3 }}>
              <Typography id="visit-form-title" component="h3" sx={{ ...TYPE.exhibit, fontSize: "1.16rem", color: STUDIO.graphite, fontStretch: "100%" }}>
                Write to us
              </Typography>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", whiteSpace: "nowrap" }}>
                Direct to studio CRM
              </Typography>
            </Box>

            {submittedState && (
              <Alert
                severity="success"
                onClose={() => setSubmittedState(null)}
                sx={{
                  mb: 2.5,
                  bgcolor: "rgba(31,78,66,0.08)",
                  border: "1px solid rgba(31,78,66,0.3)",
                  borderRadius: "2px",
                  py: 0.6,
                  "& .MuiAlert-message": { ...TYPE.placard, fontSize: "0.86rem", color: STUDIO.graphite },
                }}
              >
                Enquiry saved with our acoustic desk — we&apos;ll reach out within one working day.
              </Alert>
            )}

            {submitError && (
              <Alert
                severity="error"
                onClose={() => setSubmitError(null)}
                sx={{
                  mb: 2.5,
                  borderRadius: "2px",
                  py: 0.5,
                  "& .MuiAlert-message": { ...TYPE.placard, fontSize: "0.84rem" },
                }}
              >
                {submitError}
              </Alert>
            )}

            {loadedRoomHint && (
              <Alert
                severity="success"
                icon={false}
                sx={{
                  mb: 2.5,
                  bgcolor: "rgba(156,123,73,0.09)",
                  border: "1px solid rgba(156,123,73,0.3)",
                  borderRadius: "2px",
                  py: 0.4,
                  "& .MuiAlert-message": { ...TYPE.placard, fontSize: "0.82rem", color: STUDIO.graphite },
                }}
              >
                {loadedRoomHint}
              </Alert>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Your name"
                required
                value={name}
                onChange={event => setName(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && !nameOk}
                helperText={touched && !nameOk ? "Please add a name we can call you." : " "}
                autoComplete="name"
                variant="standard"
                sx={studioFieldSx}
              />
              <TextField
                label="Mobile / Phone"
                required
                value={phone}
                onChange={event => setPhone(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && !phoneOk}
                helperText={touched && !phoneOk ? "A 10-digit mobile number is mandatory." : " "}
                autoComplete="tel"
                inputMode="tel"
                variant="standard"
                sx={studioFieldSx}
              />
              <TextField
                label="Email address"
                required
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && !emailOk}
                helperText={touched && !emailOk ? "A valid email address is mandatory." : " "}
                autoComplete="email"
                inputMode="email"
                variant="standard"
                sx={studioFieldSx}
              />
              <TextField
                label="City"
                placeholder="e.g. Udaipur, Jaipur, Delhi, Mumbai"
                value={city}
                onChange={event => setCity(event.target.value)}
                autoComplete="address-level2"
                variant="standard"
                sx={studioFieldSx}
              />
              <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                <TextField
                  select
                  fullWidth
                  label="This is about"
                  value={room}
                  onChange={event => setRoom(event.target.value)}
                  variant="standard"
                  slotProps={{ inputLabel: { shrink: Boolean(room) } }}
                  sx={studioFieldSx}
                >
                  {ROOM_TYPES.map(type => (
                    <MenuItem key={type} value={type} sx={{ fontFamily: FONT.text, fontSize: "0.95rem" }}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>

            <TextField
              label="The room, in your words"
              placeholder="Size, ceiling height, windows, what you watch and listen to…"
              value={note}
              onChange={event => setNote(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              variant="standard"
              sx={[{ mt: 2.5 }, studioFieldSx]}
            />

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25, mt: 3 }}>
              <Button
                type="submit"
                disabled={submitting}
                variant="contained"
                disableElevation
                endIcon={
                  submitting ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <ArrowOutward sx={{ fontSize: "1rem !important" }} />
                  )
                }
                sx={{
                  ...TYPE.label,
                  bgcolor: STUDIO.graphite,
                  color: STUDIO.chalk,
                  borderRadius: "2px",
                  minHeight: 38,
                  px: 3,
                  py: 1.25,
                  transition: `transform 200ms ${EASE}, background-color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
                  "&:hover": { bgcolor: STUDIO.ink, transform: "translateY(-1px)", boxShadow: "0 4px 16px rgba(22,24,26,0.12)" },
                  "&:active": { transform: "scale(0.98)" },
                  "&.Mui-disabled": { bgcolor: STUDIO.slate, color: STUDIO.chalk },
                }}
              >
                {submitting ? "Sending enquiry…" : "Send enquiry"}
              </Button>
              <Button
                type="button"
                component="a"
                href={`${WHATSAPP}?text=${encodeURIComponent(activeMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<ArrowOutward sx={{ fontSize: "0.9rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  minHeight: 38,
                  borderRadius: "2px",
                  borderColor: STUDIO.hairStrong,
                  color: STUDIO.verdigris,
                  px: 2,
                  "&:hover": { borderColor: STUDIO.verdigris, bgcolor: "rgba(31,78,66,0.04)" },
                }}
              >
                WhatsApp note
              </Button>
              <Button
                type="button"
                onClick={openMailApp}
                variant="text"
                sx={{
                  ...TYPE.label,
                  minHeight: 38,
                  color: STUDIO.slate,
                  "&:hover": { bgcolor: "transparent", color: STUDIO.graphite },
                }}
              >
                Email app
              </Button>
              <Button
                type="button"
                onClick={copy}
                variant="text"
                startIcon={copied ? <Check sx={{ fontSize: "0.95rem !important" }} /> : <ContentCopy sx={{ fontSize: "0.9rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  minHeight: 38,
                  color: STUDIO.slate,
                  transition: `color 200ms ${EASE}, transform 200ms ${EASE}`,
                  "&:hover": { bgcolor: "transparent", color: STUDIO.graphite },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                {copied ? "Copied" : "Copy text"}
              </Button>
            </Box>
            <Alert
              severity="info"
              icon={false}
              sx={{ mt: 2.5, bgcolor: "transparent", border: `1px solid ${STUDIO.hair}`, borderRadius: "2px", py: 0.5, "& .MuiAlert-message": { ...TYPE.placard, fontSize: "0.84rem", color: STUDIO.slate } }}
            >
              Your note saves straight into our studio CRM and alerts our acoustic engineers — we answer
              within one working day. You can also continue via WhatsApp or email anytime.
            </Alert>
          </Box>
        </Box>
      </Box>
    </Box>
  </Box>
  );
}
