import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
matcher: [
  "/admin/:path*",
  "/my-active-tips/:path*",
  "/my-resulted-tips/:path*",
  "/resulted-tips/:path*",
  "/horses-to-watch/:path*",
  "/long-term-bets/:path*",
],
};
