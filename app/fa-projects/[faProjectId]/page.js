"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FaProjectHubPage({ params }) {
  const { faProjectId } = params;
  const [project, setProject] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: projectData }, requests] = await Promise.all([
      supabase.from("fa_projects").select("*").eq("id", faProjectId).single(),
      supabase.from("fa_requests").select("id", { count: "exact", head: true }).eq("fa_project_id", faProjectId),
    ]);
    setProject(projectData);
    setRequestCount(requests.count || 0);
    setLoading(false);
  }

  return (
    <div>
      <a href="/" className="text-sm text-accent hover:underline">← All projects</a>
      <div className="flex items-center gap-3 mt-2 mb-6 flex-wrap">
        <h1 className="text-2xl font-semibold text-ink">{loading ? "Loading..." : project?.name}</h1>
        <a
          href={`/fa-projects/${faProjectId}/kop`}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          FA Sign Types (KoP)
        </a>
        <a
          href={`/fa-projects/${faProjectId}/venues`}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          Venues
        </a>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <a
          href={`/fa-projects/${faProjectId}/requests`}
          className="bg-white border border-black/10 rounded-lg p-5 hover:border-accent/50 block"
        >
          <h2 className="font-medium text-ink">Sign requests</h2>
          <p className="text-sm text-ink/50 mt-1">{requestCount} request{requestCount === 1 ? "" : "s"}</p>
          <p className="text-sm text-accent mt-3">Request a sign / view schedule →</p>
        </a>
      </div>
    </div>
  );
}
