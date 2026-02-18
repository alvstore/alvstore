import { supabase } from "@/integrations/supabase/client";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string = "info",
  link?: string
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    link,
  });
  if (error) console.error("Failed to create notification:", error.message);
}
