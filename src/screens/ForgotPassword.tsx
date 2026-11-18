import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

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
    } else {
      setSent(true);
      toast.success("Check your email for the reset link!");
      // Dev mode (no SMTP configured): the API returns the link directly.
      const devLink = (data as { dev_reset_link?: string } | null)?.dev_reset_link;
      if (devLink) {
        toast.info("Dev mode: open the reset link printed below / in server logs", { duration: 15000 });
        console.log("[forgot-password] reset link:", devLink);
        setDevResetLink(devLink);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Reset Password</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {sent ? "Check your email" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <strong className="text-foreground">{email}</strong>
            </p>
            {devResetLink && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs break-all text-left">
                <span className="font-medium">Dev mode (no SMTP) — reset link:</span>{" "}
                <a className="text-primary underline" href={devResetLink}>{devResetLink}</a>
              </div>
            )}
            <Link to="/login">
              <Button variant="outline" className="w-full h-11">
                <ArrowLeft className="h-4 w-4 mr-2" />Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : "Send Reset Link"}
            </Button>
            <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
