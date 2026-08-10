"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlanCanvas from "@/components/PlanCanvas";
import { downloadPlanPdf, downloadMessageSchedulePdf, downloadDotPlanReportPdf } from "@/lib/pdfExport";
import { normalizeMessageSlots, sidesForDesign } from "@/lib/crosscheck";
import { ARROW_OPTIONS } from "@/lib/arrows";
import PictogramPicker from "@/components/PictogramPicker";
import { renderPdfFirstPageToBlob } from "@/lib/pdfToImage";
import { normalizeImageToPngBlob } from "@/lib/normalizeImage";

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

/**
 * Shared editor for both dedicated views:
 *   mode="dots"  — Dot Plan Editor: just plain dot markers + the Dot Plan
 *                  Report. No sign fields at all.
 *   mode="signs" — Message Schedule Editor: the full sign workflow
 *                  (messages, sign type, KOP-driven fields) + the Message
 *                  Schedule PDF. This is what used to be the single editor.
 * Splitting these keeps each screen focused on one job instead of one
 * toolbar trying to do everything at once.
 */
export default function PlanEditor({ planId, mode }) {
  const isDotsMode = mode === "dots";

  const [plan, setPlan] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [decisionPoints, setDecisionPoints] = useState([]);
  const [signTypes, setSignTypes] = useState([]);
  const [pictograms, setPictograms] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [dpForm, setDpForm] = useState({
    sign_code: "",
    location: "",
    functional_area: "",
    mounting: "",
    comments: "",
    status: "Draft",
    sign_type_id: "",
    rotation: 0,
    message_slots: normalizeMessageSlots([]),
  });
  const [dpSaving, setDpSaving] = useState(false);
  const [dpSaveError, setDpSaveError] = useState(null);
  const [dpSaved, setDpSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [planFileUpdating, setPlanFileUpdating] = useState(false);
  const [planFileError, setPlanFileError] = useState(null);

  const loadPlan = useCallback(async () => {
    const { data } = await supabase.from("plans").select("*").eq("id", planId).single();
    if (data) {
      setPlan(data);
      const { data: pub } = supabase.storage.from("plans").getPublicUrl(data.file_path);
      setImageUrl(pub.publicUrl);
    }
  }, [planId]);

  const loadGeometry = useCallback(async () => {
    if (isDotsMode) {
      const dp = await supabase
        .from("decision_points")
        .select("*")
        .eq("plan_id", planId)
        .order("sequence_order");
      setDecisionPoints(dp.data || []);
    } else {
      const [dp, st, pic] = await Promise.all([
        supabase.from("decision_points").select("*").eq("plan_id", planId).order("sequence_order"),
        supabase.from("sign_types").select("*").order("name"),
        supabase.from("pictograms").select("*").order("name"),
      ]);
      setDecisionPoints(dp.data || []);
      setSignTypes(st.data || []);
      setPictograms(
        (pic.data || []).map((p) => ({
          ...p,
          imageUrl: supabase.storage.from("pictograms").getPublicUrl(p.image_path).data.publicUrl,
        }))
      );
    }
  }, [planId, isDotsMode]);

  useEffect(() => {
    loadPlan();
    loadGeometry();
  }, [loadPlan, loadGeometry]);

  useEffect(() => {
    setDpSaveError(null);
    setDpSaved(false);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) {
      const dp = decisionPoints.find((p) => p.id === selectedId);
      if (dp) {
        setDpForm({
          sign_code: dp.sign_code || "",
          location: dp.location || "",
          functional_area: dp.functional_area || "",
          mounting: dp.mounting || "",
          comments: dp.comments || "",
          status: dp.status || "Draft",
          sign_type_id: dp.sign_type_id || "",
          rotation: dp.rotation || 0,
          message_slots: normalizeMessageSlots(dp.message_slots),
        });
      }
    }
  }, [selectedId, decisionPoints]);

  // Only this editor's own point type is ever shown or placeable here —
  // dots and signs live in separate, focused screens.
  const visiblePoints = decisionPoints.filter((p) =>
    isDotsMode ? p.point_type === "dot" : p.point_type !== "dot"
  );

  async function handleCanvasClick(xPct, yPct) {
    if (!addMode) return;
    const nextCode = isDotsMode ? `Dot ${visiblePoints.length + 1}` : `Sign ${visiblePoints.length + 1}`;

    const { data: inserted, error } = await supabase
      .from("decision_points")
      .insert({
        plan_id: planId,
        x: xPct,
        y: yPct,
        sequence_order: decisionPoints.length,
        sign_code: nextCode,
        point_type: isDotsMode ? "dot" : "sign",
      })
      .select()
      .single();
    if (error) return;
    setSelectedId(inserted.id);
    loadGeometry();
  }

  async function handleMoveDecisionPoint(id, xPct, yPct) {
    await supabase.from("decision_points").update({ x: xPct, y: yPct }).eq("id", id);
    loadGeometry();
  }

  function updateMessageSlot(side, index, field, value) {
    setDpForm((prev) => {
      const sideSlots = prev.message_slots[side].map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      );
      return { ...prev, message_slots: { ...prev.message_slots, [side]: sideSlots } };
    });
  }

  async function saveDecisionPointDetails(e) {
    e.preventDefault();
    if (!selectedId) return;
    setDpSaving(true);
    setDpSaveError(null);
    setDpSaved(false);
    const payload = isDotsMode
      ? {
          sign_code: dpForm.sign_code || null,
          location: dpForm.location || null,
          comments: dpForm.comments || null,
        }
      : {
          sign_code: dpForm.sign_code || null,
          location: dpForm.location || null,
          functional_area: dpForm.functional_area || null,
          mounting: dpForm.mounting || null,
          comments: dpForm.comments || null,
          status: dpForm.status,
          sign_type_id: dpForm.sign_type_id || null,
          rotation: dpForm.rotation,
          message_slots: dpForm.message_slots,
        };
    const { error } = await supabase.from("decision_points").update(payload).eq("id", selectedId);
    setDpSaving(false);
    if (error) {
      setDpSaveError(error.message);
      return;
    }
    setDpSaved(true);
    loadGeometry();
  }

  async function handleFileUpload(e, field) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setImageUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("dot-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      await supabase.from("decision_points").update({ [field]: filePath }).eq("id", selectedId);
      loadGeometry();
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploading(false);
    }
  }

  async function deleteThisPoint() {
    if (!selectedId) return;
    const confirmed = window.confirm(`Delete this ${isDotsMode ? "dot" : "sign"}? This can't be undone.`);
    if (!confirmed) return;
    await supabase.from("decision_points").delete().eq("id", selectedId);
    setSelectedId(null);
    loadGeometry();
  }

  async function clearAllSigns() {
    const confirmed = window.confirm(
      "This will permanently delete every sign on this plan (dot locations are unaffected). This can't be undone. Continue?"
    );
    if (!confirmed) return;
    await supabase.from("decision_points").delete().eq("plan_id", planId).neq("point_type", "dot");
    setSelectedId(null);
    loadGeometry();
  }

  async function handleUpdatePlanFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "Update this plan's file? Existing signs and dots stay in place, but their positions are set relative to the image — if the new file has a different layout or orientation, they may no longer line up correctly. Continue?"
    );
    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setPlanFileUpdating(true);
    setPlanFileError(null);
    try {
      let uploadBlob = file;
      let fileExt = file.name.split(".").pop().toLowerCase();
      let contentType = file.type;

      if (file.type === "application/pdf" || fileExt === "pdf") {
        uploadBlob = await renderPdfFirstPageToBlob(file, 2.5);
        fileExt = "png";
        contentType = "image/png";
      } else {
        uploadBlob = await normalizeImageToPngBlob(file);
        fileExt = "png";
        contentType = "image/png";
      }

      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("plans")
        .upload(filePath, uploadBlob, { contentType });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from("plans").update({ file_path: filePath }).eq("id", planId);
      if (updateError) throw updateError;

      await loadPlan();
    } catch (err) {
      setPlanFileError(err.message);
    } finally {
      setPlanFileUpdating(false);
      e.target.value = "";
    }
  }

  async function handleDownloadPlanPdf() {
    setPdfError(null);
    setPdfBusy("plan");
    try {
      const signTypesById = Object.fromEntries(signTypes.map((st) => [st.id, st]));
      await downloadPlanPdf(plan, imageUrl, decisionPoints, signTypesById);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleDownloadMessageSchedule() {
    setPdfError(null);
    setPdfBusy("schedule");
    try {
      const signTypesById = Object.fromEntries(signTypes.map((st) => [st.id, st]));
      const pictogramsById = Object.fromEntries(pictograms.map((p) => [p.id, p]));
      await downloadMessageSchedulePdf(plan, imageUrl, decisionPoints, signTypesById, pictogramsById);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleDownloadDotPlanReport() {
    setPdfError(null);
    setPdfBusy("dots");
    try {
      await downloadDotPlanReportPdf(plan, imageUrl, decisionPoints);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  const selectedPoint = decisionPoints.find((p) => p.id === selectedId) || null;
  const selectedPointImageUrl = selectedPoint?.image_path
    ? supabase.storage.from("dot-images").getPublicUrl(selectedPoint.image_path).data.publicUrl
    : null;
  const selectedPointArtworkUrl = selectedPoint?.artwork_path
    ? supabase.storage.from("dot-images").getPublicUrl(selectedPoint.artwork_path).data.publicUrl
    : null;

  if (!plan || !imageUrl) return <p className="text-ink/50">Loading plan...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <a href={`/projects/${plan.project_id}`} className="text-sm text-accent hover:underline">
            ← Back to project
          </a>
          <h1 className="text-2xl font-semibold text-ink mt-1">
            {plan.name} — {isDotsMode ? "Dot Plan Editor" : "Message Schedule Editor"}
          </h1>
          <div className="flex gap-4">
            {!isDotsMode && (
              <a href={`/schedule/${planId}`} className="text-sm text-accent hover:underline">
                View sign schedule →
              </a>
            )}
            <a
              href={isDotsMode ? `/editor/${planId}` : `/editor/${planId}/dots`}
              className="text-sm text-ink/50 hover:text-ink hover:underline"
            >
              {isDotsMode ? "Switch to Message Schedule Editor →" : "Switch to Dot Plan Editor →"}
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-start">
          {isDotsMode ? (
            <>
              <button
                onClick={() => setAddMode((v) => !v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  addMode ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
                }`}
              >
                Add Dot Location
              </button>
              <span className="w-px bg-black/10 mx-1 self-stretch" />
              <button
                onClick={handleDownloadDotPlanReport}
                disabled={pdfBusy !== null}
                className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
              >
                {pdfBusy === "dots" ? "Preparing..." : "Download Dot Plan Report PDF"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setAddMode((v) => !v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  addMode ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
                }`}
              >
                Add Sign Type
              </button>
              <button
                onClick={clearAllSigns}
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
                onClick={handleDownloadMessageSchedule}
                disabled={pdfBusy !== null}
                className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
              >
                {pdfBusy === "schedule" ? "Preparing..." : "Download Message Schedule PDF"}
              </button>
            </>
          )}
        </div>
      </div>

      {pdfError && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm mb-3">{pdfError}</p>
      )}

      <p className="text-sm text-ink/50 mb-3">
        {addMode && isDotsMode && "Click the plan to place a new dot location. Click an existing pin to select it instead."}
        {addMode && !isDotsMode && "Click the plan to place a new sign. Click an existing pin to select it instead."}
        {!addMode && "Drag a pin to move it, or click one to view and edit its details."}
      </p>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div>
          <PlanCanvas
            imageUrl={imageUrl}
            decisionPoints={visiblePoints}
            selectedId={selectedId}
            addMode={addMode}
            signTypesById={isDotsMode ? {} : Object.fromEntries(signTypes.map((st) => [st.id, st]))}
            previewRotation={selectedId ? dpForm.rotation : null}
            onCanvasClick={handleCanvasClick}
            onSelectDecisionPoint={setSelectedId}
            onMoveDecisionPoint={handleMoveDecisionPoint}
          />

          <div className="mt-2 flex items-center gap-3">
            <label
              className={`text-sm text-ink/50 hover:text-ink ${
                planFileUpdating ? "cursor-wait" : "cursor-pointer"
              }`}
            >
              {planFileUpdating ? "Updating plan..." : "Update Plan"}
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleUpdatePlanFile}
                disabled={planFileUpdating}
                className="hidden"
              />
            </label>
            {planFileError && <span className="text-xs text-red-600">Update failed: {planFileError}</span>}
          </div>
        </div>

        <div className="space-y-4">
          {!selectedPoint && (
            <div className="border border-dashed border-black/15 rounded-lg p-6 text-center text-sm text-ink/40">
              {addMode
                ? `Click the plan to place a new ${isDotsMode ? "dot" : "sign"}.`
                : `Select a pin to view and edit its details, or click "${
                    isDotsMode ? "Add Dot Location" : "Add Sign Type"
                  }" to place a new one.`}
            </div>
          )}

          {selectedPoint && isDotsMode && (
            <form
              onSubmit={saveDecisionPointDetails}
              className="bg-white border border-black/10 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink/70 mb-1">Sign code</label>
                  <input
                    value={dpForm.sign_code}
                    onChange={(e) => setDpForm({ ...dpForm, sign_code: e.target.value })}
                    placeholder="e.g. Dot 1"
                    className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={deleteThisPoint}
                  className="text-xs text-red-600 hover:underline shrink-0 mt-5"
                >
                  Delete this dot
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Location</label>
                <input
                  value={dpForm.location}
                  onChange={(e) => setDpForm({ ...dpForm, location: e.target.value })}
                  placeholder="e.g. Corridor near Gate 12"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Comments</label>
                <textarea
                  value={dpForm.comments}
                  onChange={(e) => setDpForm({ ...dpForm, comments: e.target.value })}
                  rows={2}
                  placeholder="Any notes for this location"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              {dpSaveError && (
                <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">
                  Save failed: {dpSaveError}
                </p>
              )}
              {dpSaved && !dpSaveError && (
                <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs">
                  Saved.
                </p>
              )}

              <button
                type="submit"
                disabled={dpSaving}
                className="w-full bg-accent text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {dpSaving ? "Saving..." : "Save details"}
              </button>
            </form>
          )}

          {selectedPoint && !isDotsMode && (
            <form
              onSubmit={saveDecisionPointDetails}
              className="bg-white border border-black/10 rounded-lg p-4 space-y-3 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink/70 mb-1">Sign code</label>
                  <input
                    value={dpForm.sign_code}
                    onChange={(e) => setDpForm({ ...dpForm, sign_code: e.target.value })}
                    placeholder="e.g. Sign 1"
                    className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={deleteThisPoint}
                  className="text-xs text-red-600 hover:underline shrink-0 mt-5"
                >
                  Delete this sign
                </button>
              </div>

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
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Mounting</label>
                <input
                  value={dpForm.mounting}
                  onChange={(e) => setDpForm({ ...dpForm, mounting: e.target.value })}
                  placeholder="e.g. Wall-mounted, 2.1m AFF"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              {(() => {
                const selectedSignType = signTypes.find((st) => st.id === dpForm.sign_type_id);
                const activeSides = sidesForDesign(selectedSignType?.sign_design);
                return activeSides.map((side) => (
                  <div key={side}>
                    <label className="block text-xs font-medium text-ink/70 mb-1">
                      Messages - Side {side}
                    </label>
                    <div className="space-y-1.5">
                      {dpForm.message_slots[side].map((slot, i) => (
                        <div key={i} className="flex gap-1.5">
                          <input
                            value={slot.text}
                            onChange={(e) => updateMessageSlot(side, i, "text", e.target.value)}
                            placeholder={`Message ${i + 1}`}
                            className="flex-1 min-w-0 border border-black/15 rounded-md px-2 py-1 text-xs"
                          />
                          <select
                            value={slot.arrow}
                            onChange={(e) => updateMessageSlot(side, i, "arrow", e.target.value)}
                            className="w-20 shrink-0 border border-black/15 rounded-md px-1 py-1 text-xs bg-white"
                          >
                            {ARROW_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <PictogramPicker
                            pictograms={pictograms}
                            value={slot.pictogram_id}
                            onChange={(id) => updateMessageSlot(side, i, "pictogram_id", id)}
                          />
                        </div>
                      ))}
                    </div>
                    {side === activeSides[activeSides.length - 1] && (
                      <p className="text-xs text-ink/40 mt-1">
                        Each side's ten messages form one Messages cell in the export, each with its arrow
                        and pictogram. The number of sides shown here follows the selected sign type's
                        design. Manage the pictogram library on the{" "}
                        <a href="/pictograms" className="underline">Pictograms page</a>.
                      </p>
                    )}
                  </div>
                ));
              })()}

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Comments</label>
                <textarea
                  value={dpForm.comments}
                  onChange={(e) => setDpForm({ ...dpForm, comments: e.target.value })}
                  rows={2}
                  placeholder="Any notes for this sign"
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">
                  Sign type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={dpForm.sign_type_id}
                  onChange={(e) => setDpForm({ ...dpForm, sign_type_id: e.target.value })}
                  className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
                >
                  <option value="" disabled>
                    Select a sign type…
                  </option>
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
                <label className="block text-xs font-medium text-ink/70 mb-1 flex items-center justify-between">
                  <span>Marker rotation</span>
                  <span className="text-ink/40 font-normal">{dpForm.rotation}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={dpForm.rotation}
                  onChange={(e) => setDpForm({ ...dpForm, rotation: Number(e.target.value) })}
                  className="w-full"
                />
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Photo</label>
                  {selectedPointImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPointImageUrl}
                      alt="Sign location"
                      className="w-full max-h-32 object-cover rounded-md border border-black/10 mb-2"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "image_path")}
                    disabled={imageUploading}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Artwork</label>
                  {selectedPointArtworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPointArtworkUrl}
                      alt="Sign artwork"
                      className="w-full max-h-32 object-cover rounded-md border border-black/10 mb-2"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "artwork_path")}
                    disabled={imageUploading}
                    className="w-full text-xs"
                  />
                </div>
              </div>
              {imageUploading && <p className="text-xs text-ink/40">Uploading...</p>}

              {dpSaveError && (
                <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">
                  Save failed: {dpSaveError}
                </p>
              )}
              {dpSaved && !dpSaveError && (
                <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs">
                  Saved.
                </p>
              )}

              <button
                type="submit"
                disabled={dpSaving}
                className="w-full bg-accent text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {dpSaving ? "Saving..." : "Save details"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
