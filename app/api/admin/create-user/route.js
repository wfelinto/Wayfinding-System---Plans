import { NextResponse } from "next/server";
import { getAdminClient, getCallerUser } from "../_shared";
import { isOwner } from "@/lib/permissions";

const VALID_ROLES = ["user", "admin_fa", "admin_wf", "admin_fa_wf", "owner"];

export async function POST(request) {
  let admin;
  try {
    admin = getAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const caller = await getCallerUser(request, admin);
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.id).single();
  if (!isOwner(callerProfile?.role)) {
    return NextResponse.json({ error: "Only owners can create users." }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, role, fa_signage_approval, fa_signage_approval_area } = body || {};

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (fa_signage_approval && !fa_signage_approval_area) {
    return NextResponse.json(
      { error: "A Functional Area must be selected when FA Signage Approval is enabled." },
      { status: 400 }
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    role: VALID_ROLES.includes(role) ? role : "user",
    fa_signage_approval: !!fa_signage_approval,
    fa_signage_approval_area: fa_signage_approval ? fa_signage_approval_area : null,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
