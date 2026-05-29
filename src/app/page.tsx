import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  redirect("/dashboard");
}
