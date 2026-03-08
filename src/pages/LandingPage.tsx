import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Wrench, FileText, ShoppingCart, Package, Users, BarChart3,
  ArrowRight, Shield, Zap, Clock, CheckCircle,
} from "lucide-react";

const FEATURES = [
  { icon: Wrench, title: "Repair Management", desc: "End-to-end job sheets with technician assignment, checklists, warranty tracking, and customer approvals." },
  { icon: FileText, title: "Invoicing & Quotations", desc: "Professional GST-compliant invoices and quotations with Razorpay payment links and PDF export." },
  { icon: ShoppingCart, title: "Point of Sale", desc: "Fast POS billing with barcode scanning, customer lookup, and automatic stock deduction." },
  { icon: Package, title: "Inventory Control", desc: "Real-time stock tracking, low-stock alerts, barcode generation, and purchase/sales movement logs." },
  { icon: Users, title: "CRM & Leads", desc: "Customer database, lead pipeline, follow-ups, and communication history across WhatsApp, SMS, and email." },
  { icon: BarChart3, title: "Finance & Reports", desc: "Multi-account bookkeeping, daily cash control, expense tracking, and comprehensive business analytics." },
];

const BENEFITS = [
  { icon: Shield, text: "Enterprise-grade security with role-based access" },
  { icon: Zap, text: "Lightning-fast interface — no page reloads" },
  { icon: Clock, text: "Biometric attendance with Hikvision integration" },
  { icon: CheckCircle, text: "GST-ready for Indian businesses" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Donezo</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/signup")}>
              Get Started <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5" />
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Zap className="h-3.5 w-3.5" /> All-in-one Business Management
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Run your repair business
              <span className="block text-primary"> like a pro.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              From job sheets to invoicing, POS to inventory — Donezo brings every operation under one roof. Built for Indian repair & service businesses.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="lg" onClick={() => navigate("/signup")} className="px-8">
                Start Free <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight">Everything you need</h2>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">Powerful modules that work together seamlessly to manage your entire business.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-border/50 bg-card hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Strip */}
      <section className="py-16 bg-muted/30 border-y border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map(b => (
              <div key={b.text} className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <b.icon className="h-4.5 w-4.5 text-success" />
                </div>
                <p className="text-sm font-medium leading-snug">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Ready to streamline your operations?</h2>
            <p className="text-muted-foreground">Join businesses that trust Donezo for their daily operations. Set up in under 5 minutes.</p>
            <Button size="lg" onClick={() => navigate("/signup")} className="px-10">
              Get Started — It's Free <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Donezo</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Donezo. Built for Indian businesses.</p>
        </div>
      </footer>
    </div>
  );
}
