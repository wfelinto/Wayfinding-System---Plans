import { NextResponse } from "next/server";
import { getAdminClient, getCallerUser } from "../_shared";

/**
 * Called automatically on every login (see AuthGuard). Ensures the
 * signed-in user has a profiles row, without requiring anyone to set
 * this up manually — the very first person to ever hit this becomes
 * admin (since profiles is empty), and everyone after that defaults to
 * a plain "user" until an admin promotes them from the Users page.
 */
export async function POST(request) {
  let admin;
  try {
    admin = getAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const user = await getCallerUser(request, admin);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: existing } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ profile: existing });
  }

  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  const isFirstEver = (count || 0) === 0;

  const { data: created, error } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      role: isFirstEver ? "admin" : "user",
      fa_signage_approval: false,
      fa_signage_approval_area: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: created });
}
