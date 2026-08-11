"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const emptyForm = {
  name: "",
  max_messages: 1,
  max_chars_per_line: "",
  supports_pictogram: true,
  mounting: "wall",
  unit_cost: "",
  sign_design: "One Side Panel",
  notes: "",
};

const SIGN_DESIGN_OPTIONS = ["One Side Panel", "Two-Sided Structure", "4-Sided Structure"];

export default function ProjectKopPage({ params }) {
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [signTypes, setSignTypes] = useState([]);
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
    const [{ data: projectData }, { data, error }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      // Project-scoped entries, plus any legacy entries created before
      // the KOP became per-project (those have no project_id and stay
      // visible everywhere).
      supabase
        .from("sign_types")
        .select("*")
        .or(`project_id.eq.${projectId},project_id.is.null`)
        .order("max_messages", { ascending: true }),
    ]);
    setProject(projectData);
    if (error) setError(error.message);
    else setSignTypes(data);
    setLoading(false);
  }

  function startEdit(st) {
    setEditingId(st.id);
    setForm({
      name: st.name || "",
      max_messages: st.max_messages ?? 1,
      max_chars_per_line: st.max_chars_per_line ?? "",
      supports_pictogram: st.supports_pictogram ?? true,
      mounting: st.mounting || "wall",
      unit_cost: st.unit_cost ?? "",
      sign_design: st.sign_design || "One Side Panel",
      notes: st.notes || "",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    const payload = {
      name: form.name,
      max_messages: Number(form.max_messages),
      max_chars_per_line: form.max_chars_per_line ? Number(form.max_chars_per_line) : null,
      supports_pictogram: form.supports_pictogram,
      mounting: form.mounting,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      sign_design: form.sign_design,
      notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from("sign_types").update(payload).eq("id", editingId)
      : await supabase.from("sign_types").insert({ ...payload, project_id: projectId });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Delete this sign type? Any signs currently using it will keep their choice but it will no longer appear in dropdowns."
    );
    if (!confirmed) return;
    if (editingId === id) cancelEdit();
    await supabase.from("sign_types").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <a href={`/projects/${projectId}`} className="text-sm text-accent hover:underline">
        ← Back to {project?.name || "project"}
      </a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-1">Sign types (KOP)</h1>
      <p className="text-ink/60 mb-6">
        This project's reusable kit of parts. The crosscheck engine uses this list to decide which sign
        type fits each decision point.
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 space-y-3 h-fit">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-ink">{editingId ? "Edit sign type" : "Add a sign type"}</h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-ink/50 hover:text-ink">
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Overhead directional - large"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Max messages</label>
              <input
                type="number"
                min="1"
                value={form.max_messages}
                onChange={(e) => setForm({ ...form, max_messages: e.target.value })}
                className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Max chars/line</label>
              <input
                type="number"
                min="1"
                value={form.max_chars_per_line}
                onChange={(e) => setForm({ ...form, max_chars_per_line: e.target.value })}
                placeholder="optional"
                className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Mounting</label>
            <select
              value={form.mounting}
              onChange={(e) => setForm({ ...form, mounting: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="wall">Wall</option>
              <option value="ceiling">Ceiling</option>
              <option value="freestanding">Freestanding</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Sign design</label>
            <select
              value={form.sign_design}
              onChange={(e) => setForm({ ...form, sign_design: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              {SIGN_DESIGN_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink/40 mt-1">Determines the marker shape shown on the plan.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Unit cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              placeholder="optional"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={form.supports_pictogram}
              onChange={(e) => setForm({ ...form, supports_pictogram: e.target.checked })}
            />
            Supports pictograms
          </label>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add to KOP"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {loading && <p className="text-ink/50">Loading...</p>}
          {!loading && signTypes.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
              No sign types yet. Add your first one from the form.
            </div>
          )}

          <div className="space-y-3">
            {signTypes.map((st) => (
              <div
                key={st.id}
                className={`bg-white border rounded-lg p-4 flex items-start justify-between ${
                  editingId === st.id ? "border-accent ring-1 ring-accent/30" : "border-black/10"
                }`}
              >
                <div>
                  <h3 className="font-medium text-ink">{st.name}</h3>
                  <p className="text-sm text-ink/60 mt-1">
                    Up to {st.max_messages} message{st.max_messages === 1 ? "" : "s"}
                    {st.max_chars_per_line ? `, ${st.max_chars_per_line} chars/line` : ""}
                    {" · "}
                    {st.mounting}
                    {st.sign_design ? ` · ${st.sign_design}` : ""}
                    {st.supports_pictogram ? "" : " · no pictograms"}
                    {st.unit_cost != null ? ` · $${Number(st.unit_cost).toFixed(2)}` : ""}
                  </p>
                  {st.notes && <p className="text-sm text-ink/50 mt-1">{st.notes}</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => startEdit(st)}
                    className="text-sm text-accent hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(st.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
