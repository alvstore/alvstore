"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { ArrowOutward, ContentCopy, Check } from "@mui/icons-material";
import { motion, useReducedMotion } from "framer-motion";
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
 * Enquiry as a written note, not a funnel. The form composes a complete
 * message and hands it to the visitor's mail app or WhatsApp, so nothing is
 * silently lost to a backend permission and the studio gets real detail.
 */
export function VisitSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [room, setRoom] = useState(ROOM_TYPES[0]);
  const [note, setNote] = useState("");
  const [loadedRoomHint, setLoadedRoomHint] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onRoomSelect = (event: Event) => {
      const detail = (event as CustomEvent<StudioRoomSelectionPayload & { formattedNote?: string }>).detail;
      if (!detail) return;
      const formatted = detail.formattedNote ?? formatConsultationNote(detail);
      setRoom(ROOM_TYPES[0]);
      setNote(prev => mergeConsultationNote(prev, formatted));
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

  const nameOk = name.trim().length > 1;
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = nameOk && phoneOk && emailOk;

  const sendMail = () => {
    setTouched(true);
    if (!valid) return;
    const subject = encodeURIComponent(`Cinema consultation — ${room} — ${city.trim() || "India"}`);
    window.location.href = `mailto:${STUDIO_INFO.email}?subject=${subject}&body=${encodeURIComponent(message)}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
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
                sendMail();
              }}
              aria-labelledby="visit-form-title"
              sx={{ borderTop: `1px solid ${STUDIO.graphite}`, pt: 3 }}
            >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: loadedRoomHint ? 1.5 : 3 }}>
              <Typography id="visit-form-title" component="h3" sx={{ ...TYPE.exhibit, fontSize: "1.16rem", color: STUDIO.graphite, fontStretch: "100%" }}>
                Write to us
              </Typography>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", whiteSpace: "nowrap" }}>
                Opens your mail app
              </Typography>
            </Box>

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

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                disableElevation
                endIcon={<ArrowOutward sx={{ fontSize: "1rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  bgcolor: STUDIO.graphite,
                  color: STUDIO.chalk,
                  borderRadius: "2px",
                  px: 3,
                  py: 1.25,
                  transition: `transform 200ms ${EASE}, background-color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
                  "&:hover": { bgcolor: STUDIO.ink, transform: "translateY(-1px)", boxShadow: "0 4px 16px rgba(22,24,26,0.12)" },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                Send the note
              </Button>
              <Button
                type="button"
                onClick={copy}
                variant="text"
                startIcon={copied ? <Check sx={{ fontSize: "0.95rem !important" }} /> : <ContentCopy sx={{ fontSize: "0.9rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  color: STUDIO.slate,
                  transition: `color 200ms ${EASE}, transform 200ms ${EASE}`,
                  "&:hover": { bgcolor: "transparent", color: STUDIO.graphite },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                {copied ? "Copied" : "Copy the text"}
              </Button>
            </Box>
            <Alert
              severity="info"
              icon={false}
              sx={{ mt: 2.5, bgcolor: "transparent", border: `1px solid ${STUDIO.hair}`, borderRadius: "2px", py: 0.5, "& .MuiAlert-message": { ...TYPE.placard, fontSize: "0.84rem", color: STUDIO.slate } }}
            >
              We answer notes within one working day. Nothing you write here is stored on this
              site — it travels with you to your mail app.
            </Alert>
          </Box>
        </Box>
      </Box>
    </Box>
  </Box>
  );
}
