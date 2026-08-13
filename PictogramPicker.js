"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small thumbnail-based picker, standing in for a native <select> since
 * browsers don't render images inside <option> elements — there's no way
 * to show pictogram thumbnails with a plain dropdown.
 */
export default function PictogramPicker({ pictograms, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = pictograms.find((p) => p.id === value);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-7 border border-black/15 rounded-md bg-white flex items-center justify-center overflow-hidden"
        title={selected ? selected.name : "No pictogram"}
      >
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="text-[10px] text-ink/30">—</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 w-40 max-h-56 overflow-y-auto bg-white border border-black/10 rounded-md shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-black/5 text-ink/50"
          >
            No pictogram
          </button>
          {pictograms.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-ink/40">None added yet</p>
          )}
          {pictograms.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-black/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} className="w-5 h-5 object-contain shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
