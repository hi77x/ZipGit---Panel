import "server-only";
import type { ZipFile } from "yauzl";
import { isBinaryPath } from "@/lib/language";
import { scanText, severityRank, type SecretFinding, type SecretSeverity } from "@/lib/secret-rules";
import type { ImportFindingSummary, ImportScanSummary } from "@/shared/contracts/import";
import { isPotentialSecret } from "./path-policy";
import type { ZipImportEntry, ZipReader } from "./zip-reader";

export type ImportScanLimits = { maxFiles: number; maxFileBytes: number; maxBytes: number; maxFindings: number };

export type ImportScanResult = {
  findings: ImportFindingSummary[];
  blocking: ImportFindingSummary[];
  warnings: ImportFindingSummary[];
  summary: ImportScanSummary;
  highRiskUnscanned: string[];
};

const blockingSeverities = new Set<SecretSeverity>(["critical", "high"]);

export function toImportFinding(finding: SecretFinding): ImportFindingSummary {
  return {
    ruleId: finding.ruleId,
    name: finding.name,
    severity: finding.severity,
    path: finding.path,
    line: finding.line,
    masked: finding.masked,
    snippet: finding.snippet,
    remediation: finding.remediation
  };
}

export function assessFindings(findings: ImportFindingSummary[]): { blocking: ImportFindingSummary[]; warnings: ImportFindingSummary[] } {
  const blocking = findings.filter((finding) => blockingSeverities.has(finding.severity));
  const warnings = findings.filter((finding) => !blockingSeverities.has(finding.severity));
  return { blocking, warnings };
}

export function unscannableCredentialFindings(paths: string[]): ImportFindingSummary[] {
  return paths.map((path) => ({
    ruleId: "scan-budget",
    name: "Credential file could not be scanned",
    severity: "high" as const,
    path,
    line: 0,
    masked: "",
    snippet: "",
    remediation: "Remove the credential file from the archive or shrink it so RepoDeck can scan its contents before import."
  }));
}

export async function scanArchiveContents(reader: ZipReader, zip: ZipFile, entries: ZipImportEntry[], limits: ImportScanLimits): Promise<ImportScanResult> {
  const findings: ImportFindingSummary[] = [];
  const seen = new Set<string>();
  const highRiskUnscanned: string[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;
  let scannedBytes = 0;
  let truncated = false;
  let filesScannedThisRun = 0;

  for (const item of entries) {
    if (filesScannedThisRun >= limits.maxFiles || scannedBytes >= limits.maxBytes) {
      skippedFiles += 1;
      truncated = true;
      if (isPotentialSecret(item.path)) highRiskUnscanned.push(item.path);
      continue;
    }
    const size = item.entry.uncompressedSize;
    const highRisk = isPotentialSecret(item.path);
    const binaryByExtension = isBinaryPath(item.path);
    if ((binaryByExtension || size > limits.maxFileBytes) && !highRisk) {
      skippedFiles += 1;
      if (size > limits.maxFileBytes) truncated = true;
      continue;
    }
    if (size > limits.maxFileBytes) {
      highRiskUnscanned.push(item.path);
      skippedFiles += 1;
      truncated = true;
      continue;
    }
    if (scannedBytes + size > limits.maxBytes) {
      skippedFiles += 1;
      truncated = true;
      if (highRisk) highRiskUnscanned.push(item.path);
      continue;
    }
    let content: Buffer;
    try {
      content = await reader.readEntry(zip, item.entry);
    } catch {
      skippedFiles += 1;
      truncated = true;
      if (highRisk) highRiskUnscanned.push(item.path);
      continue;
    }
    filesScannedThisRun += 1;
    scannedBytes += content.byteLength;
    if (content.includes(0)) {
      skippedFiles += 1;
      if (highRisk) highRiskUnscanned.push(item.path);
      continue;
    }
    scannedFiles += 1;
    for (const finding of scanText(content.toString("utf8"), item.path)) {
      const key = `${finding.ruleId}|${finding.path}|${finding.line}|${finding.masked}`;
      if (seen.has(key)) continue;
      if (findings.length >= limits.maxFindings) {
        truncated = true;
        break;
      }
      seen.add(key);
      findings.push(toImportFinding(finding));
    }
  }

  findings.sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.path.localeCompare(right.path) || left.line - right.line);
  const combined = [...findings, ...unscannableCredentialFindings(highRiskUnscanned)];
  const assessed = assessFindings(combined);
  return {
    findings: combined,
    blocking: assessed.blocking,
    warnings: assessed.warnings,
    highRiskUnscanned,
    summary: { scannedFiles, skippedFiles, scannedBytes, truncated }
  };
}

export function scanTextContent(content: string, path: string): ImportFindingSummary[] {
  return scanText(content, path).map(toImportFinding);
}
