function extractTextFromContentArray(value) {
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((entry) => extractTextValue(entry))
    .filter((entry) => typeof entry === "string" && entry.length > 0);
  if (parts.length === 0) return null;
  return parts.join("");
}

export function extractTextValue(value) {
  if (typeof value === "string" && value) return value;
  if (!value) return null;
  if (Array.isArray(value)) {
    return extractTextFromContentArray(value);
  }
  if (typeof value !== "object") return null;

  const source = value;
  return (
    (typeof source.text === "string" && source.text) ||
    extractTextFromContentArray(source.text) ||
    (typeof source.output_text === "string" && source.output_text) ||
    extractTextFromContentArray(source.output_text) ||
    (typeof source.content === "string" && source.content) ||
    extractTextFromContentArray(source.content) ||
    null
  );
}

export function extractItemText(item) {
  if (!item || typeof item !== "object") return "";
  const source = item;
  return (
    extractTextValue(source.text) ||
    extractTextValue(source.output_text) ||
    extractTextValue(source.content) ||
    extractTextValue(source.payload) ||
    ""
  );
}

export function extractItemDelta(item) {
  if (!item || typeof item !== "object") return "";
  const source = item;
  return (
    extractTextValue(source.delta) ||
    extractTextValue(source.payload?.delta) ||
    ""
  );
}

export function computeStreamTextUpdate(previousText, item) {
  const previous = typeof previousText === "string" ? previousText : "";
  const current = extractItemText(item);
  const explicitDelta = extractItemDelta(item);

  if (current && current.startsWith(previous)) {
    return {
      nextText: current,
      delta: current.slice(previous.length),
    };
  }

  if (current && current !== previous) {
    return {
      nextText: current,
      delta: current,
    };
  }

  if (explicitDelta) {
    if (previous.endsWith(explicitDelta)) {
      return {
        nextText: previous,
        delta: "",
      };
    }
    return {
      nextText: `${previous}${explicitDelta}`,
      delta: explicitDelta,
    };
  }

  return {
    nextText: current || previous,
    delta: "",
  };
}
