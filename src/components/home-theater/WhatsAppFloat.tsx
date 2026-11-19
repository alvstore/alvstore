"use client";

import { Box } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { MessageCircle } from "lucide-react";
export default function WhatsAppFloat({ phone = "919999999999" }: {
    phone?: string;
}) {
    const message = encodeURIComponent("Hi, I want Home Theater setup");
    return (<Box href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${message}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: "50", height: "3.5rem", width: "3.5rem", borderRadius: "9999px", backgroundColor: "rgb(37 211 102 / 1)", display: "flex", alignItems: "center", justifyContent: "center", "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "rgb(34 197 94 / 0.3)", "&:hover": { "--alv-scale-x": "1.1", "--alv-scale-y": "1.1", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" }, transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" })}>
      <Box component={MessageCircle} sx={{ height: "1.75rem", width: "1.75rem", color: "rgb(255 255 255 / 1)" }}/>
    </Box>);
}
