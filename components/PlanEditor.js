"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlanCanvas from "@/components/PlanCanvas";
import SignDetailPanel from "@/components/SignDetailPanel";
import { downloadDotPlanPdf, downloadMessageSchedulePdf } from "@/lib/pdfExport";
import { normalizeMessageSlots } from "@/lib/crosscheck";
import { renderPdfFirstPageToBlob } from "@/lib/pdfToImage";
import { normalizeImageToPngBlob } from "@/lib/normalizeImage";

function emptyForm() {
  return {
    sign_code: "",
    location: "",
    functional_area: "",
    mounting: "",
    comments: "",
    status: "Draft",
    sign_type_id: "",
    rotation: 0,
    message_slots: normalizeMessageSlots([]),
  };
}

/**
 * The Message Schedule Editor: the full sign workflow (messages, sign
 * type, KOP-driven fields). Supports editing up to two signs at once —
 * shift-click a second pin to open it side by side with the first.
 */
export default function PlanEditor({ planId }) {
  const [plan, setPlan] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [decisionPoints, setDecisionPoints] = useState([]);
  const [signTypes, setSignTypes] = useState([]);
  const [pictograms, setPictograms] = useState([]);
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [expandedTranslations, setExpandedTranslations] = useState({});

  const [addMode, setAddMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [formsById, setFormsById] = useState({});
  const [savingById, setSavingById] = useState({});
  const [saveErrorById, setSaveErrorById] = useState({});
  const [savedById, setSavedById] = useState({});
  const [imageUploadingById, setImageUploadingById] = useState({});

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
    const dp = await supabase
      .from("decision_points")
      .select("*")
      .eq("plan_id", planId)
      .order("sequence_order");
    setDecisionPoints(dp.data || []);
  }, [planId]);

  useEffect(() => {
    loadPlan();
    loadGeometry();
  }, [loadPlan, loadGeometry]);

  const loadKit = useCallback(async (projectId) => {
    if (!projectId) return;
    // Project-scoped entries, plus any legacy entries created before the
    // KOP/pictogram library became per-project.
    const [st, pic] = await Promise.all([
      supabase.from("sign_types").select("*").or(`project_id.eq.${projectId},project_id.is.null`).order("name"),
      supabase.from("pictograms").select("*").or(`project_id.eq.${projectId},project_id.is.null`).order("name"),
    ]);
    setSignTypes(st.data || []);
    setPictograms(
      (pic.data || []).map((p) => ({
        ...p,
        imageUrl: supabase.storage.from("pictograms").getPublicUrl(p.image_path).data.publicUrl,
      }))
    );
  }, []);

  useEffect(() => {
    if (plan?.project_id) loadKit(plan.project_id);
  }, [plan?.project_id, loadKit]);

  const loadGlossary = useCallback(async (projectId) => {
    if (!projectId) return;
    const { data } = await supabase
      .from("glossary_terms")
      .select("*")
      .eq("project_id", projectId)
      .order("external_id");
    setGlossaryTerms(data || []);
  }, []);

  useEffect(() => {
    if (plan?.project_id) loadGlossary(plan.project_id);
  }, [plan?.project_id, loadGlossary]);

  // Populates a form the first time a point is selected. Deliberately
  // does NOT re-sync on later decisionPoints reloads, so saving one
  // selected sign (which reloads the list) never clobbers unsaved edits
  // sitting in the other selected sign's panel.
  useEffect(() => {
    setFormsById((prev) => {
      let changed = false;
      const next = { ...prev };
      selectedIds.forEach((id) => {
        if (id in next) return;
        const dp = decisionPoints.find((p) => p.id === id);
        if (dp) {
          next[id] = {
            sign_code: dp.sign_code || "",
            location: dp.location || "",
            functional_area: dp.functional_area || "",
            mounting: dp.mounting || "",
            comments: dp.comments || "",
            status: dp.status || "Draft",
            sign_type_id: dp.sign_type_id || "",
            rotation: dp.rotation || 0,
            message_slots: normalizeMessageSlots(dp.message_slots),
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedIds, decisionPoints]);

  const visiblePoints = decisionPoints.filter((p) => p.point_type !== "dot");

  function handleSelectPoint(id, event) {
    const shift = !!event?.shiftKey;
    setSelectedIds((prev) => {
      if (!shift) return [id];
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length === 0) return [id];
      if (prev.length === 1) return [...prev, id];
      // Already have two selected — shift-clicking a third swaps in for
      // the second, keeping the most recently picked pair.
      return [prev[1], id];
    });
  }

  async function handleCanvasClick(xPct, yPct) {
    if (!addMode) return;
    const nextCode = `Sign ${visiblePoints.length + 1}`;

    const { data: inserted, error } = await supabase
      .from("decision_points")
      .insert({
        plan_id: planId,
        x: xPct,
        y: yPct,
        sequence_order: decisionPoints.length,
        sign_code: nextCode,
        point_type: "sign",
      })
      .select()
      .single();
    if (error) return;
    setSelectedIds([inserted.id]);
    loadGeometry();
  }

  async function handleMoveDecisionPoint(id, xPct, yPct) {
    await supabase.from("decision_points").update({ x: xPct, y: yPct }).eq("id", id);
    loadGeometry();
  }

  function updateForm(pointId, field, value) {
    setFormsById((prev) => ({ ...prev, [pointId]: { ...(prev[pointId] || emptyForm()), [field]: value } }));
  }

  function updateMessageSlot(pointId, side, index, field, value) {
    setFormsById((prev) => {
      const form = prev[pointId];
      if (!form) return prev;
      const sideSlots = form.message_slots[side].map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      );
      return { ...prev, [pointId]: { ...form, message_slots: { ...form.message_slots, [side]: sideSlots } } };
    });
  }

  // Called when a message text field loses focus: links it to a matching
  // glossary term if one exists (case-insensitive), or — per the "add a
  // term manually" requirement — creates a brand-new glossary entry on
  // the spot so it's immediately available in every other sign's dropdown.
  async function resolveGlossaryLink(pointId, side, index) {
    if (!plan?.project_id) return;
    const form = formsById[pointId];
    if (!form) return;
    const slot = form.message_slots[side][index];
    const text = (slot.text || "").trim();

    if (!text) {
      if (slot.glossary_id) updateMessageSlot(pointId, side, index, "glossary_id", "");
      return;
    }

    const match = glossaryTerms.find((t) => t.term_en.trim().toLowerCase() === text.toLowerCase());
    if (match) {
      if (slot.glossary_id !== match.id) updateMessageSlot(pointId, side, index, "glossary_id", match.id);
      return;
    }

    if (slot.glossary_id) {
      const linked = glossaryTerms.find((t) => t.id === slot.glossary_id);
      if (linked && linked.term_en.trim().toLowerCase() === text.toLowerCase()) return;
    }

    const nextExternalId = glossaryTerms.reduce((max, t) => Math.max(max, t.external_id || 0), 0) + 1;
    const { data, error } = await supabase
      .from("glossary_terms")
      .insert({ project_id: plan.project_id, external_id: nextExternalId, term_en: text })
      .select()
      .single();
    if (!error && data) {
      setGlossaryTerms((prev) => [...prev, data]);
      updateMessageSlot(pointId, side, index, "glossary_id", data.id);
    }
  }

  // Editing a translation edits the glossary term itself, so the change
  // propagates to every sign using that same term.
  async function updateGlossaryTranslation(glossaryId, field, value) {
    setGlossaryTerms((prev) => prev.map((t) => (t.id === glossaryId ? { ...t, [field]: value } : t)));
    await supabase.from("glossary_terms").update({ [field]: value || null }).eq("id", glossaryId);
  }

  function toggleTranslations(key) {
    setExpandedTranslations((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveDecisionPointDetails(pointId, e) {
    e.preventDefault();
    const form = formsById[pointId];
    if (!form) return;
    setSavingById((prev) => ({ ...prev, [pointId]: true }));
    setSaveErrorById((prev) => ({ ...prev, [pointId]: null }));
    setSavedById((prev) => ({ ...prev, [pointId]: false }));
    const payload = {
      sign_code: form.sign_code || null,
      location: form.location || null,
      functional_area: form.functional_area || null,
      mounting: form.mounting || null,
      comments: form.comments || null,
      status: form.status,
      sign_type_id: form.sign_type_id || null,
      rotation: form.rotation,
      message_slots: form.message_slots,
    };
    const { error } = await supabase.from("decision_points").update(payload).eq("id", pointId);
    setSavingById((prev) => ({ ...prev, [pointId]: false }));
    if (error) {
      setSaveErrorById((prev) => ({ ...prev, [pointId]: error.message }));
      return;
    }
    setSavedById((prev) => ({ ...prev, [pointId]: true }));
    loadGeometry();
  }

  async function handleFileUpload(pointId, e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadingById((prev) => ({ ...prev, [pointId]: true }));
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("dot-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      await supabase.from("decision_points").update({ [field]: filePath }).eq("id", pointId);
      loadGeometry();
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploadingById((prev) => ({ ...prev, [pointId]: false }));
    }
  }

  async function deleteThisPoint(pointId) {
    const confirmed = window.confirm("Delete this sign? This can't be undone.");
    if (!confirmed) return;
    await supabase.from("decision_points").delete().eq("id", pointId);
    setSelectedIds((prev) => prev.filter((id) => id !== pointId));
    loadGeometry();
  }

  async function clearAllSigns() {
    const confirmed = window.confirm(
      "This will permanently delete every sign on this plan (dot locations are unaffected). This can't be undone. Continue?"
    );
    if (!confirmed) return;
    await supabase.from("decision_points").delete().eq("plan_id", planId).neq("point_type", "dot");
    setSelectedIds([]);
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

  async function handleDownloadDotPlanPdf() {
    setPdfError(null);
    setPdfBusy("dotplan");
    try {
      const signTypesById = Object.fromEntries(signTypes.map((st) => [st.id, st]));
      await downloadDotPlanPdf(plan, imageUrl, decisionPoints, signTypesById);
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
      const glossaryTermsById = Object.fromEntries(glossaryTerms.map((t) => [t.id, t]));
      await downloadMessageSchedulePdf(plan, imageUrl, decisionPoints, signTypesById, pictogramsById, glossaryTermsById);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusy(null);
    }
  }

  function urlFor(path) {
    return path ? supabase.storage.from("dot-images").getPublicUrl(path).data.publicUrl : null;
  }

  const previewRotationById = Object.fromEntries(selectedIds.map((id) => [id, formsById[id]?.rotation]));
  const twoSelected = selectedIds.length === 2;

  if (!plan || !imageUrl) return <p className="text-ink/50">Loading plan...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <a href={`/projects/${plan.project_id}`} className="text-sm text-accent hover:underline">
            ← Back to project
          </a>
          <h1 className="text-2xl font-semibold text-ink mt-1">{plan.name} — Message Schedule Editor</h1>
          <a href={`/schedule/${planId}`} className="text-sm text-accent hover:underline">
            View sign schedule →
          </a>
        </div>

        <div className="flex flex-wrap gap-2 items-start">
          <button
            onClick={() => setAddMode((v) => !v)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
              addMode ? "bg-accent text-white border-accent" : "border-black/15 text-ink/70"
            }`}
          >
            Add Sign
          </button>
          <button
            onClick={clearAllSigns}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50"
          >
            Clear all
          </button>
          <span className="w-px bg-black/10 mx-1 self-stretch" />
          <button
            onClick={handleDownloadDotPlanPdf}
            disabled={pdfBusy !== null}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
          >
            {pdfBusy === "dotplan" ? "Preparing..." : "Download Dot Plan PDF"}
          </button>
          <button
            onClick={handleDownloadMessageSchedule}
            disabled={pdfBusy !== null}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 disabled:opacity-50"
          >
            {pdfBusy === "schedule" ? "Preparing..." : "Download Message Schedule PDF"}
          </button>
        </div>
      </div>

      {pdfError && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm mb-3">{pdfError}</p>
      )}

      <p className="text-sm text-ink/50 mb-3">
        {addMode && "Click the plan to place a new sign. Click an existing pin to select it instead."}
        {!addMode &&
          "Drag a pin to move it, click one to view and edit its details, or shift-click a second pin to edit two signs side by side."}
      </p>

      <div className={`grid gap-6 ${twoSelected ? "lg:grid-cols-[1fr_976px]" : "lg:grid-cols-[1fr_480px]"}`}>
        <div>
          <PlanCanvas
            imageUrl={imageUrl}
            decisionPoints={visiblePoints}
            selectedIds={selectedIds}
            addMode={addMode}
            signTypesById={Object.fromEntries(signTypes.map((st) => [st.id, st]))}
            previewRotationById={previewRotationById}
            onCanvasClick={handleCanvasClick}
            onSelectDecisionPoint={handleSelectPoint}
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

        <div className={twoSelected ? "grid grid-cols-2 gap-4" : "space-y-4"}>
          {selectedIds.length === 0 && (
            <div className="border border-dashed border-black/15 rounded-lg p-6 text-center text-sm text-ink/40">
              {addMode
                ? "Click the plan to place a new sign."
                : 'Select a pin to view and edit its details, or click "Add Sign" to place a new one.'}
            </div>
          )}

          {selectedIds.map((id) => {
            const point = decisionPoints.find((p) => p.id === id);
            const form = formsById[id];
            if (!point || !form) return null;
            return (
              <SignDetailPanel
                key={id}
                point={point}
                form={form}
                plan={plan}
                signTypes={signTypes}
                pictograms={pictograms}
                glossaryTerms={glossaryTerms}
                expandedTranslations={expandedTranslations}
                onToggleTranslations={toggleTranslations}
                onFieldChange={(field, value) => updateForm(id, field, value)}
                onUpdateMessageSlot={(side, i, field, value) => updateMessageSlot(id, side, i, field, value)}
                onResolveGlossaryLink={(side, i) => resolveGlossaryLink(id, side, i)}
                onUpdateGlossaryTranslation={updateGlossaryTranslation}
                onFileUpload={(e, field) => handleFileUpload(id, e, field)}
                onDelete={() => deleteThisPoint(id)}
                onSubmit={(e) => saveDecisionPointDetails(id, e)}
                saving={!!savingById[id]}
                saveError={saveErrorById[id]}
                saved={!!savedById[id]}
                imageUploading={!!imageUploadingById[id]}
                imageUrl={urlFor(point.image_path)}
                artworkUrl={urlFor(point.artwork_path)}
                compact={twoSelected}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
