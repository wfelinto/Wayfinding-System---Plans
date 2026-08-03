"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewPlanPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [floorLabel, setFloorLabel] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !name) {
      setError("Give the plan a name and choose a file.");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("plans")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from("plans")
        .insert({ name, floor_label: floorLabel || null, file_path: filePath })
        .select()
        .single();
      if (insertError) throw insertError;

      router.push(`/editor/${inserted.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-ink mb-1">Upload a plan</h1>
      <p className="text-ink/60 mb-6">
        Accepts an image export of your floor plan (PNG or JPG work best for the drawing tool).
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Plan name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Terminal 2 - Level 1"
            className="w-full border border-black/15 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Floor / area label (optional)</label>
          <input
            type="text"
            value={floorLabel}
            onChange={(e) => setFloorLabel(e.target.value)}
            placeholder="e.g. Level 1"
            className="w-full border border-black/15 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Plan file</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload and open editor"}
        </button>
      </form>
    </div>
  );
}
