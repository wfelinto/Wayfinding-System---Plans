"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ROLE_OPTIONS, roleLabel } from "@/lib/permissions";

const emptyForm = {
  email: "",
  password: "",
  role: "user",
  fa_signage_approval: false,
  fa_signage_approval_area: "",
};

export default function UsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: profileData, error: profileError }, { data: faData }] = await Promise.all([
      supabase.from("profiles").select("*").order("email"),
      supabase.from("fa_functional_areas").select("name"),
    ]);
    if (profileError) setError(profileError.message);
    else setProfiles(profileData || []);

    const areas = Array.from(new Set((faData || []).map((f) => (f.name || "").trim()).filter(Boolean))).sort();
    setFunctionalAreas(areas);
    setLoading(false);
  }
  async function authedFetch(url, body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed.");
    return json;
  }

  function startEdit(profile) {
    setEditingId(profile.id);
    setForm({
      email: profile.email || "",
      password: "",
      role: profile.role || "user",
      fa_signage_approval: !!profile.fa_signage_approval,
      fa_signage_approval_area: profile.fa_signage_approval_area || "",
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        await authedFetch("/api/admin/update-user", {
          userId: editingId,
          role: form.role,
          fa_signage_approval: form.fa_signage_approval,
          fa_signage_approval_area: form.fa_signage_approval_area,
        });
      } else {
        await authedFetch("/api/admin/create-user", {
          email: form.email,
          password: form.password,
          role: form.role,
          fa_signage_approval: form.fa_signage_approval,
          fa_signage_approval_area: form.fa_signage_approval_area,
        });
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Users</h1>
      <p className="text-ink/60 mb-6">
        Create accounts and set who has admin access or FA Signage budget approval for a specific
        Functional Area.
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 space-y-3 h-fit">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-ink">{editingId ? "Edit user" : "Create user"}</h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-ink/50 hover:text-ink">
                Cancel
              </button>
            )}
          </div>

          {!editingId && (
            <>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
            </>
          )}

          {editingId && (
            <p className="text-sm text-ink/60 bg-black/5 rounded-md px-3 py-1.5">{form.email}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink/40 mt-1">
              Owner: everything, including this page. Admin - FA/WF: restricted to just that area. User:
              both project areas, no Users page.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={form.fa_signage_approval}
              onChange={(e) => setForm({ ...form, fa_signage_approval: e.target.checked })}
            />
            FA Signage approval
          </label>

          {form.fa_signage_approval && (
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                Functional area <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.fa_signage_approval_area}
                onChange={(e) => setForm({ ...form, fa_signage_approval_area: e.target.value })}
                className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
              >
                <option value="" disabled>
                  Select a functional area…
                </option>
                {functionalAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              {functionalAreas.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  No functional areas yet — add some on a project's Functional Areas page first.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Create user"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {loading && <p className="text-ink/50">Loading...</p>}
          {!loading && profiles.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
              No users yet.
            </div>
          )}

          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`bg-white border rounded-lg p-4 flex items-start justify-between ${
                  editingId === p.id ? "border-accent ring-1 ring-accent/30" : "border-black/10"
                }`}
              >
                <div>
                  <h3 className="font-medium text-ink">{p.email}</h3>
                  <p className="text-sm text-ink/60 mt-1">
                    {roleLabel(p.role)}
                    {p.fa_signage_approval && (
                      <> · FA Signage approver ({p.fa_signage_approval_area || "no area set"})</>
                    )}
                  </p>
                </div>
                <button onClick={() => startEdit(p)} className="text-sm text-accent hover:underline shrink-0">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
