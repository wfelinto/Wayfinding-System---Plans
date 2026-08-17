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
    return NextResponse.json({ error: "Only owners can edit users." }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role, fa_signage_approval, fa_signage_approval_area } = body || {};

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (fa_signage_approval && !fa_signage_approval_area) {
    return NextResponse.json(
      { error: "A Functional Area must be selected when FA Signage Approval is enabled." },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({
      role: VALID_ROLES.includes(role) ? role : "user",
      fa_signage_approval: !!fa_signage_approval,
      fa_signage_approval_area: fa_signage_approval ? fa_signage_approval_area : null,
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
