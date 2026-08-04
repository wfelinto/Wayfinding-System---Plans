"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProjectPage({ params }) {
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
            <h2 className="font-medium text-ink">{plan.name}</h2>
            {plan.floor_label && <p className="text-sm text-ink/50 mt-0.5">{plan.floor_label}</p>}
            <div className="flex gap-3 mt-4 text-sm">
              <a href={`/editor/${plan.id}`} className="text-accent font-medium hover:underline">
                Open editor
              </a>
              <a href={`/schedule/${plan.id}`} className="text-ink/60 hover:underline">
                View schedule
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
