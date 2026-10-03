import { type NextRequest } from "next/server";
import { completeEmailAuth } from "@/lib/auth/callback";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return completeEmailAuth(request);
}
