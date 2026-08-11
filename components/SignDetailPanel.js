"use client";

import { sidesForDesign } from "@/lib/crosscheck";
import { ARROW_OPTIONS } from "@/lib/arrows";
import PictogramPicker from "@/components/PictogramPicker";

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
 * The full sign editing form for one decision point. Extracted from the
 * editor so it can be rendered twice, side by side, when two signs are
 * selected at once (shift-click) — each instance is fully independent.
 */
export default function SignDetailPanel({
  point,
  form,
  plan,
  signTypes,
  pictograms,
  glossaryTerms,
  expandedTranslations,
  onToggleTranslations,
  onFieldChange,
  onUpdateMessageSlot,
  onResolveGlossaryLink,
  onUpdateGlossaryTranslation,
  onFileUpload,
  onDelete,
  onSubmit,
  saving,
  saveError,
  saved,
  imageUploading,
  imageUrl,
  artworkUrl,
  compact,
}) {
  const selectedSignType = signTypes.find((st) => st.id === form.sign_type_id);
  const activeSides = sidesForDesign(selectedSignType?.sign_design);

  return (
    <form
      onSubmit={onSubmit}
      className={`bg-white border border-black/10 rounded-lg p-4 space-y-3 overflow-y-auto ${
        compact ? "max-h-[85vh]" : "max-h-[80vh]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-ink/70 mb-1">Sign code</label>
          <input
            value={form.sign_code}
            onChange={(e) => onFieldChange("sign_code", e.target.value)}
            placeholder="e.g. Sign 1"
            className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm font-medium"
          />
        </div>
        <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline shrink-0 mt-5">
          Delete this sign
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1 flex items-center justify-between">
          <span>Marker rotation</span>
          <span className="text-ink/40 font-normal">{form.rotation}°</span>
        </label>
        <input
          type="range"
          min="0"
          max="359"
          value={form.rotation}
          onChange={(e) => onFieldChange("rotation", Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1">Location</label>
        <input
          value={form.location}
          onChange={(e) => onFieldChange("location", e.target.value)}
          placeholder="e.g. Corridor ceiling above Gate 12"
          className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1">Functional area</label>
        <input
          value={form.functional_area}
          onChange={(e) => onFieldChange("functional_area", e.target.value)}
          placeholder="e.g. Parking, Retail"
          className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1">Mounting</label>
        <input
          value={form.mounting}
          onChange={(e) => onFieldChange("mounting", e.target.value)}
          placeholder="e.g. Wall-mounted, 2.1m AFF"
          className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      {activeSides.map((side) => (
        <div key={side}>
          <label className="block text-xs font-medium text-ink/70 mb-1">Messages - Side {side}</label>
          <div className="space-y-1.5">
            {form.message_slots[side].map((slot, i) => {
              const rowKey = `${point.id}-${side}-${i}`;
              const linkedTerm = slot.glossary_id ? glossaryTerms.find((t) => t.id === slot.glossary_id) : null;
              return (
                <div key={i}>
                  <div className="flex gap-1.5">
                    <input
                      list={`glossary-${rowKey}`}
                      value={slot.text}
                      onChange={(e) => onUpdateMessageSlot(side, i, "text", e.target.value)}
                      onBlur={() => onResolveGlossaryLink(side, i)}
                      placeholder={`Message ${i + 1}`}
                      title={slot.text}
                      className="flex-1 min-w-0 border border-black/15 rounded-md px-2 py-1 text-xs truncate"
                    />
                    <datalist id={`glossary-${rowKey}`}>
                      {glossaryTerms.map((t) => (
                        <option key={t.id} value={t.term_en} />
                      ))}
                    </datalist>
                    <select
                      value={slot.arrow}
                      onChange={(e) => onUpdateMessageSlot(side, i, "arrow", e.target.value)}
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
                      onChange={(id) => onUpdateMessageSlot(side, i, "pictogram_id", id)}
                    />
                    {linkedTerm && (
                      <button
                        type="button"
                        onClick={() => onToggleTranslations(rowKey)}
                        title="Translations"
                        className={`text-[10px] px-1.5 rounded border shrink-0 ${
                          expandedTranslations[rowKey]
                            ? "bg-accent text-white border-accent"
                            : "border-black/15 text-ink/50 hover:text-ink"
                        }`}
                      >
                        ES/FR/PT
                      </button>
                    )}
                  </div>
                  {linkedTerm && expandedTranslations[rowKey] && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1 pl-1">
                      <input
                        value={linkedTerm.term_es || ""}
                        onChange={(e) => onUpdateGlossaryTranslation(linkedTerm.id, "term_es", e.target.value)}
                        placeholder="ES"
                        className="border border-black/15 rounded-md px-2 py-1 text-[11px]"
                      />
                      <input
                        value={linkedTerm.term_fr || ""}
                        onChange={(e) => onUpdateGlossaryTranslation(linkedTerm.id, "term_fr", e.target.value)}
                        placeholder="FR"
                        className="border border-black/15 rounded-md px-2 py-1 text-[11px]"
                      />
                      <input
                        value={linkedTerm.term_pt || ""}
                        onChange={(e) => onUpdateGlossaryTranslation(linkedTerm.id, "term_pt", e.target.value)}
                        placeholder="PT"
                        className="border border-black/15 rounded-md px-2 py-1 text-[11px]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {side === activeSides[activeSides.length - 1] && (
            <p className="text-xs text-ink/40 mt-1">
              Type to search the glossary, or type a new term — it&apos;s added automatically. Click
              &quot;ES/FR/PT&quot; on a linked message to add translations, which update everywhere that
              term is used. Manage pictograms on the{" "}
              <a href={`/projects/${plan.project_id}/pictograms`} className="underline">
                Pictograms page
              </a>
              .
            </p>
          )}
        </div>
      ))}

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1">Comments</label>
        <textarea
          value={form.comments}
          onChange={(e) => onFieldChange("comments", e.target.value)}
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
          value={form.sign_type_id}
          onChange={(e) => onFieldChange("sign_type_id", e.target.value)}
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
            No sign types yet — add some on the{" "}
            <a href={`/projects/${plan.project_id}/kop`} className="underline">
              KOP page
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-ink/70 mb-1">Status</label>
        <select
          value={form.status}
          onChange={(e) => onFieldChange("status", e.target.value)}
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
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Sign location"
              className="w-full max-h-32 object-cover rounded-md border border-black/10 mb-2"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileUpload(e, "image_path")}
            disabled={imageUploading}
            className="w-full text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70 mb-1">Artwork</label>
          {artworkUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artworkUrl}
              alt="Sign artwork"
              className="w-full max-h-32 object-cover rounded-md border border-black/10 mb-2"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileUpload(e, "artwork_path")}
            disabled={imageUploading}
            className="w-full text-xs"
          />
        </div>
      </div>
      {imageUploading && <p className="text-xs text-ink/40">Uploading...</p>}

      {saveError && (
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs">
          Save failed: {saveError}
        </p>
      )}
      {saved && !saveError && (
        <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs">Saved.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save details"}
      </button>
    </form>
  );
}
