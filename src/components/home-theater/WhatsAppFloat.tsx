"use client";

import { Box } from "@mui/material";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFloat({
  phone = "919829000000",
}: {
  phone?: string;
}) {
  const message = encodeURIComponent(
    "Hi, I would like to inquire about ALV bespoke Home Cinema & Acoustic consultation."
  );

  return (
    <Box
      href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp with ALV Cinema Concierge"
      component="a"
      sx={{
        position: "fixed",
        bottom: "1.75rem",
        right: "1.75rem",
        zIndex: 50,
        height: "3.5rem",
        width: "3.5rem",
        borderRadius: "9999px",
        bgcolor: "#25D366",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 30px rgba(37, 211, 102, 0.4)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "scale(1.1)",
          boxShadow: "0 14px 40px rgba(37, 211, 102, 0.6)",
        },
      }}
    >
      <Box component={MessageCircle} sx={{ height: "1.75rem", width: "1.75rem" }} />
    </Box>
  );
}
