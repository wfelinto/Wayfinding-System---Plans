"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canAccessWayfinding, canAccessFaSignage } from "@/lib/permissions";

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

/** A renamable, deletable project card, reused for both Wayfinding and FA Signage projects. */
function ProjectCard({ project, hrefBase, table, deleteWarning, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  function cancelEdit() {
    setEditing(false);
    setName(project.name);
  }

  async function saveEdit() {
    if (!name.trim()) return;
    await supabase.from(table).update({ name: name.trim() }).eq("id", project.id);
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${project.name}"? ${deleteWarning} This can't be undone.`);
    if (!confirmed) return;
    await supabase.from(table).delete().eq("id", project.id);
    onChanged();
  }

  return (
    <div className="bg-white border border-black/10 rounded-lg p-4 hover:border-accent/50">
      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="w-full border border-black/15 rounded-md px-2 py-1 text-sm font-medium"
          />
          <div className="flex gap-2">
            <button onClick={saveEdit} className="text-xs bg-accent text-white px-2 py-1 rounded-md font-medium">
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
            <a href={`${hrefBase}/${project.id}`} className="font-medium text-ink hover:underline">
              {project.name}
            </a>
            <div className="flex gap-1 shrink-0 -mt-1 -mr-1">
              <button
                onClick={() => setEditing(true)}
                title="Rename"
                className="text-ink/40 hover:text-ink p-1.5 rounded hover:bg-black/5"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                title="Delete"
                className="text-ink/40 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <a href={`${hrefBase}/${project.id}`} className="text-sm text-accent mt-3 block">
            Open project →
          </a>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [wayfindingProjects, setWayfindingProjects] = useState([]);
  const [faProjects, setFaProjects] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    let myRole = null;
    if (userData?.user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
      myRole = profile?.role || null;
    }
    setRole(myRole);

    const wfAllowed = canAccessWayfinding(myRole);
    const faAllowed = canAccessFaSignage(myRole);

    const [{ data: wf, error: wfError }, { data: fa, error: faError }] = await Promise.all([
      wfAllowed
        ? supabase.from("projects").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      faAllowed
        ? supabase.from("fa_projects").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (wfError || faError) setError((wfError || faError).message);
    setWayfindingProjects(wf || []);
    setFaProjects(fa || []);
    setLoading(false);
  }

  return (
    <div className="space-y-12">
      {canAccessWayfinding(role) && (
      <div>
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-2xl font-semibold text-ink">Wayfinding Projects</h1>
          <a
            href="/projects/new"
            className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            New project
          </a>
        </div>
        <p className="text-ink/60 mb-6">Each project can hold several plans — floors, buildings, or phases.</p>

        {loading && <p className="text-ink/50">Loading...</p>}
        {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>}

        {!loading && !error && wayfindingProjects.length === 0 && (
          <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
            No projects yet. Create one to get started.
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wayfindingProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              hrefBase="/projects"
              table="projects"
              deleteWarning="This permanently removes every plan, sign, and message inside it."
              onChanged={load}
            />
          ))}
        </div>
      </div>
      )}

      {canAccessFaSignage(role) && (
      <div>
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-2xl font-semibold text-ink">FA Signage Projects</h1>
          <a
            href="/fa-projects/new"
            className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            New project
          </a>
        </div>
        <p className="text-ink/60 mb-6">
          Request and track Functional Area signage — venues, sign types, and cost per request.
        </p>

        {!loading && !error && faProjects.length === 0 && (
          <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
            No FA Signage projects yet. Create one to get started.
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {faProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              hrefBase="/fa-projects"
              table="fa_projects"
              deleteWarning="This permanently removes its sign types, venues, and all requests."
              onChanged={load}
            />
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
