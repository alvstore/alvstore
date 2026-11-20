"use client";

import {
  Box,
  Button,
  ButtonBase,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Speaker,
  Phone,
  MapPin,
  Mail,
  Clock,
  ShieldCheck,
  Wrench,
  Search,
  Sparkles,
} from "lucide-react";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";
import {
  ConsultationModal,
  RepairIntakeModal,
  TrackOrderModal,
} from "@/components/home-theater/CinemaModals";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";

export default function HomeTheaterContact() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "Udaipur",
    requirement: "Dedicated Cinema Room",
    budget: "₹8L - ₹15L",
    room_size: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }
    setSubmitting(true);
    const combinedNotes = [
      formData.requirement && `Requirement: ${formData.requirement}`,
      formData.budget && `Budget: ${formData.budget}`,
      formData.room_size && `Room Size: ${formData.room_size}`,
      formData.city && `City: ${formData.city}`,
      formData.notes && `Notes: ${formData.notes}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("leads").insert({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      source: "website-contact-page",
      notes: combinedNotes,
      status: "new",
    });

    if (error) {
      toast.error("Submission failed. Please call us directly.");
    } else {
      toast.success(
        "Consultation request submitted! Our chief acoustic engineer will contact you shortly."
      );
      setFormData({
        name: "",
        phone: "",
        email: "",
        city: "Udaipur",
        requirement: "Dedicated Cinema Room",
        budget: "₹8L - ₹15L",
        room_size: "",
        notes: "",
      });
    }
    setSubmitting(false);
  };

  return (
    <AnimatedPage>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#09070F",
          color: CINEMA_COLORS.WARM_WHITE,
          fontFamily: TYPOGRAPHY.fontBody,
        }}
      >
        {/* Navigation Bar */}
        <Box
          component="nav"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            bgcolor: "rgba(9, 7, 15, 0.92)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(232, 184, 108, 0.15)",
          }}
        >
          <Box
            sx={{
              maxWidth: "84rem",
              mx: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: { xs: 2, sm: 3, md: 4 },
              py: 1.5,
            }}
          >
            <Link
              to="/"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                textDecoration: "none",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "0.75rem",
                  bgcolor: "rgba(232, 184, 108, 0.15)",
                  border: "1px solid rgba(232, 184, 108, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  component={Speaker}
                  sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD }}
                />
              </Box>
              <Box>
                <Typography
                  component="span"
                  variant="h6"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: CINEMA_COLORS.WARM_WHITE,
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  ALV STORE
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    fontSize: "0.625rem",
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: CINEMA_COLORS.GOLD,
                    fontWeight: 600,
                  }}
                >
                  Cinema & Acoustics
                </Typography>
              </Box>
            </Link>

            <Box
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                gap: 2.5,
              }}
            >
              <Link
                to="/"
                sx={{
                  color: "rgba(245, 239, 227, 0.7)",
                  fontSize: "0.8125rem",
                  "&:hover": { color: CINEMA_COLORS.GOLD },
                }}
              >
                Experience Store
              </Link>
              <Link
                to="/#services"
                sx={{
                  color: "rgba(245, 239, 227, 0.7)",
                  fontSize: "0.8125rem",
                  "&:hover": { color: CINEMA_COLORS.GOLD },
                }}
              >
                Systems
              </Link>
              <Link
                to="/#soundstage"
                sx={{
                  color: "rgba(245, 239, 227, 0.7)",
                  fontSize: "0.8125rem",
                  "&:hover": { color: CINEMA_COLORS.GOLD },
                }}
              >
                Dolby Atmos
              </Link>
              <Link
                to="/#configurator"
                sx={{
                  color: "rgba(245, 239, 227, 0.7)",
                  fontSize: "0.8125rem",
                  "&:hover": { color: CINEMA_COLORS.GOLD },
                }}
              >
                Configurator
              </Link>
              <Link
                to="/contact"
                sx={{
                  color: CINEMA_COLORS.GOLD,
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                }}
              >
                Contact
              </Link>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ButtonBase
                onClick={() => setTrackModalOpen(true)}
                type="button"
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "rgba(245, 239, 227, 0.75)",
                  bgcolor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  "&:hover": { color: "#fff" },
                }}
              >
                <Box component={Search} sx={{ width: 13, height: 13 }} />
                Track Order
              </ButtonBase>
              <ButtonBase
                onClick={() => setRepairModalOpen(true)}
                type="button"
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#C97B6E",
                  bgcolor: "rgba(201, 123, 110, 0.1)",
                  border: "1px solid rgba(201, 123, 110, 0.3)",
                }}
              >
                <Box component={Wrench} sx={{ width: 13, height: 13 }} />
                Repair Intake
              </ButtonBase>
            </Box>
          </Box>
        </Box>

        {/* Main Content */}
        <Box
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            backgroundImage:
              "radial-gradient(ellipse at 50% 10%, rgba(42, 27, 61, 0.5), transparent 70%)",
          }}
        >
          <Box
            sx={{
              maxWidth: "76rem",
              mx: "auto",
              px: { xs: 2, sm: 3, md: 4 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1.3fr" },
              gap: { xs: 6, lg: 8 },
              alignItems: "start",
            }}
          >
            {/* Left Column: Direct Contact & Showroom Info */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              <Box>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    px: 2,
                    py: 0.5,
                    borderRadius: 99,
                    bgcolor: "rgba(232, 184, 108, 0.08)",
                    border: "1px solid rgba(232, 184, 108, 0.25)",
                    color: CINEMA_COLORS.GOLD,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    mb: 2,
                  }}
                >
                  <Box component={Sparkles} sx={{ width: 13, height: 13 }} />
                  Private Acoustic Commissioning
                </Box>
                <Typography
                  component="h1"
                  variant="h2"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontSize: { xs: "2.25rem", md: "3.25rem" },
                    fontWeight: 700,
                    color: CINEMA_COLORS.WARM_WHITE,
                    lineHeight: 1.1,
                    mb: 2,
                  }}
                >
                  Get In Touch with Our{" "}
                  <Box
                    component="span"
                    sx={{
                      background:
                        "linear-gradient(135deg, #FFF1D6 0%, #E8B86C 50%, #B8862E 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Acoustic Engineers
                  </Box>
                </Typography>
                <Typography
                  component="p"
                  variant="body1"
                  sx={{
                    color: "rgba(245, 239, 227, 0.65)",
                    lineHeight: 1.6,
                    fontSize: "0.9375rem",
                  }}
                >
                  Whether designing a flagship 9.4.6 Dolby Atmos estate screening hall
                  or needing precision component-level diagnostics for high-end audio
                  gear, our master technicians are ready to assist.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                  {
                    icon: Phone,
                    label: "Direct Lab Phone",
                    value: "+91 98290 00000",
                    action: () => window.open("tel:+919829000000"),
                  },
                  {
                    icon: Mail,
                    label: "Executive Inquiries",
                    value: "consult@alvstore.com",
                    action: () => window.open("mailto:consult@alvstore.com"),
                  },
                  {
                    icon: MapPin,
                    label: "Showroom & Lab Locations",
                    value: "Udaipur & Jaipur, Rajasthan, India",
                    action: undefined,
                  },
                  {
                    icon: Clock,
                    label: "Consultation Hours",
                    value: "Mon–Sat: 10:00 AM – 8:00 PM IST",
                    action: undefined,
                  },
                ].map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <Box
                      key={idx}
                      onClick={item.action}
                      sx={{
                        p: 2,
                        borderRadius: "1rem",
                        bgcolor: "rgba(18, 14, 28, 0.7)",
                        border: "1px solid rgba(232, 184, 108, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        cursor: item.action ? "pointer" : "default",
                        transition: "all 0.2s ease",
                        "&:hover": item.action
                          ? { borderColor: CINEMA_COLORS.GOLD, transform: "translateX(4px)" }
                          : {},
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: "0.75rem",
                          bgcolor: "rgba(232, 184, 108, 0.12)",
                          border: "1px solid rgba(232, 184, 108, 0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: CINEMA_COLORS.GOLD,
                        }}
                      >
                        <Box component={IconComp} sx={{ width: 18, height: 18 }} />
                      </Box>
                      <Box>
                        <Typography
                          component="p"
                          variant="caption"
                          sx={{
                            color: "rgba(245, 239, 227, 0.45)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontSize: "0.6875rem",
                          }}
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          component="p"
                          variant="body2"
                          sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 600 }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Accreditations Trust Strip */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: "1rem",
                  bgcolor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <Typography
                  component="p"
                  variant="caption"
                  sx={{
                    color: CINEMA_COLORS.GOLD,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    display: "block",
                    mb: 1,
                  }}
                >
                  Authorized Credentials
                </Typography>
                <Typography
                  component="p"
                  variant="caption"
                  sx={{ color: "rgba(245, 239, 227, 0.55)", lineHeight: 1.6 }}
                >
                  THX Level III Acoustic Integrator · Dolby Atmos Certified · ISF Level
                  III Video Calibration Specialist · 5-Year Turnkey On-Site Master Warranty.
                </Typography>
              </Box>
            </Box>

            {/* Right Column: Form Card */}
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: "1.5rem",
                bgcolor: "rgba(18, 14, 28, 0.85)",
                border: "1px solid rgba(232, 184, 108, 0.25)",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Box sx={{ mb: 1 }}>
                <Typography
                  component="h2"
                  variant="h5"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontWeight: 700,
                    color: CINEMA_COLORS.GOLD,
                    mb: 0.5,
                  }}
                >
                  Request On-Site Consultation
                </Typography>
                <Typography
                  component="p"
                  variant="caption"
                  sx={{ color: "rgba(245, 239, 227, 0.55)" }}
                >
                  Fill in your project requirements for an itemized proposal and 3D layout simulation.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Full Name *"
                  size="small"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                />
                <TextField
                  label="Phone Number *"
                  size="small"
                  required
                  placeholder="+91"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Email (Optional)"
                  size="small"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                />
                <TextField
                  label="City / Location"
                  size="small"
                  value={formData.city}
                  onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Requirement Type"
                  select
                  size="small"
                  value={formData.requirement}
                  onChange={(e) => setFormData((p) => ({ ...p, requirement: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                >
                  <MenuItem value="Dedicated Cinema Room">Dedicated Private Cinema</MenuItem>
                  <MenuItem value="Living Room Media Lounge">Living Room Media Lounge</MenuItem>
                  <MenuItem value="Architectural Acoustic Treatment">Architectural Acoustic Treatment</MenuItem>
                  <MenuItem value="Audio Equipment Calibration">THX / ISF Audio Calibration</MenuItem>
                  <MenuItem value="Specialist Repair / Restoration">Specialist Hardware Repair</MenuItem>
                </TextField>
                <TextField
                  label="Investment Tier"
                  select
                  size="small"
                  value={formData.budget}
                  onChange={(e) => setFormData((p) => ({ ...p, budget: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                >
                  <MenuItem value="₹3L - ₹6L">₹3L – ₹6L (Essential High-Fi)</MenuItem>
                  <MenuItem value="₹8L - ₹18L">₹8L – ₹18L (Signature Theater)</MenuItem>
                  <MenuItem value="₹20L - ₹50L+">₹20L – ₹50L+ (Bespoke Ultra Reference)</MenuItem>
                </TextField>
              </Box>

              <TextField
                label="Room Dimensions (e.g. 15×22 ft, 10 ft ceiling)"
                size="small"
                value={formData.room_size}
                onChange={(e) => setFormData((p) => ({ ...p, room_size: e.target.value }))}
                sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
              />

              <TextField
                label="Special Requirements / Gear Preferences"
                size="small"
                multiline
                rows={3}
                placeholder="Preferred screen size, soundproofing needs, preferred brands (KEF, B&W, McIntosh, Sony 4K Laser)..."
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
              />

              <Button
                type="submit"
                disabled={submitting}
                variant="contained"
                sx={{
                  bgcolor: CINEMA_COLORS.GOLD,
                  color: "#0E0B14",
                  fontWeight: 700,
                  py: 1.5,
                  borderRadius: "0.75rem",
                  boxShadow: "0 0 25px rgba(232, 184, 108, 0.35)",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    bgcolor: "#F4D9A8",
                    boxShadow: "0 0 35px rgba(232, 184, 108, 0.5)",
                  },
                }}
              >
                {submitting ? "Submitting Request..." : "Request On-Site Assessment"}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 4,
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            bgcolor: "#06040A",
          }}
        >
          <Box
            sx={{
              maxWidth: "80rem",
              mx: "auto",
              px: { xs: 2, sm: 3, md: 4 },
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Typography
              component="p"
              variant="caption"
              sx={{ color: "rgba(245, 239, 227, 0.35)", fontSize: "0.75rem" }}
            >
              © {new Date().getFullYear()} ALV Store Private Limited. All rights reserved.
            </Typography>
            <Typography
              component="p"
              variant="caption"
              sx={{ color: "rgba(245, 239, 227, 0.35)", fontSize: "0.75rem" }}
            >
              Bespoke Acoustics & Dolby Atmos Cinema Integrator, Udaipur.
            </Typography>
          </Box>
        </Box>

        {/* Action Modals & Floating Concierge */}
        <ConsultationModal
          open={consultModalOpen}
          onClose={() => setConsultModalOpen(false)}
        />
        <RepairIntakeModal
          open={repairModalOpen}
          onClose={() => setRepairModalOpen(false)}
        />
        <TrackOrderModal
          open={trackModalOpen}
          onClose={() => setTrackModalOpen(false)}
        />
        <WhatsAppFloat />
      </Box>
    </AnimatedPage>
  );
}
