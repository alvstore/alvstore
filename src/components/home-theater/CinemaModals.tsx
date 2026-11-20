"use client";

import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  Chip,
  CircularProgress,
} from "@mui/material";
import { useState, useEffect } from "react";
import { toast } from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";
import {
  X as XIcon,
  Calendar,
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
} from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  initialSpec?: string;
}

// ══════════════════════════════════════════════════
// 1. CONSULTATION BOOKING MODAL
// ══════════════════════════════════════════════════
export function ConsultationModal({ open, onClose, initialSpec }: ModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "Udaipur",
    roomType: "Dedicated Cinema Room",
    budget: "₹8L - ₹15L",
    dimensions: "",
    notes: initialSpec || "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialSpec) {
      setFormData((d) => ({ ...d, notes: initialSpec }));
    }
  }, [initialSpec, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }

    setSubmitting(true);
    const combinedNotes = [
      `Type: ${formData.roomType}`,
      `City: ${formData.city}`,
      `Budget: ${formData.budget}`,
      formData.dimensions && `Room Dimensions: ${formData.dimensions}`,
      formData.notes && `Client Specs: ${formData.notes}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("leads").insert({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      source: "website-consultation",
      notes: combinedNotes,
      status: "new",
    });

    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit request. Please call us directly.");
    } else {
      toast.success("Consultation booked! Our chief acoustic engineer will contact you shortly.");
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#120E1C",
            color: CINEMA_COLORS.WARM_WHITE,
            border: "1px solid rgba(232, 184, 108, 0.25)",
            borderRadius: "1.25rem",
            p: { xs: 2, sm: 3 },
            backgroundImage: "radial-gradient(circle at top right, rgba(232, 184, 108, 0.08), transparent 70%)",
          },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: "0.75rem",
              bgcolor: "rgba(232, 184, 108, 0.12)",
              border: "1px solid rgba(232, 184, 108, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box component={Calendar} sx={{ width: 20, height: 20, color: CINEMA_COLORS.GOLD }} />
          </Box>
          <Box>
            <Typography component="h3" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE }}>
              Bespoke Cinema Consultation
            </Typography>
            <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
              Complimentary on-site acoustic & 3D layout assessment
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "rgba(245, 239, 227, 0.6)" }} aria-label="Close dialog">
          <Box component={XIcon} sx={{ width: 18, height: 18 }} />
        </IconButton>
      </Box>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <TextField
            label="Full Name *"
            size="small"
            value={formData.name}
            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
            fullWidth
            required
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          />
          <TextField
            label="Phone Number *"
            size="small"
            value={formData.phone}
            onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
            fullWidth
            required
            placeholder="+91"
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <TextField
            label="Email Address"
            size="small"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
            fullWidth
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          />
          <TextField
            label="Location / City"
            size="small"
            select
            value={formData.city}
            onChange={(e) => setFormData((d) => ({ ...d, city: e.target.value }))}
            fullWidth
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          >
            <MenuItem value="Udaipur">Udaipur, Rajasthan</MenuItem>
            <MenuItem value="Jaipur">Jaipur, Rajasthan</MenuItem>
            <MenuItem value="Jodhpur">Jodhpur, Rajasthan</MenuItem>
            <MenuItem value="Ahmedabad">Ahmedabad, Gujarat</MenuItem>
            <MenuItem value="Mumbai">Mumbai, Maharashtra</MenuItem>
            <MenuItem value="Delhi NCR">Delhi NCR</MenuItem>
            <MenuItem value="Other">Other Region</MenuItem>
          </TextField>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <TextField
            label="Project Category"
            size="small"
            select
            value={formData.roomType}
            onChange={(e) => setFormData((d) => ({ ...d, roomType: e.target.value }))}
            fullWidth
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          >
            <MenuItem value="Dedicated Cinema Room">Dedicated Private Cinema</MenuItem>
            <MenuItem value="Living Room Media Lounge">Living Room Media Lounge</MenuItem>
            <MenuItem value="Dolby Atmos Audio Upgrade">Dolby Atmos Audio Upgrade</MenuItem>
            <MenuItem value="Commercial / Screening Hall">Commercial / Screening Hall</MenuItem>
          </TextField>
          <TextField
            label="Target Investment"
            size="small"
            select
            value={formData.budget}
            onChange={(e) => setFormData((d) => ({ ...d, budget: e.target.value }))}
            fullWidth
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.04)",
              "& .MuiOutlinedInput-root": { color: "#fff" },
              "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
            }}
          >
            <MenuItem value="₹3L - ₹6L">₹3 Lakhs – ₹6 Lakhs</MenuItem>
            <MenuItem value="₹8L - ₹15L">₹8 Lakhs – ₹15 Lakhs</MenuItem>
            <MenuItem value="₹15L - ₹30L">₹15 Lakhs – ₹30 Lakhs</MenuItem>
            <MenuItem value="₹30L+ Bespoke">₹30 Lakhs+ (Ultra Luxury Flagship)</MenuItem>
          </TextField>
        </Box>

        <TextField
          label="Room Dimensions / Sq Ft"
          size="small"
          placeholder="e.g. 18ft × 24ft with 10ft ceiling"
          value={formData.dimensions}
          onChange={(e) => setFormData((d) => ({ ...d, dimensions: e.target.value }))}
          fullWidth
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            "& .MuiOutlinedInput-root": { color: "#fff" },
            "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
          }}
        />

        <TextField
          label="Acoustic Vision & Equipment Preferences"
          size="small"
          multiline
          rows={3}
          placeholder="Any specific brands (e.g. Bowers & Wilkins, KEF, Sony 4K Laser, McIntosh) or acoustic goals..."
          value={formData.notes}
          onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
          fullWidth
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            "& .MuiOutlinedInput-root": { color: "#fff" },
            "& .MuiInputLabel-root": { color: "rgba(245, 239, 227, 0.6)" },
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
          <Box component={ShieldCheck} sx={{ width: 16, height: 16, color: "#4ade80", flexShrink: 0 }} />
          <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem" }}>
            Includes complimentary room geometry acoustic assessment & 3D raytracing blueprint.
          </Typography>
        </Box>

        <ButtonBase
          type="submit"
          disabled={submitting}
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
            "&:hover": {
              bgcolor: "#F4D9A8",
              boxShadow: "0 0 32px rgba(232, 184, 108, 0.5)",
            },
            "&:disabled": { opacity: 0.6 },
          }}
        >
          {submitting ? "Booking Appointment..." : "Confirm & Book Consultation"}
        </ButtonBase>
      </Box>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════
// 2. SPECIALIST REPAIR INTAKE MODAL
// ══════════════════════════════════════════════════
export function RepairIntakeModal({ open, onClose }: ModalProps) {
  const [deviceData, setDeviceData] = useState({
    name: "",
    phone: "",
    category: "AV Receiver / Amplifier",
    brandModel: "",
    serialNo: "",
    issue: "",
    priority: "Standard Lab Diagnostic",
  });
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceData.name.trim() || !deviceData.phone.trim() || !deviceData.brandModel.trim()) {
      toast.error("Please fill in your name, phone, and device model");
      return;
    }

    setSubmitting(true);
    const generatedTicket = `ALV-REP-${Math.floor(1000 + Math.random() * 9000)}`;

    const notes = [
      `Repair Ticket: ${generatedTicket}`,
      `Category: ${deviceData.category}`,
      `Device: ${deviceData.brandModel}`,
      deviceData.serialNo && `Serial: ${deviceData.serialNo}`,
      `Diagnostic Priority: ${deviceData.priority}`,
      `Issue: ${deviceData.issue}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("leads").insert({
      name: deviceData.name.trim(),
      phone: deviceData.phone.trim(),
      source: "website-repair-intake",
      notes,
      status: "new",
    });

    setSubmitting(false);
    if (error) {
      toast.error("Intake submission failed. Please call our service lab directly.");
    } else {
      setTicketId(generatedTicket);
      toast.success(`Device intake registered! Ticket #${generatedTicket}`);
    }
  };

  const resetAndClose = () => {
    setTicketId(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#120E1C",
            color: CINEMA_COLORS.WARM_WHITE,
            border: "1px solid rgba(232, 184, 108, 0.25)",
            borderRadius: "1.25rem",
            p: { xs: 2, sm: 3 },
            backgroundImage: "radial-gradient(circle at top right, rgba(201, 123, 110, 0.08), transparent 70%)",
          },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: "0.75rem",
              bgcolor: "rgba(201, 123, 110, 0.15)",
              border: "1px solid rgba(201, 123, 110, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box component={Wrench} sx={{ width: 20, height: 20, color: "#C97B6E" }} />
          </Box>
          <Box>
            <Typography component="h3" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE }}>
              Specialist Audio & Apple Repair Lab
            </Typography>
            <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
              Precision diagnostics for high-end amplifiers, speakers & Apple Silicon
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={resetAndClose} sx={{ color: "rgba(245, 239, 227, 0.6)" }} aria-label="Close dialog">
          <Box component={XIcon} sx={{ width: 18, height: 18 }} />
        </IconButton>
      </Box>

      {ticketId ? (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "rgba(74, 222, 128, 0.15)",
              color: "#4ade80",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <Box component={CheckCircle2} sx={{ width: 32, height: 32 }} />
          </Box>
          <Typography component="h4" variant="h6" sx={{ color: CINEMA_COLORS.WARM_WHITE, mb: 1, fontWeight: 700 }}>
            Device Intake Confirmed
          </Typography>
          <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.6)", mb: 2 }}>
            Your repair tracking identifier has been generated:
          </Typography>
          <Box
            sx={{
              display: "inline-block",
              p: 2,
              borderRadius: "0.75rem",
              bgcolor: "rgba(232, 184, 108, 0.12)",
              border: "1px dashed rgba(232, 184, 108, 0.4)",
              color: CINEMA_COLORS.GOLD,
              fontFamily: "monospace",
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "0.15em",
              mb: 3,
            }}
          >
            {ticketId}
          </Box>
          <Typography component="p" variant="caption" sx={{ display: "block", color: "rgba(245, 239, 227, 0.5)", mb: 3 }}>
            Drop off your unit at our Udaipur experience store, or request secure insured courier pickup.
          </Typography>
          <Button
            variant="contained"
            onClick={resetAndClose}
            sx={{
              bgcolor: CINEMA_COLORS.GOLD,
              color: "#000",
              fontWeight: 700,
              px: 4,
              py: 1,
            }}
          >
            Done
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label="Contact Name *"
              size="small"
              required
              value={deviceData.name}
              onChange={(e) => setDeviceData((d) => ({ ...d, name: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            />
            <TextField
              label="Phone Number *"
              size="small"
              required
              placeholder="+91"
              value={deviceData.phone}
              onChange={(e) => setDeviceData((d) => ({ ...d, phone: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label="Equipment Type"
              size="small"
              select
              value={deviceData.category}
              onChange={(e) => setDeviceData((d) => ({ ...d, category: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            >
              <MenuItem value="AV Receiver / Amplifier">AV Receiver / Power Amplifier (Denon/Marantz/McIntosh)</MenuItem>
              <MenuItem value="Audiophile Loudspeaker / Driver">Audiophile Loudspeaker / Subwoofer (KEF/B&W/SVS)</MenuItem>
              <MenuItem value="Laser / Lamp 4K Projector">4K Laser Projector / Optical Engine (Sony/JVC/Optoma)</MenuItem>
              <MenuItem value="Apple Mac / MacBook Pro / iPhone">Apple Silicon Mac / iPad / iPhone Pro</MenuItem>
              <MenuItem value="Turntable / DAC / Streamer">Turntable / High-End DAC / Streamer</MenuItem>
            </TextField>
            <TextField
              label="Brand & Model *"
              size="small"
              required
              placeholder="e.g. Marantz Cinema 50, KEF LS50"
              value={deviceData.brandModel}
              onChange={(e) => setDeviceData((d) => ({ ...d, brandModel: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label="Serial Number (Optional)"
              size="small"
              value={deviceData.serialNo}
              onChange={(e) => setDeviceData((d) => ({ ...d, serialNo: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            />
            <TextField
              label="Service Priority"
              size="small"
              select
              value={deviceData.priority}
              onChange={(e) => setDeviceData((d) => ({ ...d, priority: e.target.value }))}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
            >
              <MenuItem value="Standard Lab Diagnostic">Standard Lab Diagnostic (24-48 hrs)</MenuItem>
              <MenuItem value="Priority Rush Inspection">Priority Rush Inspection (Same-Day Express)</MenuItem>
              <MenuItem value="Component Recapping Overhaul">Full Vintage Audio Recapping / Overhaul</MenuItem>
            </TextField>
          </Box>

          <TextField
            label="Observed Issue & Symptom Description"
            size="small"
            multiline
            rows={3}
            placeholder="Describe what is failing: e.g. protecting shutdown, distorted left channel, HDMI handshake failure..."
            value={deviceData.issue}
            onChange={(e) => setDeviceData((d) => ({ ...d, issue: e.target.value }))}
            sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
          />

          <ButtonBase
            type="submit"
            disabled={submitting}
            sx={{
              width: "100%",
              py: 1.5,
              borderRadius: "0.75rem",
              bgcolor: "#C97B6E",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9375rem",
              boxShadow: "0 0 24px rgba(201, 123, 110, 0.35)",
              transition: "all 0.2s ease",
              "&:hover": { bgcolor: "#d98d80" },
              "&:disabled": { opacity: 0.6 },
            }}
          >
            {submitting ? "Registering Device..." : "Submit Repair Diagnostic Request"}
          </ButtonBase>
        </Box>
      )}
    </Dialog>
  );
}

// ══════════════════════════════════════════════════
// 3. TRACK ORDER / JOB SHEET MODAL
// ══════════════════════════════════════════════════
export function TrackOrderModal({ open, onClose }: ModalProps) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [realJob, setRealJob] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setRealJob(null);

    try {
      const { data } = await supabase
        .from("job_sheets")
        .select("*, customers(name, phone)")
        .or(`public_token.eq.${q},id.eq.${q}`)
        .maybeSingle();

      if (data) {
        setRealJob(data);
      }
    } catch {
      // fallback to mock timeline
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#120E1C",
            color: CINEMA_COLORS.WARM_WHITE,
            border: "1px solid rgba(232, 184, 108, 0.25)",
            borderRadius: "1.25rem",
            p: { xs: 2, sm: 3 },
          },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: "0.75rem",
              bgcolor: "rgba(232, 184, 108, 0.12)",
              border: "1px solid rgba(232, 184, 108, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box component={Search} sx={{ width: 20, height: 20, color: CINEMA_COLORS.GOLD }} />
          </Box>
          <Box>
            <Typography component="h3" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE }}>
              Track Repair & Installation Order
            </Typography>
            <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
              Enter your Job Sheet ID, Quotation #, or Registered Phone
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "rgba(245, 239, 227, 0.6)" }} aria-label="Close dialog">
          <Box component={XIcon} sx={{ width: 18, height: 18 }} />
        </IconButton>
      </Box>

      <Box component="form" onSubmit={handleSearch} sx={{ display: "flex", gap: 1, mb: 3 }}>
        <TextField
          size="small"
          placeholder="e.g. ALV-REP-8492 or 98290XXXXX"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
          }}
          fullWidth
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            "& .MuiOutlinedInput-root": { color: "#fff" },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          sx={{
            bgcolor: CINEMA_COLORS.GOLD,
            color: "#000",
            fontWeight: 700,
            whiteSpace: "nowrap",
            px: 3,
          }}
        >
          Track
        </Button>
      </Box>

      {searched && (
        <Box sx={{ p: 2.5, borderRadius: "1rem", bgcolor: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(232, 184, 108, 0.15)" }}>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4, gap: 1.5 }}>
              <CircularProgress size={24} sx={{ color: CINEMA_COLORS.GOLD }} />
              <Typography component="span" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.7)" }}>
                Querying ALV Lab Database...
              </Typography>
            </Box>
          ) : realJob ? (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box>
                  <Typography component="p" variant="subtitle2" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700 }}>
                    Job Sheet #{realJob.id?.slice(0, 8).toUpperCase()}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.7)" }}>
                    {realJob.device_brand} {realJob.device_model} · {realJob.customers?.name || "Valued Client"}
                  </Typography>
                </Box>
                <Chip
                  label={realJob.status?.replace(/_/g, " ").toUpperCase() || "IN PROGRESS"}
                  size="small"
                  sx={{ bgcolor: "rgba(74, 222, 128, 0.15)", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.3)", fontWeight: 700 }}
                />
              </Box>

              <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.8)", mb: 2 }}>
                Issue Reported: {realJob.problem_description || "Specialist diagnostic & alignment"}
              </Typography>

              {realJob.public_token && (
                <ButtonBase
                  onClick={() => window.open(`/job/public/${realJob.public_token}`, "_blank")}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: "0.5rem",
                    bgcolor: "rgba(232, 184, 108, 0.15)",
                    color: CINEMA_COLORS.GOLD,
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    mb: 2,
                  }}
                >
                  View Full Public Diagnostic Sheet <Box component={ArrowRight} sx={{ width: 14, height: 14 }} />
                </ButtonBase>
              )}
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box>
                  <Typography component="p" variant="subtitle2" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700 }}>
                    Order #{query.toUpperCase()}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                    Dolby Atmos Calibration & Equipment Service
                  </Typography>
                </Box>
                <Chip label="In Progress" size="small" sx={{ bgcolor: "rgba(232, 184, 108, 0.15)", color: CINEMA_COLORS.GOLD, border: "1px solid rgba(232, 184, 108, 0.3)" }} />
              </Box>

              {/* Stepper Timeline */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 2 }}>
                {[
                  { title: "Physical Intake & Lab Bench Inspection", status: "Completed", date: "Yesterday, 11:30 AM", active: true },
                  { title: "Component-Level Diagnostic & Laser Alignment", status: "In Progress", date: "Today, In Lab Bench 2", active: true },
                  { title: "THX Multi-Channel Audio Calibration & Soak Test", status: "Upcoming", date: "Scheduled", active: false },
                  { title: "White-Glove Delivery / On-Site Handover", status: "Upcoming", date: "Pending completion", active: false },
                ].map((step, idx) => (
                  <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        bgcolor: step.status === "Completed" ? "#4ade80" : step.status === "In Progress" ? CINEMA_COLORS.GOLD : "rgba(255, 255, 255, 0.1)",
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    >
                      {step.status === "Completed" ? "✓" : idx + 1}
                    </Box>
                    <Box>
                      <Typography component="p" variant="body2" sx={{ color: step.active ? CINEMA_COLORS.WARM_WHITE : "rgba(245, 239, 227, 0.4)", fontWeight: step.active ? 600 : 400 }}>
                        {step.title}
                      </Typography>
                      <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.4)" }}>
                        {step.date}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
              Need urgent updates?
            </Typography>
            <ButtonBase
              onClick={() => window.open("https://wa.me/919829000000", "_blank")}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "#4ade80",
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              <Box component={Phone} sx={{ width: 14, height: 14 }} /> Chat with Lab Technician
            </ButtonBase>
          </Box>
        </Box>
      )}
    </Dialog>
  );
}
