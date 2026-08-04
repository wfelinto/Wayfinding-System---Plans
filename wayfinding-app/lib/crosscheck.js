/**
 * Crosscheck engine.
 *
 * Given the messages required at a decision point (as up to ten
 * { text, arrow } slots) and the library of available sign types (the
 * KOP), decides which sign type fits.
 *
 * This is deliberately a plain, readable set of filters rather than a
 * scoring/ML approach: scoping decisions need to be explainable and
 * overridable by a human designer, not a black box.
 */

const MESSAGE_SLOT_COUNT = 10;

/** Always returns exactly ten { text, arrow } slots, filling in blanks. */
export function normalizeMessageSlots(slots) {
  const base = Array.from({ length: MESSAGE_SLOT_COUNT }, () => ({ text: "", arrow: "" }));
  if (!Array.isArray(slots)) return base;
  return base.map((_, i) => ({
    text: slots[i]?.text || "",
    arrow: slots[i]?.arrow || "",
  }));
}

/** The subset of slots that actually have message text entered. */
export function nonEmptyMessages(slots) {
  return normalizeMessageSlots(slots).filter((m) => m.text.trim().length > 0);
}

/** Renders one message + its arrow as a single display/export string. */
export function formatMessageLine(message) {
  return message.arrow ? `${message.text} ${message.arrow}` : message.text;
}

/**
 * @param {Array<{text: string, arrow: string}>} messages - non-empty slots only
 * @param {boolean} needsPictogram
 * @param {Array<{id: string, name: string, max_messages: number, max_chars_per_line: number|null, supports_pictogram: boolean, mounting: string|null}>} signTypes
 * @returns {{status: 'auto'|'conflict', signType: object|null, reason: string|null}}
 */
export function crosscheckDecisionPoint(messages, needsPictogram, signTypes) {
  if (!messages || messages.length === 0) {
    return { status: "conflict", signType: null, reason: "No messages entered for this decision point yet." };
  }

  const messageCount = messages.length;
  const longestMessage = Math.max(...messages.map((m) => (m.text || "").length));

  // Filter 1: capacity - does the sign type hold enough messages?
  let candidates = signTypes.filter((st) => st.max_messages >= messageCount);
  if (candidates.length === 0) {
    return {
      status: "conflict",
      signType: null,
      reason: `No sign type holds ${messageCount} messages. Longest available: ${Math.max(
        0,
        ...signTypes.map((st) => st.max_messages)
      )}. Consider splitting into two signs or adding a larger sign type to the KOP.`,
    };
  }

  // Filter 2: character length - will the longest message fit a line?
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

  // Filter 3: pictogram support
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

  // Best fit: smallest sign type that still satisfies every constraint,
  // so we don't over-spec a large sign where a small one would do.
  candidates.sort((a, b) => a.max_messages - b.max_messages);

  return { status: "auto", signType: candidates[0], reason: null };
}
