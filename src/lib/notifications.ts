import { supabase } from "@/integrations/supabase/client";

// Legacy notification (old table)
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string = "info",
  link?: string
) {
  // Write to both old and new tables for compatibility
  await Promise.all([
    supabase.from("notifications").insert({ user_id: userId, title, message, type, link }),
    supabase.from("notification_feed").insert({
      user_id: userId,
      type,
      title,
      body: message,
      metadata: link ? { link } : {},
    }),
  ]);
}

// Enhanced notification (new table only)
export async function createFeedNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, any>
) {
  const { error } = await supabase.from("notification_feed").insert({
    user_id: userId,
    type,
    title,
    body: body || null,
    metadata: metadata || {},
  });
  if (error) console.error("Failed to create notification:", error.message);
}

// Notify all admins
export async function notifyAdmins(
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, any>
) {
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    const notifications = admins.map((a: any) => ({
      user_id: a.user_id,
      type,
      title,
      body: body || null,
      metadata: metadata || {},
    }));
    await supabase.from("notification_feed").insert(notifications);
  }
}
