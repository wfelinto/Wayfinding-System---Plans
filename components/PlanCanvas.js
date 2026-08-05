"use client";

import { useRef, useState } from "react";
import SignMarker from "./SignMarker";

const ZOOM_MIN = 50;
const ZOOM_MAX = 300;
const ZOOM_STEP = 25;

/**
 * Renders the plan image with draggable sign pins and zoom controls.
 *
 * - When addMode is on, clicking empty plan area places a new sign.
 * - When addMode is off, dragging a pin moves that sign; a plain click
 *   (no drag) selects it instead.
 * - Zoom widens the inner content and lets the outer box scroll to it;
 *   click math is unaffected since it reads the actual on-screen box
 *   size and position via getBoundingClientRect, which already reflects
 *   both the current zoom and scroll offset.
 */
export default function PlanCanvas({
  imageUrl,
  decisionPoints,
  selectedId,
  addMode,
  signTypesById,
  onCanvasClick,
  onSelectDecisionPoint,
  onMoveDecisionPoint,
}) {
  const containerRef = useRef(null);
  const ignoreNextClick = useRef(false);
  const [zoom, setZoom] = useState(100);
  const [highContrast, setHighContrast] = useState(false);

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
    <div className="relative w-full border border-black/10 rounded-lg overflow-hidden bg-white">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/95 border border-black/10 rounded-md shadow-sm px-1 py-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          className="w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink text-sm font-medium rounded hover:bg-black/5"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(100)}
          className="text-xs text-ink/60 hover:text-ink px-1 min-w-[3rem] text-center"
          title="Reset zoom"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          className="w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink text-sm font-medium rounded hover:bg-black/5"
          title="Zoom in"
        >
          +
        </button>
        <span className="w-px h-5 bg-black/10 mx-0.5" />
        <button
          type="button"
          onClick={() => setHighContrast((v) => !v)}
          className={`px-2 h-6 flex items-center justify-center text-xs font-medium rounded ${
            highContrast ? "bg-accent text-white" : "text-ink/70 hover:text-ink hover:bg-black/5"
          }`}
          title="Gray out the plan to make sign dots stand out"
        >
          Contrast
        </button>
      </div>

      <div className="overflow-auto" style={{ maxHeight: "75vh" }}>
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          style={{ width: `${zoom}%` }}
          className={`relative select-none ${addMode ? "cursor-crosshair" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Floor plan"
            className="w-full h-auto block pointer-events-none transition-[filter] duration-150"
            style={highContrast ? { filter: "grayscale(1) brightness(1.5) contrast(0.85)" } : undefined}
            draggable={false}
          />

          {decisionPoints.map((p) => {
            const design = signTypesById?.[p.sign_type_id]?.sign_design;
            return (
              <div
                key={p.id}
                id={`dp-pin-${p.id}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
              >
                <button
                  onPointerDown={(e) => handlePinPointerDown(e, p)}
                  className={`touch-none flex items-center justify-center rounded-full ${
                    selectedId === p.id ? "ring-2 ring-amber-500 bg-amber-50/70" : ""
                  }`}
                  style={{ transform: `rotate(${p.rotation || 0}deg)` }}
                  title={p.sign_code || "Sign"}
                >
                  <SignMarker design={design} />
                </button>
                {p.sign_code && (
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1 text-[10px] leading-none bg-white/90 px-1 py-0.5 rounded whitespace-nowrap text-ink/70 pointer-events-none">
                    {p.sign_code}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
