"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function PencilIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6M6.5 6l.6 10.4A1.5 1.5 0 0 0 8.6 18h2.8a1.5 1.5 0 0 0 1.5-1.6L13.5 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

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

  function startEdit(project) {
    setEditingId(project.id);
    setEditingName(project.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await supabase.from("projects").update({ name: editingName.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(project) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This permanently removes every plan, sign, and message inside it. This can't be undone.`
    );
    if (!confirmed) return;
    await supabase.from("projects").delete().eq("id", project.id);
    load();
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
          <div key={project.id} className="bg-white border border-black/10 rounded-lg p-4 hover:border-accent/50">
            {editingId === project.id ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(project.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-full border border-black/15 rounded-md px-2 py-1 text-sm font-medium"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(project.id)}
                    className="text-xs bg-accent text-white px-2 py-1 rounded-md font-medium"
                  >
                    Save
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-ink/50 px-2 py-1">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <a href={`/projects/${project.id}`} className="font-medium text-ink hover:underline">
                    {project.name}
                  </a>
                  <div className="flex gap-1 shrink-0 -mt-1 -mr-1">
                    <button
                      onClick={() => startEdit(project)}
                      title="Rename project"
                      className="text-ink/40 hover:text-ink p-1.5 rounded hover:bg-black/5"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
                      title="Delete project"
                      className="text-ink/40 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <a href={`/projects/${project.id}`} className="text-sm text-accent mt-3 block">
                  Open project →
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
