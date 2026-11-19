"use client";

import { useEffect } from "react";
import { CircularProgress, Box } from "@mui/material";
import { AnimatedPage } from "@/components/mui";
import { useNavigate } from "@/lib/router-compat";

export default function Customers() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/crm", { replace: true }); }, [navigate]);
  return <AnimatedPage><Box role="status" aria-label="Opening customers" sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress size={28} /></Box></AnimatedPage>;
}
