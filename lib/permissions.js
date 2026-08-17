// Role model:
//   user          — general access to both Wayfinding and FA Signage, no Users page
//   admin_fa      — FA Signage only, no Wayfinding, no Users page
//   admin_wf      — Wayfinding only, no FA Signage, no Users page
//   admin_fa_wf   — both Wayfinding and FA Signage, no Users page
//   owner         — everything, including the Users page
//
// "admin" is a legacy value from before this role model existed (the
// original bootstrapped account). It's treated as equivalent to "owner"
// everywhere below so nobody who was already an admin gets locked out
// by this change — they can be relabeled to "Owner" explicitly later
// from the Users page, but nothing breaks in the meantime.

export const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin_fa", label: "Admin - FA" },
  { value: "admin_wf", label: "Admin - WF" },
  { value: "admin_fa_wf", label: "Admin - FA/WF" },
  { value: "owner", label: "Owner" },
];

export function roleLabel(role) {
  if (role === "admin") return "Owner (legacy)";
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role || "User";
}

export function isOwner(role) {
  return role === "owner" || role === "admin";
}

export function canAccessUsers(role) {
  return isOwner(role);
}

export function canAccessWayfinding(role) {
  return isOwner(role) || role === "admin_wf" || role === "admin_fa_wf" || role === "user";
}

export function canAccessFaSignage(role) {
  return isOwner(role) || role === "admin_fa" || role === "admin_fa_wf" || role === "user";
}
