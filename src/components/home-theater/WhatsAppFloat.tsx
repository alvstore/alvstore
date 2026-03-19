import { MessageCircle } from "lucide-react";

export default function WhatsAppFloat({ phone = "919999999999" }: { phone?: string }) {
  const message = encodeURIComponent("Hi, I want Home Theater setup");
  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-2xl shadow-green-500/30 hover:scale-110 transition-transform duration-300"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-7 w-7 text-white" />
    </a>
  );
}
