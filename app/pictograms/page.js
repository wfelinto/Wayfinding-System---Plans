"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PictogramsPage() {
  const [pictograms, setPictograms] = useState([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("pictograms").select("*").order("name");
    if (error) {
      setError(error.message);
    } else {
      const withUrls = (data || []).map((p) => ({
        ...p,
        imageUrl: supabase.storage.from("pictograms").getPublicUrl(p.image_path).data.publicUrl,
      }));
      setPictograms(withUrls);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !file) {
      setError("Give the pictogram a name and choose an image.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("pictograms").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("pictograms").insert({ name, image_path: filePath });
      if (insertError) throw insertError;

      setName("");
      setFile(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await supabase.from("pictograms").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Pictograms</h1>
      <p className="text-ink/60 mb-6">
        Your reusable pictogram library. These show up as thumbnails in the pictogram picker next to each
        message in the editor.
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 space-y-3 h-fit">
          <h2 className="font-medium text-ink mb-1">Add a pictogram</h2>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Restroom"
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs"
            />
          </div>

          {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add pictogram"}
          </button>
        </form>

        <div className="lg:col-span-2">
          {loading && <p className="text-ink/50">Loading...</p>}
          {!loading && pictograms.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
              No pictograms yet. Add your first one from the form.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pictograms.map((p) => (
              <div key={p.id} className="bg-white border border-black/10 rounded-lg p-3 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="w-full h-16 object-contain mb-2" />
                <p className="text-sm text-ink truncate" title={p.name}>
                  {p.name}
                </p>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
