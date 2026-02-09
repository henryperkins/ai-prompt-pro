export type DiffLineType = "context" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  value: string;
}

export interface LineDiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
}

function splitLines(input: string): string[] {
  if (!input) return [];
  return input.replace(/\r\n/g, "\n").split("\n");
}

export function buildLineDiff(before: string, after: string): LineDiffResult {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const beforeLen = beforeLines.length;
  const afterLen = afterLines.length;

  const lcs: number[][] = Array.from({ length: beforeLen + 1 }, () =>
    Array.from({ length: afterLen + 1 }, () => 0)
  );

  for (let i = beforeLen - 1; i >= 0; i -= 1) {
    for (let j = afterLen - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;

  while (i < beforeLen && j < afterLen) {
    if (beforeLines[i] === afterLines[j]) {
      lines.push({ type: "context", value: beforeLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: "remove", value: beforeLines[i] });
      removed += 1;
      i += 1;
    } else {
      lines.push({ type: "add", value: afterLines[j] });
      added += 1;
      j += 1;
    }
  }

  while (i < beforeLen) {
    lines.push({ type: "remove", value: beforeLines[i] });
    removed += 1;
    i += 1;
  }

  while (j < afterLen) {
    lines.push({ type: "add", value: afterLines[j] });
    added += 1;
    j += 1;
  }

  return { lines, added, removed };
}
