import { safeNext } from "@/lib/mis/paths";
import { createClient } from "@/lib/supabase/server";
import { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const client = await createClient();
  let error;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  if (token_hash && type) {
    ({ error } = await client.auth.verifyOtp({ token_hash, type }));
  } else if (code) {
    ({ error } = await client.auth.exchangeCodeForSession(code));
  } else error = new Error("Missing confirmation code.");
  if (error) return NextResponse.redirect(new URL("/auth/error", url.origin));
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user?.user_metadata.requested_role === "Owner") {
    const { data: profile } = await client
      .from("user_account")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile?.role === "Customer")
      await client.rpc("mis_command", {
        action: "complete_registration",
        a: {
          role: "Owner",
          full_name: user.user_metadata.full_name || "Store Owner",
        },
      });
  }
  const next = url.searchParams.get("next");
  return NextResponse.redirect(new URL(safeNext(next), url.origin));
}
