import { createAdminClient } from "@/lib/supabase/admin";

type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  linkUrl?: string;
};

export async function createNotification(input: NotificationInput) {
  const supabase = createAdminClient();
  await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    message: input.message,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    link_url: input.linkUrl ?? null,
  });
}

export async function notifyAdmins(input: Omit<NotificationInput, "userId">) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("id").eq("role", "ADMIN").eq("is_active", true);
  if (!data?.length) return;
  await supabase.from("notifications").insert(data.map((admin) => ({
    user_id: admin.id,
    title: input.title,
    message: input.message,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    link_url: input.linkUrl ?? null,
  })));
}
