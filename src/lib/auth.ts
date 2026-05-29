import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function requireProfile(roles?: UserRole[]) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (roles && !roles.includes(profile.role)) redirect("/unauthorized");
  return profile;
}
