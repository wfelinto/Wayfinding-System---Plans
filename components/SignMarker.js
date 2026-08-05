"use client";

// One consistent visual language across the editor and PDF exports:
// - One Side Panel: a downward arrow above a baseline (a single flat panel, viewed in plan)
// - Two-Sided Structure: a bar with faces A (above) and B (below)
// - 4-Sided Structure: a solid block with faces A/B/C/D on each side
// Anything else (no sign type chosen, or a sign type with no design set)
// falls back to a plain circle, same as before this feature existed.
export default function SignMarker({ design, size = 26 }) {
  const stroke = "#1c2530";
  const fill = "#2f6f5e";

  if (design === "One Side Panel") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <line x1="12" y1="2" x2="12" y2="12" stroke={stroke} strokeWidth="2.4" />
        <polygon points="7,11 17,11 12,17" fill={stroke} />
        <line x1="4" y1="20" x2="20" y2="20" stroke={stroke} strokeWidth="2.4" />
      </svg>
    );
  }

  if (design === "Two-Sided Structure") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <line x1="2" y1="12" x2="22" y2="12" stroke={stroke} strokeWidth="2.4" />
        <text x="12" y="8" fontSize="8" fontWeight="700" textAnchor="middle" fill={stroke}>
          A
        </text>
        <text x="12" y="22" fontSize="8" fontWeight="700" textAnchor="middle" fill={stroke}>
          B
        </text>
      </svg>
    );
  }

  if (design === "4-Sided Structure") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="16" fill={fill} stroke={stroke} strokeWidth="1" />
        <text x="16" y="6" fontSize="7" fontWeight="700" textAnchor="middle" fill={stroke}>
          A
        </text>
        <text x="30" y="18.5" fontSize="7" fontWeight="700" textAnchor="middle" fill={stroke}>
          B
        </text>
        <text x="16" y="31" fontSize="7" fontWeight="700" textAnchor="middle" fill={stroke}>
          C
        </text>
        <text x="2" y="18.5" fontSize="7" fontWeight="700" textAnchor="middle" fill={stroke}>
          D
        </text>
      </svg>
    );
  }

  // Fallback: plain circle, for signs with no sign type chosen yet.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" fill="#ffffff" stroke={fill} strokeWidth="2.5" />
    </svg>
  );
}
