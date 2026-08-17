"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "ES", label: "Spanish" },
  { value: "FR", label: "French" },
  { value: "PT", label: "Portuguese-BR" },
];

const ORIENTATION_OPTIONS = ["Landscape", "Portrait"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];
const APPROVAL_OPTIONS = ["In Progress", "Approved", "Rejected"];

const APPROVAL_COLORS = {
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

const PRIORITY_COLORS = {
  LOW: "bg-black/5 text-ink/60 border-black/10",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
};

const emptyForm = {
  requester_name: "",
  venue_id: "",
  operations_start_date: "",
  sign_type_id: "",
  message: "",
  languages: [],
  orientation: "",
  priority: "",
  quantity_of_designs: "",
  quantity_per_design: "",
  comments: "",
  approval_status: "In Progress",
};

export default function FaRequestsPage({ params }) {
  const { faProjectId } = params;
  const [project, setProject] = useState(null);
  const [venues, setVenues] = useState([]);
  const [signTypes, setSignTypes] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [areaFilter, setAreaFilter] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [
      { data: projectData },
      { data: venueData },
      { data: signTypeData },
      { data: faData },
      { data: requestData, error },
    ] = await Promise.all([
      supabase.from("fa_projects").select("*").eq("id", faProjectId).single(),
      supabase.from("fa_venues").select("*").eq("fa_project_id", faProjectId).order("acronym"),
      supabase.from("fa_sign_types").select("*").eq("fa_project_id", faProjectId).order("name"),
      supabase.from("fa_functional_areas").select("*").eq("fa_project_id", faProjectId).order("name"),
      supabase
        .from("fa_requests")
        .select("*")
        .eq("fa_project_id", faProjectId)
        .order("created_at", { ascending: false }),
    ]);
    setProject(projectData);
    setVenues(venueData || []);
    setSignTypes(signTypeData || []);
    setFunctionalAreas(faData || []);
    if (error) setError(error.message);
    else setRequests(requestData || []);
    setLoading(false);
  }

  const selectedSignType = signTypes.find((st) => st.id === form.sign_type_id);
  const liveTotalQuantity = (Number(form.quantity_of_designs) || 0) * (Number(form.quantity_per_design) || 0);
  const liveTotalPrice =
    selectedSignType?.unit_cost != null ? Number(selectedSignType.unit_cost) * liveTotalQuantity : null;

  function venueRow(venueId) {
    return venues.find((v) => v.id === venueId) || null;
  }

  function functionalAreaForVenue(venueId) {
    const venue = venueRow(venueId);
    if (!venue) return null;
    return functionalAreas.find((f) => f.id === venue.functional_area_id) || null;
  }

  const filteredRequests = areaFilter
    ? requests.filter((r) => functionalAreaForVenue(r.venue_id)?.name === areaFilter)
    : requests;

  function toggleLanguage(value) {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(value)
        ? prev.languages.filter((l) => l !== value)
        : [...prev.languages, value],
    }));
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      requester_name: r.requester_name || "",
      venue_id: r.venue_id || "",
      operations_start_date: r.operations_start_date || "",
      sign_type_id: r.sign_type_id || "",
      message: r.message || "",
      languages: Array.isArray(r.languages) ? r.languages : [],
      orientation: r.orientation || "",
      priority: r.priority || "",
      quantity_of_designs: r.quantity_of_designs || "",
      quantity_per_design: r.quantity_per_design || "",
      comments: r.comments || "",
      approval_status: r.approval_status || "In Progress",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const totalQuantity = (Number(form.quantity_of_designs) || 0) * (Number(form.quantity_per_design) || 0);
    const totalPrice = selectedSignType?.unit_cost != null ? Number(selectedSignType.unit_cost) * totalQuantity : null;

    const payload = {
      requester_name: form.requester_name || null,
      venue_id: form.venue_id || null,
      operations_start_date: form.operations_start_date || null,
      sign_type_id: form.sign_type_id || null,
      message: form.message || null,
      languages: form.languages,
      orientation: form.orientation || null,
      priority: form.priority || null,
      quantity_of_designs: form.quantity_of_designs || null,
      quantity_per_design: form.quantity_per_design || null,
      total_quantity: totalQuantity,
      total_price: totalPrice,
      comments: form.comments || null,
      approval_status: form.approval_status,
    };

    const { error } = editingId
      ? await supabase.from("fa_requests").update(payload).eq("id", editingId)
      : await supabase.from("fa_requests").insert({ ...payload, fa_project_id: faProjectId });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this sign request? This can't be undone.");
    if (!confirmed) return;
    if (editingId === id) cancelEdit();
    await supabase.from("fa_requests").delete().eq("id", id);
    load();
  }

  function signTypeLabel(signTypeId) {
    const st = signTypes.find((st) => st.id === signTypeId);
    return st ? st.name : "—";
  }

  function handleDownloadExcel() {
    const headers = [
      "Request #",
      "Order date",
      "Requester",
      "Venue - Functional Area",
      "Ops start",
      "Sign type",
      "Message",
      "Languages",
      "Orientation",
      "Priority",
      "Qty of designs",
      "Qty per design",
      "Total quantity",
      "Total price",
      "City",
      "Address",
      "Delivery point",
      "Focal point",
      "Focal point e-mail",
      "Focal point phone",
      "Comments",
      "Approval status",
    ];

    const rows = filteredRequests.map((r) => {
      const venue = venueRow(r.venue_id);
      const fa = functionalAreaForVenue(r.venue_id);
      return [
        r.request_number ?? "",
        r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
        r.requester_name || "",
        venue ? `${venue.acronym}${fa ? ` — ${fa.name}` : ""}` : "",
        r.operations_start_date || "",
        signTypeLabel(r.sign_type_id),
        r.message || "",
        Array.isArray(r.languages) ? r.languages.join(", ") : "",
        r.orientation || "",
        r.priority || "",
        r.quantity_of_designs || "",
        r.quantity_per_design || "",
        r.total_quantity ?? "",
        r.total_price ?? "",
        venue?.city || "",
        venue?.address || "",
        venue?.delivery_point || "",
        venue?.focal_point || "",
        venue?.focal_point_email || "",
        venue?.focal_point_phone || "",
        r.comments || "",
        r.approval_status || "",
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = headers.map(() => ({ wch: 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `${project?.name || "FA Signage"} - schedule.xlsx`);
  }

  return (
    <div>
      <a href={`/fa-projects/${faProjectId}`} className="text-sm text-accent hover:underline">
        ← Back to {project?.name || "project"}
      </a>
      <h1 className="text-2xl font-semibold text-ink mt-2 mb-1">Sign requests</h1>
      <p className="text-ink/60 mb-6">Request Functional Area signage and track it through approval.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-lg p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-ink">{editingId ? "Edit request" : "New sign request"}</h2>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="text-xs text-ink/50 hover:text-ink">
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Requester name</label>
            <input
              value={form.requester_name}
              onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Venue - Functional Area</label>
            <select
              value={form.venue_id}
              onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Select a venue…</option>
              {venues.map((v) => {
                const fa = functionalAreas.find((f) => f.id === v.functional_area_id);
                return (
                  <option key={v.id} value={v.id}>
                    {v.acronym}
                    {fa ? ` — ${fa.name}` : ""}
                  </option>
                );
              })}
            </select>
            {venues.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No venues yet — add some on the{" "}
                <a href={`/fa-projects/${faProjectId}/venues`} className="underline">
                  FA info per Venue page
                </a>
                .
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Operations start date</label>
            <input
              type="date"
              value={form.operations_start_date}
              onChange={(e) => setForm({ ...form, operations_start_date: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Sign type</label>
            <select
              value={form.sign_type_id}
              onChange={(e) => setForm({ ...form, sign_type_id: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Select a sign type…</option>
              {signTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            {signTypes.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No sign types yet — add some on the{" "}
                <a href={`/fa-projects/${faProjectId}/kop`} className="underline">
                  KoP page
                </a>
                .
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Orientation</label>
            <select
              value={form.orientation}
              onChange={(e) => setForm({ ...form, orientation: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Select…</option>
              {ORIENTATION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Select…</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Quantity of designs</label>
            <input
              value={form.quantity_of_designs}
              onChange={(e) => setForm({ ...form, quantity_of_designs: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Quantity per design</label>
            <input
              value={form.quantity_per_design}
              onChange={(e) => setForm({ ...form, quantity_per_design: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-ink/70 mb-1">Message</label>
            <input
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Total quantity / price</label>
            <input
              readOnly
              value={`${liveTotalQuantity} ${liveTotalPrice != null ? `· $${liveTotalPrice.toFixed(2)}` : ""}`}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-black/5 text-ink/70"
            />
            <p className="text-xs text-ink/40 mt-1">Designs × per-design quantity, priced at the sign type's rate.</p>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-ink/70 mb-1">Languages</label>
            <div className="flex flex-wrap gap-4">
              {LANGUAGE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink/80">
                  <input
                    type="checkbox"
                    checked={form.languages.includes(opt.value)}
                    onChange={() => toggleLanguage(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 mb-1">Approval status</label>
            <select
              value={form.approval_status}
              onChange={(e) => setForm({ ...form, approval_status: e.target.value })}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm bg-white"
            >
              {APPROVAL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-ink/70 mb-1">Comments</label>
            <textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              rows={2}
              className="w-full border border-black/15 rounded-md px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-2 text-xs mt-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 bg-accent text-white px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : editingId ? "Save changes" : "Submit request"}
        </button>
      </form>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-medium text-ink">Schedule</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadExcel}
            disabled={filteredRequests.length === 0}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-black/15 text-ink/70 hover:bg-black/5 disabled:opacity-40"
          >
            Download Excel
          </button>
          <label className="text-xs text-ink/60">Filter by functional area</label>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="border border-black/15 rounded-md px-2 py-1 text-sm bg-white"
          >
            <option value="">All</option>
            {functionalAreas.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-ink/50">Loading...</p>}
      {!loading && filteredRequests.length === 0 && (
        <div className="border border-dashed border-black/15 rounded-lg p-10 text-center text-ink/50">
          No requests yet.
        </div>
      )}

      {!loading && filteredRequests.length > 0 && (
        <div className="bg-white border border-black/10 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-ink/60 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Request #</th>
                <th className="px-3 py-2 font-medium">Order date</th>
                <th className="px-3 py-2 font-medium">Requester</th>
                <th className="px-3 py-2 font-medium">Venue - Functional Area</th>
                <th className="px-3 py-2 font-medium">Ops start</th>
                <th className="px-3 py-2 font-medium">Sign type</th>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Languages</th>
                <th className="px-3 py-2 font-medium">Orientation</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Qty of designs</th>
                <th className="px-3 py-2 font-medium">Qty per design</th>
                <th className="px-3 py-2 font-medium">Total quantity</th>
                <th className="px-3 py-2 font-medium">Total price</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Delivery point</th>
                <th className="px-3 py-2 font-medium">Focal point</th>
                <th className="px-3 py-2 font-medium">Focal point e-mail</th>
                <th className="px-3 py-2 font-medium">Focal point phone</th>
                <th className="px-3 py-2 font-medium">Comments</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => {
                const venue = venueRow(r.venue_id);
                const fa = functionalAreaForVenue(r.venue_id);
                return (
                  <tr key={r.id} className="border-t border-black/10 align-top">
                    <td className="px-3 py-3 text-ink/80 font-medium whitespace-nowrap">
                      #{r.request_number ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/80 whitespace-nowrap">{r.requester_name || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">
                      {venue ? `${venue.acronym}${fa ? ` — ${fa.name}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{r.operations_start_date || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{signTypeLabel(r.sign_type_id)}</td>
                    <td className="px-3 py-3 text-ink/70">{r.message || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">
                      {Array.isArray(r.languages) && r.languages.length ? r.languages.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{r.orientation || "—"}</td>
                    <td className="px-3 py-3">
                      {r.priority ? (
                        <span
                          className={`inline-block border rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                            PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.LOW
                          }`}
                        >
                          {r.priority}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink/70">{r.quantity_of_designs || "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{r.quantity_per_design || "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{r.total_quantity ?? "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">
                      {r.total_price != null ? `$${Number(r.total_price).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{venue?.city || "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{venue?.address || "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{venue?.delivery_point || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{venue?.focal_point || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{venue?.focal_point_email || "—"}</td>
                    <td className="px-3 py-3 text-ink/70 whitespace-nowrap">{venue?.focal_point_phone || "—"}</td>
                    <td className="px-3 py-3 text-ink/70">{r.comments || "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block border rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                          APPROVAL_COLORS[r.approval_status] || APPROVAL_COLORS["In Progress"]
                        }`}
                      >
                        {r.approval_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button onClick={() => startEdit(r)} className="text-accent hover:underline text-xs mr-2">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
