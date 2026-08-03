"use client";

export default function PlanCanvas({
  imageUrl,
  decisionPoints,
  routeSegments,
  pois,
  selectedType,
  selectedId,
  onCanvasClick,
  onSelectDecisionPoint,
  onSelectPoi,
}) {
  function handleContainerClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onCanvasClick(xPct, yPct);
  }

  function pointById(id) {
    return decisionPoints.find((p) => p.id === id);
  }

  return (
    <div
      onClick={handleContainerClick}
      className="relative w-full border border-black/10 rounded-lg overflow-hidden bg-white cursor-crosshair select-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Floor plan" className="w-full h-auto block pointer-events-none" draggable={false} />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {routeSegments.map((seg) => {
          const from = pointById(seg.from_point);
          const to = pointById(seg.to_point);
          if (!from || !to) return null;
          return (
            <line
              key={seg.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#2f6f5e"
              strokeWidth="0.4"
            />
          );
        })}
      </svg>

      {decisionPoints.map((p) => (
        <button
          key={p.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectDecisionPoint(p.id);
          }}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 ${
            selectedType === "decision_point" && selectedId === p.id
              ? "bg-amber-400 border-amber-600"
              : "bg-white border-accent"
          }`}
          title={p.label || "Decision point"}
        />
      ))}

      {pois.map((poi) => (
        <button
          key={poi.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPoi(poi.id);
          }}
          style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-45 border-2 ${
            selectedType === "poi" && selectedId === poi.id
              ? "bg-amber-400 border-amber-600"
              : "bg-white border-slate-500"
          }`}
          title={poi.name}
        />
      ))}
    </div>
  );
}
