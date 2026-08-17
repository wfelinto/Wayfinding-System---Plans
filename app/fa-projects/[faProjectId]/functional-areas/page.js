"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const emptyForm = { name: "", acronym: "" };

export default function FunctionalAreasPage({ params }) {
  const { faProjectId } = params;
  const [project, setProject] = useState(null);
  const [areas, setAreas] = useState([]);
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
      supabase.from("fa_projects").select("*").eq("id", faProjectId).single(),
      supabase.from("fa_functional_areas").select("*").eq("fa_project_id", faProjectId).order("name"),
    ]);
    setProject(projectData);
    if (error) setError(error.message);
    else setAreas(data);
    setLoading(false);
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({ name: a.name || "", acronym: a.acronym || "" });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Functional Area name is required.");
      return;
    }
    setError(null);
    setSaving(true);

    const { error } = editingId
      ? await supabase.from("fa_functional_areas").update(form).eq("id", editingId)
      : await supabase.from("fa_functional_areas").insert({ ...form, fa_project_id: faProjectId });

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
      "Delete this Functional Area? Requests and FA info per Venue entries referencing it will keep their record but it will no longer appear in dropdowns."
    );
    if (!confirmed) return;
    if (editingId === id) cancelEdit();
    await supabase.from("fa_functional_areas").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <a href={`/fa-projects/${faProjectId}`} className="text-sm text-accent hover:underline">
        ← Back to {project?.name || "project"}
      </a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-1">Functional Areas</h1>
      <p className="text-ink/60 mb-6">
        Feeds the Functional Area dropdown on requests and on FA info per Venue.
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 space-y-3 h-fit">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-ink">{editingId ? "Edit functional area" : "Add a functional area"}</h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-ink/50 hover:text-ink">
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Functional area</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Broadcast"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Functional area acronym</label>
            <input
              value={form.acronym}
              onChange={(e) => setForm({ ...form, acronym: e.target.value })}
              placeholder="e.g. BRC"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add functional area"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {loading && <p className="text-ink/50">Loading...</p>}
          {!loading && areas.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
              No functional areas yet. Add your first one from the form.
            </div>
          )}

          <div className="space-y-3">
            {areas.map((a) => (
              <div
                key={a.id}
                className={`bg-white border rounded-lg p-4 flex items-start justify-between ${
                  editingId === a.id ? "border-accent ring-1 ring-accent/30" : "border-black/10"
                }`}
              >
                <div>
                  <h3 className="font-medium text-ink">
                    {a.name} {a.acronym && <span className="text-ink/50 font-normal">({a.acronym})</span>}
                  </h3>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => startEdit(a)} className="text-sm text-accent hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-sm text-red-600 hover:underline">
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
