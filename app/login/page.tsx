import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import LoginPage from "@/components/login-page";

export default async function LoginRoute() {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect("/");
  }

  return <LoginPage />;
}
