"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { crosscheckDecisionPoint } from "@/lib/crosscheck";

export default function SchedulePage({ params }) {
  const { planId } = params;
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);

    const [{ data: planData }, { data: points }, { data: pois }, { data: signTypes }] = await Promise.all([
      supabase.from("plans").select("*").eq("id", planId).single(),
      supabase.from("decision_points").select("*").eq("plan_id", planId).order("sequence_order"),
      supabase.from("pois").select("*").eq("plan_id", planId),
      supabase.from("sign_types").select("*"),
    ]);
    setPlan(planData);

    const poiIds = (pois || []).map((p) => p.id);
    let messagesByPoi = {};
    if (poiIds.length > 0) {
      const { data: messages } = await supabase.from("messages").select("*").in("poi_id", poiIds);
      messagesByPoi = (messages || []).reduce((acc, m) => {
        (acc[m.poi_id] = acc[m.poi_id] || []).push(m);
        return acc;
      }, {});
    }

    const results = (points || []).map((point) => {
      const linkedPois = (pois || []).filter((p) => p.decision_point_id === point.id);
      const allMessages = linkedPois.flatMap((p) => messagesByPoi[p.id] || []);
      const result = crosscheckDecisionPoint(allMessages, signTypes || []);

      return {
        decisionPoint: point,
        locations: linkedPois.map((p) => p.name),
        messages: allMessages,
        result,
      };
    });

    setRows(results);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    run();
  }, [run]);

  function exportCsv() {
    const header = ["Decision point", "Locations", "Messages", "Sign type", "Status", "Notes"];
    const lines = rows.map((r) => [
      r.decisionPoint.label || r.decisionPoint.id.slice(0, 8),
      r.locations.join(" / "),
      r.messages.map((m) => m.text).join(" | "),
      r.result.signType?.name || "",
      r.result.status,
      r.result.reason || "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan?.name || "sign-schedule"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const conflictCount = rows.filter((r) => r.result.status === "conflict").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-ink">{plan ? plan.name : "Sign schedule"}</h1>
        <div className="flex gap-3">
          <a href={`/editor/${planId}`} className="text-sm text-accent hover:underline self-center">
            Back to editor
          </a>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="bg-accent text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>
      <p className="text-ink/60 mb-6">
        Auto-generated from your route, locations, messages, and KOP. Review conflicts before finalizing scope.
      </p>

      {loading && <p className="text-ink/50">Running crosscheck...</p>}

      {!loading && rows.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No decision points on this plan yet. Add routes and locations in the editor first.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {conflictCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm mb-4">
              {conflictCount} decision point{conflictCount === 1 ? "" : "s"} couldn&apos;t be auto-assigned a sign type.
              Review the rows marked &quot;conflict&quot; below.
            </div>
          )}

          <div className="bg-white border border-black/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-ink/60 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Decision point</th>
                  <th className="px-4 py-2 font-medium">Locations</th>
                  <th className="px-4 py-2 font-medium">Messages</th>
                  <th className="px-4 py-2 font-medium">Sign type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.decisionPoint.id} className="border-t border-black/10 align-top">
                    <td className="px-4 py-3 text-ink/80">
                      {r.decisionPoint.label || `Point ${r.decisionPoint.sequence_order + 1}`}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{r.locations.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {r.messages.length === 0
                        ? "—"
                        : r.messages.map((m) => m.text).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-ink/80">{r.result.signType?.name || "—"}</td>
                    <td className="px-4 py-3">
                      {r.result.status === "auto" && (
                        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 text-xs">
                          Assigned
                        </span>
                      )}
                      {r.result.status === "conflict" && (
                        <span
                          className="inline-block bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs"
                          title={r.result.reason}
                        >
                          Conflict
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
