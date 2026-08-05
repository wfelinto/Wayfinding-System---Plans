"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { crosscheckDecisionPoint, nonEmptyMessages, formatMessageLine } from "@/lib/crosscheck";

const STATUS_COLORS = {
  Draft: "bg-black/5 text-ink/60 border-black/10",
  "Location Approved": "bg-blue-50 text-blue-700 border-blue-200",
  "Sign type approved": "bg-blue-50 text-blue-700 border-blue-200",
  "Content Approved": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Artwork approved": "bg-purple-50 text-purple-700 border-purple-200",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200",
  Produced: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Installed: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function SchedulePage({ params }) {
  const { planId } = params;
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);

    const [{ data: planData }, { data: points }, { data: signTypes }, { data: pictograms }] = await Promise.all([
      supabase.from("plans").select("*").eq("id", planId).single(),
      supabase.from("decision_points").select("*").eq("plan_id", planId).order("sequence_order"),
      supabase.from("sign_types").select("*"),
      supabase.from("pictograms").select("*"),
    ]);
    setPlan(planData);

    const signTypesById = Object.fromEntries((signTypes || []).map((st) => [st.id, st]));
    const pictogramsById = Object.fromEntries((pictograms || []).map((p) => [p.id, p]));

    const results = (points || []).map((point, index) => {
      const messages = nonEmptyMessages(point.message_slots);
      const messageLines = messages.map((m) => formatMessageLine(m, pictogramsById));

      let signTypeName = "";
      let unitCost = "";
      let assignmentBadge;

      if (point.sign_type_id && signTypesById[point.sign_type_id]) {
        const st = signTypesById[point.sign_type_id];
        signTypeName = st.name;
        unitCost = st.unit_cost != null ? Number(st.unit_cost).toFixed(2) : "";
        assignmentBadge = { label: "Selected", color: "emerald" };
      } else {
        const needsPictogram = messages.some((m) => !!m.pictogram_id);
        const result = crosscheckDecisionPoint(messages, needsPictogram, signTypes || []);
        if (result.status === "auto") {
          signTypeName = `${result.signType.name} (suggested)`;
          unitCost = result.signType.unit_cost != null ? Number(result.signType.unit_cost).toFixed(2) : "";
          assignmentBadge = { label: "Suggested", color: "amber" };
        } else {
          // Deliberately blank rather than a placeholder character — a
          // "—" fallback here previously showed as garbled text when
          // opened in Excel due to a CSV encoding issue.
          signTypeName = "";
          assignmentBadge = { label: "Conflict", color: "red", reason: result.reason };
        }
      }

      return {
        decisionPoint: point,
        signCode: point.sign_code || `Sign ${index + 1}`,
        location: point.location || "",
        functionalArea: point.functional_area || "",
        mounting: point.mounting || "",
        comments: point.comments || "",
        messageLines,
        signTypeName,
        unitCost,
        assignmentBadge,
        status: point.status || "Draft",
      };
    });

    setRows(results);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    run();
  }, [run]);

  function exportCsv() {
    const header = [
      "Sign code",
      "Location",
      "Functional Area",
      "Messages",
      "Comments",
      "Mounting",
      "Sign Type",
      "Unit Cost",
      "Approval Status",
    ];
    const lines = rows.map((r) => [
      r.signCode,
      r.location,
      r.functionalArea,
      r.messageLines.join("; "),
      r.comments,
      r.mounting,
      r.signTypeName,
      r.unitCost,
      r.status,
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    // A UTF-8 BOM is required for Excel specifically — without it, Excel
    // assumes the system codepage instead of UTF-8, and any non-ASCII
    // character (arrows, accented names, etc.) renders as garbled text.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan?.name || "sign-schedule"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const conflictCount = rows.filter((r) => r.assignmentBadge.color === "red").length;

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
        Sign type shown is your manual selection where set, otherwise a suggestion from the KOP crosscheck.
      </p>

      {loading && <p className="text-ink/50">Loading...</p>}

      {!loading && rows.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No signs on this plan yet. Add signs in the editor first.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {conflictCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm mb-4">
              {conflictCount} sign{conflictCount === 1 ? "" : "s"} have no sign type selected and no auto-suggestion
              fits. Review the rows marked &quot;Conflict&quot; below.
            </div>
          )}

          <div className="bg-white border border-black/10 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-ink/60 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Sign code</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Functional Area</th>
                  <th className="px-4 py-2 font-medium">Messages</th>
                  <th className="px-4 py-2 font-medium">Comments</th>
                  <th className="px-4 py-2 font-medium">Mounting</th>
                  <th className="px-4 py-2 font-medium">Sign type</th>
                  <th className="px-4 py-2 font-medium">Unit cost</th>
                  <th className="px-4 py-2 font-medium">Approval status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.decisionPoint.id} className="border-t border-black/10 align-top">
                    <td className="px-4 py-3 text-ink/80 font-medium whitespace-nowrap">{r.signCode}</td>
                    <td className="px-4 py-3 text-ink/70">{r.location || "—"}</td>
                    <td className="px-4 py-3 text-ink/70">{r.functionalArea || "—"}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {r.messageLines.length === 0 ? "—" : r.messageLines.join("; ")}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{r.comments || "—"}</td>
                    <td className="px-4 py-3 text-ink/70">{r.mounting || "—"}</td>
                    <td className="px-4 py-3 text-ink/80 whitespace-nowrap">
                      <span title={r.assignmentBadge.reason}>{r.signTypeName || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-ink/70 whitespace-nowrap">
                      {r.unitCost ? `$${r.unitCost}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block border rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                          STATUS_COLORS[r.status] || STATUS_COLORS.Draft
                        }`}
                      >
                        {r.status}
                      </span>
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
