"use client";

import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, toast } from "@/components/mui";
import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Speaker, Phone, MapPin, Mail, Clock } from "lucide-react";
export default function HomeTheaterContact() {
    const [formData, setFormData] = useState({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.phone.trim()) {
            toast.error("Name and phone are required");
            return;
        }
        setSubmitting(true);
        const notes = [
            formData.requirement && `Requirement: ${formData.requirement}`,
            formData.budget && `Budget: ${formData.budget}`,
            formData.room_size && `Room Size: ${formData.room_size}`,
            formData.city && `City: ${formData.city}`,
        ].filter(Boolean).join("\n");
        const { error } = await supabase.from("leads").insert({ name: formData.name.trim(), phone: formData.phone.trim(), source: "website", notes, status: "new" });
        if (error)
            toast.error("Something went wrong.");
        else {
            toast.success("Thank you! We'll contact you soon.");
            setFormData({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
        }
        setSubmitting(false);
    };
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(0 0% 4% / 1)", color: "rgb(255 255 255 / 1)" }}>
      <Box component="nav" sx={{ position: "sticky", top: "0px", zIndex: "50", backgroundColor: "hsl(0 0% 4% / 0.8)", "--alv-backdrop-blur": "blur(40px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderBottomWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1rem", paddingBottom: "1rem" }}>
          <Link to="/" sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "1rem", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "#3b82f6 var(--alv-gradient-from-position)", "--alv-gradient-to": "#9333ea var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={Speaker} sx={{ height: "1.25rem", width: "1.25rem", color: "rgb(255 255 255 / 1)" }}/></Box>
            <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", letterSpacing: "-0.025em" }}>ALV Home Theater</Box>
          </Link>
          <Box sx={{ display: "none", "@media (min-width: 768px)": { display: "flex" }, alignItems: "center", gap: "1.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(255 255 255 / 0.6)" }}>
            <Link to="/" sx={{ "&:hover": { color: "rgb(255 255 255 / 1)" } }}>Home</Link>
            <Link to="/#services" sx={{ "&:hover": { color: "rgb(255 255 255 / 1)" } }}>Services</Link>
            <Link to="/#configurator" sx={{ "&:hover": { color: "rgb(255 255 255 / 1)" } }}>Configurator</Link>
            <Link to="/#projects" sx={{ "&:hover": { color: "rgb(255 255 255 / 1)" } }}>Projects</Link>
            <Link to="/contact" sx={{ color: "rgb(255 255 255 / 1)", fontWeight: "500" }}>Contact</Link>
          </Box>
        </Box>
      </Box>

      <Box component="section" sx={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        <Box sx={{ maxWidth: "64rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "4rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "2rem" } }}>
            <PageHeader title={"Get In Touch"} subtitle={"Ready to transform your space? Contact us for a free home theater consultation."}/>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {[
            { icon: Phone, label: "Phone", value: "+91 XXXXX XXXXX" },
            { icon: Mail, label: "Email", value: "hello@alvstore.com" },
            { icon: MapPin, label: "Location", value: "Udaipur, Rajasthan, India" },
            { icon: Clock, label: "Hours", value: "Mon-Sat: 10AM - 7PM" },
        ].map(item => (<Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", backgroundColor: "rgb(255 255 255 / 0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={item.icon} sx={{ height: "1.25rem", width: "1.25rem", color: "rgb(255 255 255 / 0.6)" }}/></Box>
                  <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.4)" }}>{item.label}</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{item.value}</Typography></Box>
                </Box>))}
            </Box>
          </Box>

          <Box onSubmit={handleSubmit} component="form" sx={{ borderRadius: "1.5rem", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.1)", backgroundColor: "rgb(255 255 255 / 0.03)", padding: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
            <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", marginBottom: "1rem" }}>Free Consultation</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your name" required label={"Name *"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.3)" } }}/>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" required label={"Phone *"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.3)" } }}/>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="Udaipur" label={"City"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.3)" } }}/>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={formData.budget} label={"Budget"} select size="small" fullWidth onChange={event => (v => setFormData(p => ({ ...p, budget: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)" }}><MenuItem value="" disabled>{"Select"}</MenuItem><MenuItem value="2-5L">₹2L-₹5L</MenuItem><MenuItem value="5-10L">₹5L-₹10L</MenuItem><MenuItem value="10-25L">₹10L-₹25L</MenuItem><MenuItem value="25L+">₹25L+</MenuItem></TextField>
              </Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={formData.room_size} onChange={e => setFormData(p => ({ ...p, room_size: e.target.value }))} placeholder="e.g. 15x20 ft" label={"Room Size"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.3)" } }}/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={formData.requirement} onChange={e => setFormData(p => ({ ...p, requirement: e.target.value }))} placeholder="Describe your requirements..." rows={3} label={"Requirement"} size="small" fullWidth multiline sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.3)" } }}/>
            </Box>
            <Button type="submit" disabled={submitting} variant="contained" sx={{ width: "100%", backgroundColor: "rgb(255 255 255 / 1)", color: "rgb(0 0 0 / 1)", "&:hover": { backgroundColor: "rgb(255 255 255 / 0.9)" }, borderRadius: "0.75rem", height: "3rem", fontWeight: "600" }}>
              {submitting ? "Submitting..." : "Get Free Consultation"} <Box component={ArrowRight} sx={{ height: "1rem", width: "1rem", marginLeft: "0.5rem" }}/>
            </Button>
          </Box>
        </Box>
      </Box>

      <Box component="footer" sx={{ borderTopWidth: "1px", borderColor: "rgb(255 255 255 / 0.05)", paddingTop: "2rem", paddingBottom: "2rem" }}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", textAlign: "center", fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(255 255 255 / 0.2)" }}>
          © {new Date().getFullYear()} ALV Store. Home Theater Solutions, Udaipur.
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
