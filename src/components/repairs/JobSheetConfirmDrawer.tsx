"use client";

import { Box, Button, Card, CardContent, Divider, Typography } from "@mui/material";
import { SideDrawer, StatusChip, mergeSx } from "@/components/mui";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut, motionTokens } from "@/lib/motion-presets";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  IndianRupee,
  PowerOff,
  ShieldCheck,
  Smartphone,
  User,
} from "lucide-react";
import {
  type ChecklistItem,
  resolveColorSwatchHex,
  summarizeChecklist,
} from "@/lib/repair-catalog";

export interface ConfirmServiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  gst_percentage: number;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
}

export interface JobSheetConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  isEditMode: boolean;
  customer: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    gst_number?: string | null;
  } | null;
  device: {
    brand: string;
    deviceType: string;
    model: string;
    color: string;
    colorHex?: string | null;
    storage: string;
    serial: string;
    imei: string;
    problemDescription: string;
    issueCategoryName?: string | null;
    priority: string;
    estimatedCompletion?: string;
    estimatedCost?: string;
    staffNotes: string;
    photoCount: number;
  };
  checklist: ChecklistItem[];
  serviceItems: ConfirmServiceItem[];
  gstMode: "none" | "inclusive" | "exclusive";
  grandTotal: number;
  effectiveGst: number;
}

function calcLine(item: ConfirmServiceItem, gstMode: "none" | "inclusive" | "exclusive") {
  const base = item.price * item.quantity;
  let disc = 0;
  if (item.discount_type === "percentage") disc = (base * item.discount_value) / 100;
  else if (item.discount_type === "fixed") disc = item.discount_value;
  const taxable = base - disc;
  const gstAmt = (taxable * item.gst_percentage) / 100;
  return gstMode === "none" ? taxable : gstMode === "inclusive" ? taxable : taxable + gstAmt;
}

/**
 * Animated SideDrawer confirmation & intake audit gate shown before persisting a Job Sheet.
 */
