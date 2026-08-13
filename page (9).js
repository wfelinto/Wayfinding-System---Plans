"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FaProjectHubPage({ params }) {
  const { faProjectId } = params;
  const [project, setProject] = useState(null);
  const [counts, setCounts] = useState({ signTypes: 0, venues: 0, requests: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: projectData }, signTypes, venues, requests] = await Promise.all([
      supabase.from("fa_projects").select("*").eq("id", faProjectId).single(),
      supabase.from("fa_sign_types").select("id", { count: "exact", head: true }).eq("fa_project_id", faProjectId),
      supabase.from("fa_venues").select("id", { count: "exact", head: true }).eq("fa_project_id", faProjectId),
      supabase.from("fa_requests").select("id", { count: "exact", head: true }).eq("fa_project_id", faProjectId),
    ]);
    setProject(projectData);
    setCounts({
      signTypes: signTypes.count || 0,
      venues: venues.count || 0,
      requests: requests.count || 0,
    });
    setLoading(false);
  }

  return (
    <div>
      <a href="/" className="text-sm text-accent hover:underline">← All projects</a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-6">
        {loading ? "Loading..." : project?.name}
      </h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <a
          href={`/fa-projects/${faProjectId}/kop`}
          className="bg-white border border-black/10 rounded-lg p-5 hover:border-accent/50 block"
        >
          <h2 className="font-medium text-ink">FA Sign Types (KoP)</h2>
          <p className="text-sm text-ink/50 mt-1">{counts.signTypes} sign type{counts.signTypes === 1 ? "" : "s"}</p>
          <p className="text-sm text-accent mt-3">Manage sign types →</p>
        </a>

        <a
          href={`/fa-projects/${faProjectId}/venues`}
          className="bg-white border border-black/10 rounded-lg p-5 hover:border-accent/50 block"
        >
          <h2 className="font-medium text-ink">Venues</h2>
          <p className="text-sm text-ink/50 mt-1">{counts.venues} venue{counts.venues === 1 ? "" : "s"}</p>
          <p className="text-sm text-accent mt-3">Manage venues →</p>
        </a>

        <a
          href={`/fa-projects/${faProjectId}/requests`}
          className="bg-white border border-black/10 rounded-lg p-5 hover:border-accent/50 block"
        >
          <h2 className="font-medium text-ink">Sign requests</h2>
          <p className="text-sm text-ink/50 mt-1">{counts.requests} request{counts.requests === 1 ? "" : "s"}</p>
          <p className="text-sm text-accent mt-3">Request a sign / view schedule →</p>
        </a>
      </div>
    </div>
  );
}
