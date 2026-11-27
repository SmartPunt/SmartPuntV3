import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import MeetingPreview from "./meeting-preview";

export default async function Page() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!["admin", "staff_admin"].includes(profile.role)) redirect("/");
  return <MeetingPreview />;
}