export function JobSheetConfirmDrawer({
  open,
  onClose,
  onConfirm,
  saving,
  isEditMode,
  customer,
  device,
  checklist,
  serviceItems,
  gstMode,
  grandTotal,
  effectiveGst,
}: JobSheetConfirmDrawerProps) {
  const reduced = useReducedMotion();
  const summary = summarizeChecklist(checklist);
  const resolvedHex = device.colorHex ?? resolveColorSwatchHex(device.color);
  const flaggedItems = [...summary.physicalFlags, ...summary.functionalFlags];
  const cardMotion = (step: number) =>
    reduced
      ? {}
      : {
          component: motion.div,
          initial: { y: 8 },
          animate: { y: 0 },
          transition: { duration: motionTokens.base, delay: step * 0.035, ease: easeOut },
        };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      maxWidth="sm"
      busy={saving}
      title={isEditMode ? "Confirm Job Sheet Update" : "Confirm & Save Job Sheet"}
      description="Verify customer, hardware identity, power-state audit, and repair estimate before saving."
      badge={
        <StatusChip
          label={device.priority}
          sx={{ textTransform: "capitalize", fontWeight: 600 }}
        />
      }
      footer={
        <Box sx={{ display: "flex", gap: 1.5, width: "100%" }}>
          <Button
            type="button"
            variant="outlined"
            onClick={onClose}
            disabled={saving}
            sx={{ flex: 1, minHeight: 44 }}
          >
            Back to Edit
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={onConfirm}
            disabled={saving}
            sx={{ flex: 1.5, minHeight: 44, fontWeight: 600 }}
          >
            <Box component={ShieldCheck} sx={{ width: 16, height: 16, mr: 0.75 }} />
            {saving
              ? "Saving..."
              : isEditMode
                ? "Confirm & Update Job Sheet"
                : "Confirm & Create Job Sheet"}
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
        {/* Customer */}
        <Box {...cardMotion(0)}>
          <Card variant="outlined" sx={{ borderRadius: "var(--radius)" }}>
            <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 650 }}>
                  <Box component={User} sx={{ width: 15, height: 15, color: "hsl(var(--primary))" }} />
                  Customer
                </Typography>
                {customer?.gst_number && (
                  <StatusChip label={`GST: ${customer.gst_number}`} sx={{ fontSize: 11 }} />
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{customer?.name || "—"}</Typography>
              <Typography variant="caption" sx={{ color: "hsl(var(--muted-foreground))", display: "block" }}>
                {[customer?.phone, customer?.email].filter(Boolean).join(" · ") || "No contact info"}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Device & Finish */}
        <Box {...cardMotion(1)}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: "var(--radius)",
              borderColor: "color-mix(in srgb, hsl(var(--primary)) 26%, transparent)",
              backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 3%, transparent)",
            }}
          >
            <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 650 }}>
                  <Box component={Smartphone} sx={{ width: 15, height: 15, color: "hsl(var(--primary))" }} />
                  Device Details
                </Typography>
                {device.photoCount > 0 && (
                  <StatusChip
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box component={Camera} sx={{ width: 12, height: 12 }} />
                        {device.photoCount} photo{device.photoCount === 1 ? "" : "s"}
                      </Box>
                    }
                  />
                )}
              </Box>

              <Typography variant="body1" sx={{ fontWeight: 650 }}>
                {[device.brand, device.model || device.deviceType].filter(Boolean).join(" ")}
              </Typography>
              <Typography variant="caption" sx={{ color: "hsl(var(--muted-foreground))", display: "block", mb: 1 }}>
                Type: {device.deviceType}
                {device.issueCategoryName ? ` · Issue: ${device.issueCategoryName}` : ""}
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
                {device.color && (
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1,
                      py: 0.35,
                      borderRadius: "9999px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--background))",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {resolvedHex && (
                      <Box
                        sx={{
                          width: 11,
                          height: 11,
                          borderRadius: "9999px",
                          backgroundColor: resolvedHex,
                          border: "1px solid rgba(15, 23, 42, 0.22)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {device.color}
                  </Box>
                )}
                {device.storage && (
                  <StatusChip label={device.storage} sx={{ fontSize: 12 }} />
                )}
                {device.serial && (
                  <StatusChip label={`S/N: ${device.serial}`} sx={{ fontSize: 11, fontFamily: "monospace" }} />
                )}
                {device.imei && (
                  <StatusChip label={`IMEI: ${device.imei}`} sx={{ fontSize: 11, fontFamily: "monospace" }} />
                )}
              </Box>

              <Typography variant="body2" sx={{ color: "hsl(var(--foreground))", fontSize: 13 }}>
                <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Reported Issue: </Box>
                {device.problemDescription}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Checklist & Power-OFF Audit */}
        <Box {...cardMotion(2)}>
          <Card variant="outlined" sx={{ borderRadius: "var(--radius)" }}>
            <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 }, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 650 }}>
                <Box component={ClipboardCheck} sx={{ width: 15, height: 15, color: "hsl(var(--primary))" }} />
                Intake Checklist Audit
              </Typography>

              {summary.isOff && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    p: 1.25,
                    borderRadius: "var(--radius)",
                    backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, hsl(var(--warning)) 35%, transparent)",
                  }}
                >
                  <Box component={PowerOff} sx={{ width: 16, height: 16, color: "hsl(var(--warning))", mt: 0.15, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: "hsl(var(--foreground))", lineHeight: 1.45 }}>
                    <Box component="span" sx={{ fontWeight: 650 }}>Device Powered OFF at Intake: </Box>
                    {summary.autoSkippedCount} power-dependent checks were safely set to N/A while physical condition and accessories remain recorded.
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                <StatusChip
                  label={`Pass / Verified: ${summary.passedCount}`}
                  sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)", color: "hsl(var(--success))", fontWeight: 600 }}
                />
                <StatusChip
                  label={`Fault / Damage: ${summary.faultyCount}`}
                  sx={mergeSx(
                    { fontWeight: 600 },
                    summary.faultyCount > 0
                      ? { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)", color: "hsl(var(--destructive))" }
                      : {},
                  )}
                />
                <StatusChip label={`N/A: ${summary.naCount}`} />
              </Box>

              {flaggedItems.length > 0 && (
                <Box sx={{ pt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "hsl(var(--destructive))", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                    <Box component={AlertTriangle} sx={{ width: 13, height: 13 }} />
                    Flagged During Intake ({flaggedItems.length})
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                    {flaggedItems.slice(0, 6).map((flag, i) => (
                      <Typography key={i} variant="caption" sx={{ color: "hsl(var(--muted-foreground))" }}>
                        • {flag.item} <Box component="span" sx={{ opacity: 0.75 }}>({flag.category})</Box>
                      </Typography>
                    ))}
                    {flaggedItems.length > 6 && (
                      <Typography variant="caption" sx={{ color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>
                        +{flaggedItems.length - 6} more noted in checklist
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              {flaggedItems.length === 0 && !summary.isOff && (
                <Typography variant="caption" sx={{ color: "hsl(var(--success))", display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box component={CheckCircle2} sx={{ width: 13, height: 13 }} />
                  All checked systems passed intake verification
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Estimate & Staff Notes */}
        <Box {...cardMotion(3)}>
          <Card variant="outlined" sx={{ borderRadius: "var(--radius)" }}>
            <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 }, display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 650 }}>
                <Box component={IndianRupee} sx={{ width: 15, height: 15, color: "hsl(var(--primary))" }} />
                Estimate & Schedule
              </Typography>
              {serviceItems.filter(i => i.name.trim()).map(item => (
                <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <Typography variant="body2" sx={{ color: "hsl(var(--muted-foreground))" }}>
                    {item.name} × {item.quantity}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                    ₹{calcLine(item, gstMode).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              ))}
              {gstMode !== "none" && effectiveGst > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  <Typography variant="caption">GST ({gstMode})</Typography>
                  <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    ₹{effectiveGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 0.25 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Grand Total</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "hsl(var(--primary))", fontVariantNumeric: "tabular-nums" }}>
                  ₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              {(device.estimatedCompletion || device.estimatedCost) && (
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pt: 0.25 }}>
                  {device.estimatedCompletion && (
                    <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "hsl(var(--muted-foreground))" }}>
                      <Box component={Calendar} sx={{ width: 12, height: 12 }} />
                      Target: {device.estimatedCompletion}
                    </Typography>
                  )}
                  {device.estimatedCost && (
                    <Typography variant="caption" sx={{ color: "hsl(var(--muted-foreground))" }}>
                      Est. Cost: ₹{Number(device.estimatedCost).toLocaleString("en-IN")}
                    </Typography>
                  )}
                </Box>
              )}
              <Box sx={{ pt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                  Staff Intake Notes:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", color: "hsl(var(--foreground))" }}>
                  {device.staffNotes}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </SideDrawer>
  );
}
