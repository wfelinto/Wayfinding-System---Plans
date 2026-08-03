"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setPlans(data);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Plans</h1>
          <p className="text-ink/60 mt-1">
            Upload a floor plan, then draw routes and tag signage locations on it.
          </p>
        </div>
        <a
          href="/plans/new"
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          Upload plan
        </a>
      </div>

      {loading && <p className="text-ink/50">Loading plans...</p>}
      {error && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
          {error}
        </p>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No plans yet. Upload one to get started.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white border border-black/10 rounded-lg p-4">
            <h2 className="font-medium text-ink">{plan.name}</h2>
            {plan.floor_label && (
              <p className="text-sm text-ink/50 mt-0.5">{plan.floor_label}</p>
            )}
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
