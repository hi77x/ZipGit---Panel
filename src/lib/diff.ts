export type DiffLineType = "add" | "del" | "ctx";
export type DiffLine = { type: DiffLineType; text: string; oldNumber: number | null; newNumber: number | null };
export type DiffHunk = { header: string; oldStart: number; oldCount: number; newStart: number; newCount: number; lines: DiffLine[] };
export type ParsedPatch = { hunks: DiffHunk[]; additions: number; deletions: number; binary: boolean };
export type FileChangeKind = "added" | "removed" | "modified" | "renamed";

const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parsePatch(patch: string | null | undefined): ParsedPatch {
  if (!patch) return { hunks: [], additions: 0, deletions: 0, binary: false };
  const lines = patch.split("\n");
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;
  let additions = 0;
  let deletions = 0;
  for (const raw of lines) {
    const match = hunkPattern.exec(raw);
    if (match) {
      oldNumber = Number(match[1]);
      newNumber = Number(match[3]);
      current = {
        header: raw,
        oldStart: oldNumber,
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: newNumber,
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: []
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("\\")) {
      current.lines.push({ type: "ctx", text: raw, oldNumber: null, newNumber: null });
      continue;
    }
    const marker = raw[0];
    const text = raw.slice(1);
    if (marker === "+") {
      current.lines.push({ type: "add", text, oldNumber: null, newNumber });
      newNumber += 1;
      additions += 1;
    } else if (marker === "-") {
      current.lines.push({ type: "del", text, oldNumber, newNumber: null });
      oldNumber += 1;
      deletions += 1;
    } else if (marker === " ") {
      current.lines.push({ type: "ctx", text, oldNumber, newNumber });
      oldNumber += 1;
      newNumber += 1;
    }
  }
  return { hunks, additions, deletions, binary: false };
}

export function patchStats(patch: string | null | undefined): { additions: number; deletions: number } {
  if (!patch) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

export function changeKind(status: string | null | undefined, additions: number, deletions: number): FileChangeKind {
  if (status === "added" || (additions > 0 && deletions === 0)) return "added";
  if (status === "removed" || (deletions > 0 && additions === 0)) return "removed";
  if (status === "renamed") return "renamed";
  return "modified";
}

export function isLargePatch(patch: string | null | undefined, threshold = 1200): boolean {
  if (!patch) return false;
  let lines = 1;
  for (let index = 0; index < patch.length; index += 1) {
    if (patch.charCodeAt(index) === 10) {
      lines += 1;
      if (lines > threshold) return true;
    }
  }
  return lines > threshold;
}

export function totalDiffStats(files: Array<{ additions?: number; deletions?: number }>): { additions: number; deletions: number } {
  return files.reduce<{ additions: number; deletions: number }>((total, file) => ({ additions: total.additions + (file.additions ?? 0), deletions: total.deletions + (file.deletions ?? 0) }), { additions: 0, deletions: 0 });
}

export function patchToPlainText(patch: string | null | undefined): string {
  if (!patch) return "";
  return patch.split("\n").filter((line) => !hunkPattern.test(line) && !line.startsWith("\\")).join("\n");
}
