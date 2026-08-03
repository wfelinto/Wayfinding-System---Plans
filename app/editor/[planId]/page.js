"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlanCanvas from "@/components/PlanCanvas";

export default function EditorPage({ params }) {
  const { planId } = params;

  const [plan, setPlan] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [decisionPoints, setDecisionPoints] = useState([]);
  const [routeSegments, setRouteSegments] = useState([]);
  const [pois, setPois] = useState([]);
  const [messages, setMessages] = useState([]);

  const [mode, setMode] = useState("route"); // 'route' | 'poi' | 'select'
  const [lastPlacedId, setLastPlacedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'decision_point' | 'poi'
  const [selectedId, setSelectedId] = useState(null);

  const [pendingPoi, setPendingPoi] = useState(null); // {x, y}
  const [poiForm, setPoiForm] = useState({ name: "", functional_area: "" });
  const [msgForm, setMsgForm] = useState({ text: "", has_pictogram: false, priority: 1 });

  const loadPlan = useCallback(async () => {
    const { data } = await supabase.from("plans").select("*").eq("id", planId).single();
    if (data) {
      setPlan(data);
      const { data: pub } = supabase.storage.from("plans").getPublicUrl(data.file_path);
      setImageUrl(pub.publicUrl);
    }
  }, [planId]);

  const loadGeometry = useCallback(async () => {
    const [dp, rs, po] = await Promise.all([
      supabase.from("decision_points").select("*").eq("plan_id", planId).order("sequence_order"),
      supabase.from("route_segments").select("*").eq("plan_id", planId),
      supabase.from("pois").select("*").eq("plan_id", planId),
    ]);
    setDecisionPoints(dp.data || []);
    setRouteSegments(rs.data || []);
    setPois(po.data || []);
  }, [planId]);

  useEffect(() => {
    loadPlan();
    loadGeometry();
  }, [loadPlan, loadGeometry]);

  useEffect(() => {
    if (selectedType === "poi" && selectedId) {
      supabase
        .from("messages")
        .select("*")
        .eq("poi_id", selectedId)
        .order("priority")
        .then(({ data }) => setMessages(data || []));
    } else {
      setMessages([]);
    }
  }, [selectedType, selectedId]);

  async function handleCanvasClick(xPct, yPct) {
    if (mode === "route") {
      const { data: inserted, error } = await supabase
        .from("decision_points")
        .insert({
          plan_id: planId,
          x: xPct,
          y: yPct,
          sequence_order: decisionPoints.length,
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
      setPoiForm({ name: "", functional_area: "" });
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
      functional_area: poiForm.functional_area || null,
      x: pendingPoi.x,
      y: pendingPoi.y,
    });
    setPendingPoi(null);
    loadGeometry();
  }

  async function addMessage(e) {
    e.preventDefault();
    if (!msgForm.text || selectedType !== "poi") return;
    await supabase.from("messages").insert({
      poi_id: selectedId,
      text: msgForm.text,
      has_pictogram: msgForm.has_pictogram,
      priority: Number(msgForm.priority),
    });
    setMsgForm({ text: "", has_pictogram: false, priority: 1 });
    const { data } = await supabase.from("messages").select("*").eq("poi_id", selectedId).order("priority");
    setMessages(data || []);
  }

  async function deleteMessage(id) {
    await supabase.from("messages").delete().eq("id", id);
    setMessages(messages.filter((m) => m.id !== id));
  }

  const selectedPoi = selectedType === "poi" ? pois.find((p) => p.id === selectedId) : null;
  const selectedPoint = selectedType === "decision_point" ? decisionPoints.find((p) => p.id === selectedId) : null;

  if (!plan || !imageUrl) return <p className="text-ink/50">Loading plan...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{plan.name}</h1>
          <a href={`/schedule/${planId}`} className="text-sm text-accent hover:underline">
            View sign schedule for this plan →
          </a>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <p className="text-sm text-ink/50 mb-3">
        {mode === "route" && "Click the plan to place decision points in sequence — each new click connects to the last one."}
        {mode === "poi" && "Click the plan to place a location of interest. It links to the nearest decision point automatically."}
        {mode === "select" && "Click an existing pin to view or edit its details."}
      </p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
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
              <input
                value={poiForm.functional_area}
                onChange={(e) => setPoiForm({ ...poiForm, functional_area: e.target.value })}
                placeholder="Functional area (optional)"
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
            <div className="bg-white border border-black/10 rounded-lg p-4">
              <h3 className="font-medium text-ink text-sm mb-1">Decision point</h3>
              <p className="text-sm text-ink/60">
                {pois.filter((p) => p.decision_point_id === selectedPoint.id).length} location(s) linked here.
              </p>
            </div>
          )}

          {selectedPoi && (
            <div className="bg-white border border-black/10 rounded-lg p-4">
              <h3 className="font-medium text-ink text-sm mb-1">{selectedPoi.name}</h3>
              {selectedPoi.functional_area && (
                <p className="text-xs text-ink/50 mb-3">{selectedPoi.functional_area}</p>
              )}

              <div className="space-y-2 mb-3">
                {messages.length === 0 && <p className="text-sm text-ink/40">No messages yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className="flex items-start justify-between text-sm border border-black/10 rounded-md px-2 py-1.5">
                    <div>
                      <p className="text-ink">{m.text}</p>
                      <p className="text-xs text-ink/40">
                        priority {m.priority}
                        {m.has_pictogram ? " · pictogram" : ""}
                      </p>
                    </div>
                    <button onClick={() => deleteMessage(m.id)} className="text-red-600 text-xs hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addMessage} className="space-y-2 border-t border-black/10 pt-3">
                <input
                  value={msgForm.text}
                  onChange={(e) => setMsgForm({ ...msgForm, text: e.target.value })}
                  placeholder="Message text"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-ink/70">
                    <input
                      type="checkbox"
                      checked={msgForm.has_pictogram}
                      onChange={(e) => setMsgForm({ ...msgForm, has_pictogram: e.target.checked })}
                    />
                    Pictogram
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink/70">
                    Priority
                    <input
                      type="number"
                      min="1"
                      value={msgForm.priority}
                      onChange={(e) => setMsgForm({ ...msgForm, priority: e.target.value })}
                      className="w-14 border border-black/15 rounded-md px-2 py-1 text-xs"
                    />
                  </label>
                </div>
                <button type="submit" className="bg-accent text-white px-3 py-1.5 rounded-md text-sm font-medium">
                  Add message
                </button>
              </form>
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
