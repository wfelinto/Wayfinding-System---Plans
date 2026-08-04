"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlanCanvas from "@/components/PlanCanvas";
import { downloadPlanPdf, downloadSignReportPdf } from "@/lib/pdfExport";

const STATUS_OPTIONS = [
  "Draft",
  "Location Approved",
  "Sign type approved",
  "Content Approved",
  "Artwork approved",
  "In Production",
  "Produced",
  "Installed",
];

export default function EditorPage({ params }) {
  const { planId } = params;

  const [plan, setPlan] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [decisionPoints, setDecisionPoints] = useState([]);
  const [routeSegments, setRouteSegments] = useState([]);
  const [pois, setPois] = useState([]);
  const [signTypes, setSignTypes] = useState([]);

  const [mode, setMode] = useState("route"); // 'route' | 'poi' | 'select'
  const [lastPlacedId, setLastPlacedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'decision_point' | 'poi'
  const [selectedId, setSelectedId] = useState(null);

  const [pendingPoi, setPendingPoi] = useState(null); // {x, y}
  const [poiForm, setPoiForm] = useState({ name: "" });

  // Full sign content for the selected decision point (the "dot").
  const [dpForm, setDpForm] = useState({
    sign_code: "",
    location: "",
    functional_area: "",
    messages: "",
    needs_pictogram: false,
    status: "Draft",
    sign_type_id: "",
  });
  const [dpSaving, setDpSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null); // 'plan' | 'report' | null
  const [pdfError, setPdfError] = useState(null);

  const loadPlan = useCallback(async () => {
    const { data } = await supabase.from("plans").select("*").eq("id", planId).single();
    if (data) {
      setPlan(data);
      const { data: pub } = supabase.storage.from("plans").getPublicUrl(data.file_path);
      setImageUrl(pub.publicUrl);
    }
  }, [planId]);

  const loadGeometry = useCallback(async () => {
    const [dp, rs, po, st] = await Promise.all([
      supabase.from("decision_points").select("*").eq("plan_id", planId).order("sequence_order"),
      supabase.from("route_segments").select("*").eq("plan_id", planId),
      supabase.from("pois").select("*").eq("plan_id", planId),
      supabase.from("sign_types").select("*").order("name"),
    ]);
    setDecisionPoints(dp.data || []);
    setRouteSegments(rs.data || []);
    setPois(po.data || []);
    setSignTypes(st.data || []);
  }, [planId]);

  useEffect(() => {
    loadPlan();
    loadGeometry();
  }, [loadPlan, loadGeometry]);

  useEffect(() => {
    if (selectedType === "decision_point" && selectedId) {
      const dp = decisionPoints.find((p) => p.id === selectedId);
      setDpForm({
        sign_code: dp?.sign_code || "",
        location: dp?.location || "",
        functional_area: dp?.functional_area || "",
        messages: dp?.messages || "",
        needs_pictogram: dp?.needs_pictogram || false,
        status: dp?.status || "Draft",
        sign_type_id: dp?.sign_type_id || "",
      });
    }
  }, [selectedType, selectedId, decisionPoints]);

  async function handleCanvasClick(xPct, yPct) {
    if (mode === "route") {
      const nextSignCode = `Sign ${decisionPoints.length + 1}`;
      const { data: inserted, error } = await supabase
        .from("decision_points")
        .insert({
          plan_id: planId,
          x: xPct,
          y: yPct,
          sequence_order: decisionPoints.length,
          sign_code: nextSignCode,
        })
        .select()
        .single();
      if (error) return;

      if (lastPlacedId) {
        await supabase.from("route_segments").insert({
          plan_id: planId,
          from_point: lastPlacedId,
          to_point: inserted.id,
        });
      }
      setLastPlacedId(inserted.id);
      loadGeometry();
    } else if (mode === "poi") {
      setPendingPoi({ x: xPct, y: yPct });
      setPoiForm({ name: "" });
    }
  }

  function nearestDecisionPoint(x, y) {
    if (decisionPoints.length === 0) return null;
    let best = decisionPoints[0];
    let bestDist = Infinity;
    for (const p of decisionPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  async function savePoi(e) {
    e.preventDefault();
    if (!pendingPoi || !poiForm.name) return;
    const nearest = nearestDecisionPoint(pendingPoi.x, pendingPoi.y);
    await supabase.from("pois").insert({
      plan_id: planId,
      decision_point_id: nearest ? nearest.id : null,
      name: poiForm.name,
      x: pendingPoi.x,
      y: pendingPoi.y,
    });
    setPendingPoi(null);
    loadGeometry();
  }

  async function saveDecisionPointDetails(e) {
    e.preventDefault();
    if (selectedType !== "decision_point" || !selectedId) return;
    setDpSaving(true);
    await supabase
      .from("decision_points")
      .update({
        sign_code: dpForm.sign_code || null,
        location: dpForm.location || null,
        functional_area: dpForm.functional_area || null,
        messages: dpForm.messages || null,
        needs_pictogram: dpForm.needs_pictogram,
        status: dpForm.status,
        sign_type_id: dpForm.sign_type_id || null,
      })
      .eq("id", selectedId);
    setDpSaving(false);
    loadGeometry();
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || selectedType !== "decision_point" || !selectedId) return;
    setImageUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("dot-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      await supabase.from("decision_points").update({ image_path: filePath }).eq("id", selectedId);
      loadGeometry();
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploading(false);
    }
  }

  async function clearAll() {
    const confirmed = window.confirm(
      "This will permanently delete every route, decision point, location, and message on this plan. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    await supabase.from("pois").delete().eq("plan_id", planId);
    await supabase.from("decision_points").delete().eq("plan_id", planId);

    setLastPlacedId(null);
    setSelectedType(null);
    setSelectedId(null);
    setPendingPoi(null);
    loadGeometry();
  }

  async function handleDownloadPlanPdf() {
    setPdfError(null);
    setPdfBusy("plan");
    try {
      await downloadPlanPdf(plan, imageUrl, decisionPoints, routeSegments);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleDownloadSignReport() {
    setPdfError(null);
    setPdfBusy("report");
    try {
      const signTypesById = Object.fromEntries(signTypes.map((st) => [st.id, st]));
      await downloadSignReportPdf(plan, imageUrl, decisionPoints, routeSegments, signTypesById);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  const selectedPoi = selectedType === "poi" ? pois.find((p) => p.id === selectedId) : null;
  const selectedPoint = selectedType === "decision_point" ? decisionPoints.find((p) => p.id === selectedId) : null;

  const selectedPointImageUrl =
    selectedPoint?.image_path
      ? supabase.storage.from("dot-images").getPublicUrl(selectedPoint.image_path).data.publicUrl
      : null;

  if (!plan || !imageUrl) return <p className="text-ink/50">Loading plan...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <a href={`/projects/${plan.project_id}`} className="text-sm text-accent hover:underline">
            ← Back to project
          </a>
          <h1 className="text-2xl font-semibold text-ink mt-1">{plan.name}</h1>
          <a href={`/schedule/${planId}`} className="text-sm text-accent hover:underline">
            View sign schedule for this plan →
          </a>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <button
            onClick={() => {
              setMode("route");
              setLastPlacedId(null);
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              mode === "route" ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
            }`}
          >
            Draw route
          </button>
          <button
            onClick={() => setMode("poi")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              mode === "poi" ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
            }`}
          >
            Add location
          </button>
          <button
            onClick={() => setMode("select")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              mode === "select" ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
            }`}
          >
            Select
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50"
          >
            Clear all
          </button>
          <span className="w-px bg-black/10 mx-1 self-stretch" />
          <button
            onClick={handleDownloadPlanPdf}
            disabled={pdfBusy !== null}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
          >
            {pdfBusy === "plan" ? "Preparing..." : "Download plan PDF"}
          </button>
          <button
            onClick={handleDownloadSignReport}
            disabled={pdfBusy !== null}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
          >
            {pdfBusy === "report" ? "Preparing..." : "Download sign report PDF"}
          </button>
        </div>
      </div>

      {pdfError && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm mb-3">{pdfError}</p>
      )}

      <p className="text-sm text-ink/50 mb-3">
        {mode === "route" && "Click the plan to place decision points in sequence — each new click connects to the last one."}
        {mode === "poi" && "Click the plan to place a location. It links to the nearest decision point automatically."}
        {mode === "select" && "Click an existing pin to view or edit its details."}
      </p>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <PlanCanvas
          imageUrl={imageUrl}
          decisionPoints={decisionPoints}
          routeSegments={routeSegments}
          pois={pois}
          selectedType={selectedType}
          selectedId={selectedId}
          onCanvasClick={handleCanvasClick}
          onSelectDecisionPoint={(id) => {
            setSelectedType("decision_point");
            setSelectedId(id);
          }}
          onSelectPoi={(id) => {
            setSelectedType("poi");
            setSelectedId(id);
          }}
        />

        <div className="space-y-4">
          {pendingPoi && (
            <form onSubmit={savePoi} className="bg-white border border-black/10 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-ink text-sm">New location</h3>
              <input
                autoFocus
                value={poiForm.name}
                onChange={(e) => setPoiForm({ ...poiForm, name: e.target.value })}
                placeholder="e.g. Room 204, Reception"
                className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-accent text-white px-3 py-1.5 rounded-md text-sm font-medium">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPoi(null)}
                  className="text-ink/60 text-sm px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {selectedPoint && (
            <form
              onSubmit={saveDecisionPointDetails}
              className="bg-white border border-black/10 rounded-lg p-4 space-y-3 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Sign code</label>
                <input
                  value={dpForm.sign_code}
                  onChange={(e) => setDpForm({ ...dpForm, sign_code: e.target.value })}
                  placeholder="e.g. Sign 1"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm font-medium"
                />
              </div>

              <p className="text-xs text-ink/50">
                {pois.filter((p) => p.decision_point_id === selectedPoint.id).length} location(s) linked here.
              </p>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Location</label>
                <input
                  value={dpForm.location}
                  onChange={(e) => setDpForm({ ...dpForm, location: e.target.value })}
                  placeholder="e.g. Corridor ceiling above Gate 12"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Functional area</label>
                <input
                  value={dpForm.functional_area}
                  onChange={(e) => setDpForm({ ...dpForm, functional_area: e.target.value })}
                  placeholder="e.g. Parking, Retail"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
                <p className="text-xs text-ink/40 mt-1">One cell in the export, exactly as typed.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Messages</label>
                <textarea
                  value={dpForm.messages}
                  onChange={(e) => setDpForm({ ...dpForm, messages: e.target.value })}
                  placeholder={"One message per line, e.g.\nRestrooms →\nGate 12 ↑"}
                  rows={4}
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm font-mono"
                />
                <p className="text-xs text-ink/40 mt-1">Each line is one message; all lines form one Messages cell.</p>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  checked={dpForm.needs_pictogram}
                  onChange={(e) => setDpForm({ ...dpForm, needs_pictogram: e.target.checked })}
                />
                Needs a pictogram
              </label>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Sign type</label>
                <select
                  value={dpForm.sign_type_id}
                  onChange={(e) => setDpForm({ ...dpForm, sign_type_id: e.target.value })}
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
                >
                  <option value="">Not selected</option>
                  {signTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                {signTypes.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    No sign types yet — add some on the <a href="/kop" className="underline">KOP page</a>.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Status</label>
                <select
                  value={dpForm.status}
                  onChange={(e) => setDpForm({ ...dpForm, status: e.target.value })}
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Photo</label>
                {selectedPointImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPointImageUrl}
                    alt="Sign location"
                    className="w-full max-h-40 object-cover rounded-md border border-black/10 mb-2"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                  className="w-full text-xs"
                />
                {imageUploading && <p className="text-xs text-ink/40 mt-1">Uploading...</p>}
              </div>

              <button
                type="submit"
                disabled={dpSaving}
                className="w-full bg-accent text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {dpSaving ? "Saving..." : "Save details"}
              </button>
            </form>
          )}

          {selectedPoi && (
            <div className="bg-white border border-black/10 rounded-lg p-4">
              <h3 className="font-medium text-ink text-sm mb-1">{selectedPoi.name}</h3>
              <p className="text-xs text-ink/50">
                Messages and sign details for this location live on its linked decision point — select the
                connected dot to edit them.
              </p>
            </div>
          )}

          {!pendingPoi && !selectedPoi && !selectedPoint && (
            <div className="border border-dashed border-black/15 rounded-lg p-6 text-center text-sm text-ink/40">
              Select a pin, or place a new decision point / location on the plan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
