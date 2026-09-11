import { z } from "zod";
import type { AppErrorCode } from "./api-error";

export const importFieldsSchema = z.object({
  owner: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9-]+$/),
  ownerType: z.enum(["user", "organization"]),
  repositoryName: z.string().trim().min(1).max(100),
  description: z.string().max(350).default(""),
  visibility: z.enum(["private", "public"]),
  defaultBranch: z.string().trim().min(1).max(255).default("main"),
  commitMessage: z.string().trim().min(1).max(500).default("Import project via RepoDeck"),
  stripSingleRoot: z.enum(["true", "false"]).transform((value) => value === "true"),
  excludeGenerated: z.enum(["true", "false"]).transform((value) => value === "true")
});

export type ImportFields = z.infer<typeof importFieldsSchema>;

export const importStages = [
  "RECEIVED",
  "PREFLIGHTED",
  "AUTHORIZED",
  "REPOSITORY_CREATED",
  "BLOBS_WRITING",
  "TREE_CREATED",
  "COMMIT_CREATED",
  "REF_PUBLISHED",
  "DEFAULT_BRANCH_CONFIGURED",
  "COMPLETED",
  "COMPENSATING"
] as const;
export type ImportStage = (typeof importStages)[number];

export const importOutcomeStatuses = ["completed", "rejected", "failed", "compensated", "cleanup_incomplete"] as const;
export type ImportOutcomeStatus = (typeof importOutcomeStatuses)[number];

export type ImportFindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ImportFindingSummary = {
  ruleId: string;
  name: string;
  severity: ImportFindingSeverity;
  path: string;
  line: number;
  masked: string;
  snippet: string;
  remediation: string;
};

export type ImportScanSummary = {
  scannedFiles: number;
  skippedFiles: number;
  scannedBytes: number;
  truncated: boolean;
};

export type ImportCleanupSummary = {
  refDeleted: boolean;
  repositoryDeleted: boolean;
  repositoryRemainder: boolean;
};

export type ImportOutcome = {
  status: ImportOutcomeStatus;
  operationId: string;
  stage: ImportStage;
  errorCode: AppErrorCode | null;
  message: string;
  repository: { fullName: string; url: string; createdByThisOperation: boolean } | null;
  branch: string;
  commitSha: string | null;
  importedFileCount: number;
  excluded: Array<{ path: string; reason: string }>;
  emptyDirectoryCount: number;
  singleRootDetected: boolean;
  findings: ImportFindingSummary[];
  scan: ImportScanSummary;
  cleanup: ImportCleanupSummary;
  remediation: string | null;
};

export type ImportResult = ImportOutcome;
