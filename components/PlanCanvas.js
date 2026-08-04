"use client";

import { useRef } from "react";

/**
 * Renders the plan image with draggable sign pins.
 *
 * - When addMode is on, clicking empty plan area places a new sign.
 * - When addMode is off, dragging a pin moves that sign; a plain click
 *   (no drag) selects it instead.
 */
export default function PlanCanvas({
  imageUrl,
  decisionPoints,
  selectedId,
  addMode,
  onCanvasClick,
  onSelectDecisionPoint,
  onMoveDecisionPoint,
}) {
  const containerRef = useRef(null);
  const ignoreNextClick = useRef(false);

  function pctFromEvent(e) {
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, xPct)),
      y: Math.min(100, Math.max(0, yPct)),
    };
  }

  function handleContainerClick(e) {
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }
    if (!addMode) return;
    const { x, y } = pctFromEvent(e);
    onCanvasClick(x, y);
  }

  function handlePinPointerDown(e, point) {
    e.stopPropagation();
    ignoreNextClick.current = true;
    e.preventDefault();

    const DRAG_THRESHOLD_PX = 4;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let moved = false;
    let lastPos = { x: point.x, y: point.y };
    const pinEl = document.getElementById(`dp-pin-${point.id}`);

    function handlePointerMove(moveEvent) {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        // Still within the click "dead zone" — ignore jitter so a plain
        // click never gets misread as a drag that nudges the pin.
        return;
      }
      moved = true;
      const { x, y } = pctFromEvent(moveEvent);
      lastPos = { x, y };
      if (pinEl) {
        pinEl.style.left = `${x}%`;
        pinEl.style.top = `${y}%`;
      }
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (moved) {
        onMoveDecisionPoint(point.id, lastPos.x, lastPos.y);
      } else {
        onSelectDecisionPoint(point.id);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={`relative w-full border border-black/10 rounded-lg overflow-hidden bg-white select-none ${
        addMode ? "cursor-crosshair" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Floor plan" className="w-full h-auto block pointer-events-none" draggable={false} />

      {decisionPoints.map((p) => (
        <div
          key={p.id}
          id={`dp-pin-${p.id}`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
        >
          <button
            onPointerDown={(e) => handlePinPointerDown(e, p)}
            className={`w-4 h-4 rounded-full border-2 touch-none ${
              selectedId === p.id ? "bg-amber-400 border-amber-600" : "bg-white border-accent"
            }`}
            title={p.sign_code || "Sign"}
          />
          {p.sign_code && (
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1 text-[10px] leading-none bg-white/90 px-1 py-0.5 rounded whitespace-nowrap text-ink/70 pointer-events-none">
              {p.sign_code}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
