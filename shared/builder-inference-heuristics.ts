export type InferenceField = "role" | "tone" | "lengthPreference" | "format" | "constraints";

export const INFERENCE_FIELD_LABELS: Record<InferenceField, string> = {
  role: "Set AI persona",
  tone: "Adjust tone",
  lengthPreference: "Tune response length",
  format: "Choose output format",
  constraints: "Add guidance constraints",
};

export const INFERENCE_FIELD_CONFIDENCE: Record<InferenceField, number> = {
  role: 0.78,
  tone: 0.72,
  lengthPreference: 0.66,
  format: 0.7,
  constraints: 0.64,
};

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase();
}

export function chooseRole(prompt: string): string | null {
  const normalized = normalizePrompt(prompt);
  if (/(code|debug|refactor|typescript|javascript|react|python|api)\b/.test(normalized)) {
    return "Software Developer";
  }
  if (/(analy[sz]e|dashboard|metrics|kpi|sql|cohort|forecast)\b/.test(normalized)) {
    return "Data Analyst";
  }
  if (/(email|announcement|campaign|copy|headline|landing page)\b/.test(normalized)) {
    return "Expert Copywriter";
  }
  if (/(lesson|teach|syllabus|quiz|curriculum)\b/.test(normalized)) {
    return "Teacher";
  }
  return null;
}

export function chooseTone(prompt: string): string | null {
  const normalized = normalizePrompt(prompt);
  if (/(friendly|casual|informal|conversational)\b/.test(normalized)) return "Casual";
  if (/(technical|architecture|spec|implementation)\b/.test(normalized)) return "Technical";
  if (/(creative|story|brainstorm|campaign)\b/.test(normalized)) return "Creative";
  if (/(academic|citation|research)\b/.test(normalized)) return "Academic";
  if (/(executive|stakeholder|board|client)\b/.test(normalized)) return "Professional";
  return null;
}

export function chooseLengthPreference(prompt: string): "brief" | "detailed" | null {
  const normalized = normalizePrompt(prompt);
  if (/(brief|short|tl;dr|concise|summary)\b/.test(normalized)) return "brief";
  if (/(detailed|deep dive|comprehensive|thorough)\b/.test(normalized)) return "detailed";
  return null;
}

export function chooseFormat(prompt: string): string[] {
  const normalized = normalizePrompt(prompt);
  if (/(json)\b/.test(normalized)) return ["JSON"];
  if (/(table|tabular)\b/.test(normalized)) return ["Table"];
  if (/(bullet|bulleted|list|checklist|steps)\b/.test(normalized)) return ["Bullet points"];
  if (/(markdown)\b/.test(normalized)) return ["Markdown"];
  return [];
}

export function chooseConstraints(prompt: string): string[] {
  const normalized = normalizePrompt(prompt);
  const values: string[] = [];
  if (/(cite|citation|source)\b/.test(normalized)) values.push("Include citations");
  if (/(plain language|simple wording|no jargon)\b/.test(normalized)) values.push("Avoid jargon");
  return values;
}
