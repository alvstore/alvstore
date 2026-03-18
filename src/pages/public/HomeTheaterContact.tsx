import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Speaker, Phone, MapPin, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

export default function HomeTheaterContact() {
  const [formData, setFormData] = useState({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) { toast.error("Name and phone are required"); return; }
    setSubmitting(true);
    const notes = [
      formData.requirement && `Requirement: ${formData.requirement}`,
      formData.budget && `Budget: ${formData.budget}`,
      formData.room_size && `Room Size: ${formData.room_size}`,
      formData.city && `City: ${formData.city}`,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("leads").insert({ name: formData.name.trim(), phone: formData.phone.trim(), source: "website", notes, status: "new" });
    if (error) toast.error("Something went wrong.");
    else { toast.success("Thank you! We'll contact you soon."); setFormData({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" }); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      <nav className="sticky top-0 z-50 bg-[hsl(0,0%,4%)]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><Speaker className="h-5 w-5 text-white" /></div>
            <span className="text-xl font-bold tracking-tight">ALV Home Theater</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/about" className="hover:text-white">About</Link>
            <Link to="/solutions" className="hover:text-white">Solutions</Link>
            <Link to="/gallery" className="hover:text-white">Gallery</Link>
            <Link to="/contact" className="text-white font-medium">Contact</Link>
          </div>
        </div>
      </nav>

      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-4">Get In Touch</h1>
              <p className="text-white/50 leading-relaxed">Ready to transform your space? Contact us for a free home theater consultation.</p>
            </div>
            <div className="space-y-6">
              {[
                { icon: Phone, label: "Phone", value: "+91 XXXXX XXXXX" },
                { icon: Mail, label: "Email", value: "hello@alvstore.com" },
                { icon: MapPin, label: "Location", value: "Udaipur, Rajasthan, India" },
                { icon: Clock, label: "Hours", value: "Mon-Sat: 10AM - 7PM" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center"><item.icon className="h-5 w-5 text-white/60" /></div>
                  <div><p className="text-xs text-white/40">{item.label}</p><p className="text-sm font-medium">{item.value}</p></div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 space-y-5">
            <h2 className="text-xl font-bold mb-4">Free Consultation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/60">Name *</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">Phone *</Label>
                <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">City</Label>
                <Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="Udaipur" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">Budget</Label>
                <Select value={formData.budget} onValueChange={v => setFormData(p => ({ ...p, budget: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="2-5L">₹2L-₹5L</SelectItem><SelectItem value="5-10L">₹5L-₹10L</SelectItem><SelectItem value="10-25L">₹10L-₹25L</SelectItem><SelectItem value="25L+">₹25L+</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60">Room Size</Label>
              <Input value={formData.room_size} onChange={e => setFormData(p => ({ ...p, room_size: e.target.value }))} placeholder="e.g. 15x20 ft" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60">Requirement</Label>
              <Textarea value={formData.requirement} onChange={e => setFormData(p => ({ ...p, requirement: e.target.value }))} placeholder="Describe your requirements..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30" rows={3} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-12 font-semibold">
              {submitting ? "Submitting..." : "Get Free Consultation"} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-white/20">
          © {new Date().getFullYear()} ALV Store. Home Theater Solutions, Udaipur.
        </div>
      </footer>
    </div>
  );
}
