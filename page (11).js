"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const emptyForm = {
  name: "",
  acronym: "",
  city: "",
  address: "",
  delivery_point: "",
  focal_point: "",
  focal_point_email: "",
  focal_point_phone: "",
};

export default function FaVenuesPage({ params }) {
  const { faProjectId } = params;
  const [project, setProject] = useState(null);
  const [venues, setVenues] = useState([]);
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
      supabase.from("fa_venues").select("*").eq("fa_project_id", faProjectId).order("name"),
    ]);
    setProject(projectData);
    if (error) setError(error.message);
    else setVenues(data);
    setLoading(false);
  }

  function startEdit(v) {
    setEditingId(v.id);
    setForm({
      name: v.name || "",
      acronym: v.acronym || "",
      city: v.city || "",
      address: v.address || "",
      delivery_point: v.delivery_point || "",
      focal_point: v.focal_point || "",
      focal_point_email: v.focal_point_email || "",
      focal_point_phone: v.focal_point_phone || "",
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
    if (!form.name || !form.acronym) {
      setError("Venue name and acronym are required.");
      return;
    }
    setError(null);
    setSaving(true);

    const { error } = editingId
      ? await supabase.from("fa_venues").update(form).eq("id", editingId)
      : await supabase.from("fa_venues").insert({ ...form, fa_project_id: faProjectId });

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
      "Delete this venue? Any requests referencing it will keep their record but it will no longer appear in the dropdown."
    );
    if (!confirmed) return;
    if (editingId === id) cancelEdit();
    await supabase.from("fa_venues").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <a href={`/fa-projects/${faProjectId}`} className="text-sm text-accent hover:underline">
        ← Back to {project?.name || "project"}
      </a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-1">Venues</h1>
      <p className="text-ink/60 mb-6">
        Feeds the Venue dropdown on sign requests (shown by acronym).
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 space-y-3 h-fit">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-ink">{editingId ? "Edit venue" : "Add a venue"}</h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-ink/50 hover:text-ink">
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Venue name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Estadio Azteca"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Venue official acronym</label>
            <input
              value={form.acronym}
              onChange={(e) => setForm({ ...form, acronym: e.target.value })}
              placeholder="e.g. AZT"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">City</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Delivery point</label>
            <input
              value={form.delivery_point}
              onChange={(e) => setForm({ ...form, delivery_point: e.target.value })}
              placeholder="add here the address of the delivery point in the venue"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm placeholder:text-ink/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Focal point</label>
            <input
              value={form.focal_point}
              onChange={(e) => setForm({ ...form, focal_point: e.target.value })}
              placeholder="add here the name of the person who will receive the delivery"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm placeholder:text-ink/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Focal point e-mail</label>
            <input
              type="email"
              value={form.focal_point_email}
              onChange={(e) => setForm({ ...form, focal_point_email: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Focal point phone number</label>
            <input
              value={form.focal_point_phone}
              onChange={(e) => setForm({ ...form, focal_point_phone: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add venue"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {loading && <p className="text-ink/50">Loading...</p>}
          {!loading && venues.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
              No venues yet. Add your first one from the form.
            </div>
          )}

          <div className="space-y-3">
            {venues.map((v) => (
              <div
                key={v.id}
                className={`bg-white border rounded-lg p-4 flex items-start justify-between ${
                  editingId === v.id ? "border-accent ring-1 ring-accent/30" : "border-black/10"
                }`}
              >
                <div>
                  <h3 className="font-medium text-ink">
                    {v.name} <span className="text-ink/50 font-normal">({v.acronym})</span>
                  </h3>
                  <p className="text-sm text-ink/60 mt-1">
                    {[v.city, v.address].filter(Boolean).join(" · ")}
                  </p>
                  {(v.focal_point || v.focal_point_email || v.focal_point_phone) && (
                    <p className="text-sm text-ink/50 mt-1">
                      {[v.focal_point, v.focal_point_email, v.focal_point_phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {v.delivery_point && <p className="text-sm text-ink/50 mt-1">Delivery: {v.delivery_point}</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => startEdit(v)} className="text-sm text-accent hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="text-sm text-red-600 hover:underline">
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
