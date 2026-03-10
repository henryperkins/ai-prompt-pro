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

export interface TextEditMetrics {
  editDistance: number;
  editDistanceRatio: number;
  maxLength: number;
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

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, "\n");
}

export function calculateEditDistance(before: string, after: string): number {
  const left = normalizeText(before);
  const right = normalizeText(after);

  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  let previousRow = Array.from({ length: shorter.length + 1 }, (_, index) => index);

  for (let row = 1; row <= longer.length; row += 1) {
    const currentRow = [row];
    for (let column = 1; column <= shorter.length; column += 1) {
      const substitutionCost =
        longer[row - 1] === shorter[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        currentRow[column - 1] + 1,
        previousRow[column] + 1,
        previousRow[column - 1] + substitutionCost,
      );
    }
    previousRow = currentRow;
  }

  return previousRow[shorter.length] ?? 0;
}

export function buildTextEditMetrics(
  before: string,
  after: string,
): TextEditMetrics {
  const editDistance = calculateEditDistance(before, after);
  const maxLength = Math.max(normalizeText(before).length, normalizeText(after).length, 1);

  return {
    editDistance,
    editDistanceRatio: Number((editDistance / maxLength).toFixed(4)),
    maxLength,
  };
}
