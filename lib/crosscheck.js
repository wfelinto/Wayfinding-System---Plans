/**
 * Crosscheck engine.
 *
 * Given the messages required at a decision point (as plain text, one
 * message per line) and the library of available sign types (the KOP),
 * decides which sign type fits.
 *
 * This is deliberately a plain, readable set of filters rather than a
 * scoring/ML approach: scoping decisions need to be explainable and
 * overridable by a human designer, not a black box.
 */

/**
 * Splits a decision point's raw "messages" text into individual message
 * lines, ignoring blank lines.
 * @param {string|null|undefined} messagesText
 * @returns {string[]}
 */
export function parseMessageLines(messagesText) {
  if (!messagesText) return [];
  return messagesText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string[]} messageLines - one string per message, already parsed
 * @param {boolean} needsPictogram
 * @param {Array<{id: string, name: string, max_messages: number, max_chars_per_line: number|null, supports_pictogram: boolean, mounting: string|null}>} signTypes
 * @returns {{status: 'auto'|'conflict', signType: object|null, reason: string|null}}
 */
export function crosscheckDecisionPoint(messageLines, needsPictogram, signTypes) {
  if (!messageLines || messageLines.length === 0) {
    return { status: "conflict", signType: null, reason: "No messages entered for this decision point yet." };
  }

  const messageCount = messageLines.length;
  const longestMessage = Math.max(...messageLines.map((line) => line.length));

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
