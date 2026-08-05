/**
 * Crosscheck engine.
 *
 * Messages are organized into up to four "sides" (A/B/C/D), each holding
 * up to ten { text, arrow, pictogram_id } slots. Which sides actually
 * apply depends on the sign's Sign Design:
 *   - One Side Panel: Side A only
 *   - Two-Sided Structure: Side A and Side B
 *   - 4-Sided Structure: Side A, B, C, and D
 *
 * The crosscheck engine treats each side as an independent message board
 * — a sign type only fits if every side that has content fits within its
 * capacity, since each side is physically a separate face of the sign.
 *
 * This is deliberately a plain, readable set of filters rather than a
 * scoring/ML approach: scoping decisions need to be explainable and
 * overridable by a human designer, not a black box.
 */

const MESSAGE_SLOT_COUNT = 10;
const ALL_SIDES = ["A", "B", "C", "D"];

function emptySideSlots() {
  return Array.from({ length: MESSAGE_SLOT_COUNT }, () => ({ text: "", arrow: "", pictogram_id: "" }));
}

/** Which message sides apply to a given Sign Design. */
export function sidesForDesign(design) {
  if (design === "Two-Sided Structure") return ["A", "B"];
  if (design === "4-Sided Structure") return ["A", "B", "C", "D"];
  return ["A"]; // One Side Panel, or no design chosen yet
}

/**
 * Always returns { A: [...10], B: [...10], C: [...10], D: [...10]},
 * regardless of which sides are currently relevant — this way switching
 * a sign's design never loses data already entered on a side that's
 * momentarily hidden. Also migrates the old flat-array format (from
 * before sides existed) into Side A automatically.
 */
export function normalizeMessageSlots(raw) {
  const base = { A: emptySideSlots(), B: emptySideSlots(), C: emptySideSlots(), D: emptySideSlots() };

  if (Array.isArray(raw)) {
    // Legacy format: a flat array of slots, from before sides existed.
    base.A = base.A.map((_, i) => ({
      text: raw[i]?.text || "",
      arrow: raw[i]?.arrow || "",
      pictogram_id: raw[i]?.pictogram_id || "",
    }));
    return base;
  }

  if (raw && typeof raw === "object") {
    for (const side of ALL_SIDES) {
      if (Array.isArray(raw[side])) {
        base[side] = base[side].map((_, i) => ({
          text: raw[side][i]?.text || "",
          arrow: raw[side][i]?.arrow || "",
          pictogram_id: raw[side][i]?.pictogram_id || "",
        }));
      }
    }
  }

  return base;
}

/** Non-empty messages for one side. */
export function nonEmptyMessagesForSide(messageSlots, side) {
  const normalized = normalizeMessageSlots(messageSlots);
  return (normalized[side] || []).filter((m) => m.text.trim().length > 0);
}

/**
 * Non-empty messages grouped by each side relevant to a given design,
 * e.g. [{ side: "A", messages: [...] }, { side: "B", messages: [...] }].
 */
export function nonEmptyMessagesForDesign(messageSlots, design) {
  return sidesForDesign(design).map((side) => ({
    side,
    messages: nonEmptyMessagesForSide(messageSlots, side),
  }));
}

/**
 * Renders one message + its arrow + its pictogram name as a single
 * display/export string: "message - arrow - pictogram". pictogramsById
 * is optional; without it, the pictogram name is simply omitted.
 */
export function formatMessageLine(message, pictogramsById = {}) {
  let out = message.text;
  if (message.arrow) out += ` ${message.arrow}`;
  const pictogram = message.pictogram_id ? pictogramsById[message.pictogram_id] : null;
  if (pictogram) out += ` [${pictogram.name}]`;
  return out;
}

/**
 * @param {Array<Array<{text: string, arrow: string, pictogram_id: string}>>} sides
 *   one array of non-empty messages per relevant side
 * @param {boolean} needsPictogram
 * @param {Array<{id: string, name: string, max_messages: number, max_chars_per_line: number|null, supports_pictogram: boolean, mounting: string|null}>} signTypes
 * @returns {{status: 'auto'|'conflict', signType: object|null, reason: string|null}}
 */
export function crosscheckDecisionPoint(sides, needsPictogram, signTypes) {
  const allMessages = sides.flat();
  if (allMessages.length === 0) {
    return { status: "conflict", signType: null, reason: "No messages entered for this decision point yet." };
  }

  // The busiest single side determines whether a sign type's per-side
  // capacity is exceeded — each side is an independent face of the sign.
  const messageCount = Math.max(0, ...sides.map((s) => s.length));
  const longestMessage = Math.max(0, ...allMessages.map((m) => (m.text || "").length));

  let candidates = signTypes.filter((st) => st.max_messages >= messageCount);
  if (candidates.length === 0) {
    return {
      status: "conflict",
      signType: null,
      reason: `No sign type holds ${messageCount} messages on one side. Longest available: ${Math.max(
        0,
        ...signTypes.map((st) => st.max_messages)
      )}. Consider splitting messages or adding a larger sign type to the KOP.`,
    };
  }

  candidates = candidates.filter(
    (st) => !st.max_chars_per_line || st.max_chars_per_line >= longestMessage
  );
  if (candidates.length === 0) {
    return {
      status: "conflict",
      signType: null,
      reason: `The longest message (${longestMessage} characters) exceeds every sign type's line length. Shorten the message or add a wider sign type.`,
    };
  }

  if (needsPictogram) {
    candidates = candidates.filter((st) => st.supports_pictogram);
    if (candidates.length === 0) {
      return {
        status: "conflict",
        signType: null,
        reason: "This decision point needs a pictogram, but no remaining sign type supports one.",
      };
    }
  }

  candidates.sort((a, b) => a.max_messages - b.max_messages);
  return { status: "auto", signType: candidates[0], reason: null };
}
