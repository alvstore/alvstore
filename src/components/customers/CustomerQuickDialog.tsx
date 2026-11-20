"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { FormDialog, SegmentedControl, toast } from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, User, UserPlus } from "lucide-react";

export interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gst_number: string | null;
  notes?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
}

import {
  parseCustomerMetadata,
  serializeCustomerNotes,
  type CustomerMetadata,
} from "@/lib/customer-metadata";

export {
  parseCustomerMetadata,
  serializeCustomerNotes,
  type CustomerMetadata,
};

interface CustomerQuickDialogProps {
  open: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: CustomerData) => void;
  initialName?: string;
}

export function CustomerQuickDialog({
  open,
  onClose,
  onCustomerCreated,
  initialName = "",
}: CustomerQuickDialogProps) {
  const { user } = useAuth();
  const [customerType, setCustomerType] = useState<"B2C" | "B2B">("B2C");
  const [isVIP, setIsVIP] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const trimmed = initialName.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      const isPhone = /^\+?[0-9\s-]{7,15}$/.test(trimmed);

      if (isEmail) {
        setName("");
        setEmail(trimmed);
        setPhone("");
      } else if (isPhone) {
        setName("");
        setEmail("");
        setPhone(trimmed);
      } else {
        setName(trimmed);
        setEmail("");
        setPhone("");
      }

      setCustomerType("B2C");
      setIsVIP(false);
      setGstNumber("");
      setAddress("");
      setCity("");
      setState("");
      setPincode("");
      setCreditLimit("");
      setNotes("");
      setSaving(false);
    }
  }, [open, initialName]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Customer name is required");
      return;
    }

    setSaving(true);
    const serializedNotes = serializeCustomerNotes(notes, isVIP, creditLimit);

    const payload = {
      name: trimmedName,
      phone: phone.trim() || null,
      email: email.trim() || null,
      gst_number: gstNumber.trim().toUpperCase() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: pincode.trim() || null,
      shipping_address: address.trim() || null,
      shipping_city: city.trim() || null,
      shipping_state: state.trim() || null,
      shipping_pincode: pincode.trim() || null,
      notes: serializedNotes,
      created_by: user?.id,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(payload as any)
      .select("id, name, email, phone, address, city, state, pincode, gst_number, notes, shipping_address, shipping_city, shipping_state, shipping_pincode")
      .single();

    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to create customer");
      return;
    }

    if (data) {
      toast.success(`Customer "${data.name}" created and selected`);
      onCustomerCreated(data as CustomerData);
      onClose();
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add New Customer"
      description="Create a customer account and select it immediately for this document."
      paperSx={{ maxWidth: 560, overflowY: "auto" }}
    >
      <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <SegmentedControl
            label="Customer Type"
            value={customerType}
            onChange={(val) => {
              setCustomerType(val as "B2C" | "B2B");
            }}
            options={[
              {
                value: "B2C",
                label: (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box component={User} sx={{ width: 14, height: 14 }} /> Retail (B2C)
                  </Box>
                ),
              },
              {
                value: "B2B",
                label: (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box component={Building2} sx={{ width: 14, height: 14 }} /> Business (B2B)
                  </Box>
                ),
              },
            ]}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={isVIP}
                onChange={(e) => setIsVIP(e.target.checked)}
                color="warning"
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, color: isVIP ? "warning.main" : "text.secondary" }}>
                VIP Client
              </Typography>
            }
          />
        </Box>

        <TextField
          autoFocus
          label="Customer / Business Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          placeholder={customerType === "B2B" ? "e.g. Acme Technologies Pvt Ltd" : "e.g. Rohan Verma"}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. 9876543210"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. client@example.com"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        {customerType === "B2B" && (
          <TextField
            label="GSTIN / GST Number"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            size="small"
            fullWidth
            placeholder="e.g. 08AAAAA0000A1Z5"
            helperText="15-character GST identification number"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}

        <TextField
          label="Billing Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          size="small"
          fullWidth
          placeholder="Street address, building, suite"
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
          <TextField
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. Jodhpur"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. Rajasthan"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Pincode"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. 342001"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField
            label="Credit Limit"
            select
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            size="small"
            fullWidth
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">None / Advance Payment</MenuItem>
            <MenuItem value="₹10,000">₹10,000 (Small limit)</MenuItem>
            <MenuItem value="₹25,000">₹25,000 (Standard)</MenuItem>
            <MenuItem value="₹50,000">₹50,000 (Regular B2B)</MenuItem>
            <MenuItem value="₹1,00,000">₹1,00,000 (VIP / Enterprise)</MenuItem>
            <MenuItem value="₹2,50,000">₹2,50,000 (High Volume)</MenuItem>
          </TextField>

          <TextField
            label="Internal Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            fullWidth
            placeholder="Payment terms, special instructions..."
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            startIcon={<Box component={UserPlus} sx={{ width: 16, height: 16 }} />}
          >
            {saving ? "Saving..." : "Save & Select Customer"}
          </Button>
        </Box>
      </Box>
    </FormDialog>
  );
}
