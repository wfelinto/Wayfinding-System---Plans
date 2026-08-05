"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function ProjectPage({ params }) {
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: projectData }, { data: plansData, error: plansError }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("plans").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setProject(projectData);
    if (plansError) setError(plansError.message);
    else setPlans(plansData);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(plan) {
    setEditingId(plan.id);
    setEditingName(plan.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await supabase.from("plans").update({ name: editingName.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(plan) {
    const confirmed = window.confirm(
      `Delete "${plan.name}"? This permanently removes every sign and message on this plan. This can't be undone.`
    );
    if (!confirmed) return;
    await supabase.from("plans").delete().eq("id", plan.id);
    load();
  }

  return (
    <div>
      <a href="/" className="text-sm text-accent hover:underline">← All projects</a>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-semibold text-ink">{project ? project.name : "Loading..."}</h1>
        <a
          href={`/projects/${projectId}/plans/new`}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          Upload plan
        </a>
      </div>

      {loading && <p className="text-ink/50">Loading plans...</p>}
      {error && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">{error}</p>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No plans in this project yet. Upload one to get started.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white border border-black/10 rounded-lg p-4">
            {editingId === plan.id ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(plan.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-full border border-black/15 rounded-md px-2 py-1 text-sm font-medium"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(plan.id)}
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
                  <div>
                    <h2 className="font-medium text-ink">{plan.name}</h2>
                    {plan.floor_label && <p className="text-sm text-ink/50 mt-0.5">{plan.floor_label}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0 -mt-1 -mr-1">
                    <button
                      onClick={() => startEdit(plan)}
                      title="Rename plan"
                      className="text-ink/40 hover:text-ink p-1.5 rounded hover:bg-black/5"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      title="Delete plan"
                      className="text-ink/40 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 mt-4 text-sm">
                  <a href={`/editor/${plan.id}`} className="text-accent font-medium hover:underline">
                    Open editor
                  </a>
                  <a href={`/schedule/${plan.id}`} className="text-ink/60 hover:underline">
                    View schedule
                  </a>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
