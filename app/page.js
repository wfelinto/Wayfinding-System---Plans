"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setProjects(data);
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Projects</h1>
          <p className="text-ink/60 mt-1">Each project can hold several plans — floors, buildings, or phases.</p>
        </div>
        <a
          href="/projects/new"
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          New project
        </a>
      </div>

      {loading && <p className="text-ink/50">Loading projects...</p>}
      {error && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No projects yet. Create one to get started.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <a
            key={project.id}
            href={`/projects/${project.id}`}
            className="bg-white border border-black/10 rounded-lg p-4 hover:border-accent/50 block"
          >
            <h2 className="font-medium text-ink">{project.name}</h2>
            <p className="text-sm text-accent mt-3">Open project →</p>
          </a>
        ))}
      </div>
    </div>
  );
}
