"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name) {
      setError("Give the project a name.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("projects").insert({ name }).select().single();
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.push(`/projects/${data.id}`);
  }

  return (
    <div className="max-w-lg">
      <a href="/" className="text-sm text-accent hover:underline">← All projects</a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-1">New project</h1>
      <p className="text-ink/60 mb-6">A project groups all the plans for one job — e.g. one airport, one campus.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AFC Jeddah"
            className="w-full border border-black/15 rounded-md px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create project"}
        </button>
      </form>
    </div>
  );
}
