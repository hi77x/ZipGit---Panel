import "server-only";
import { log } from "@/lib/logger";
import { AppError, type AppErrorCode } from "@/shared/contracts/api-error";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import type { ImportCleanupSummary, ImportFindingSummary, ImportOutcome, ImportOutcomeStatus, ImportScanSummary, ImportStage } from "@/shared/contracts/import";

export type RepositorySideEffect = { owner: string; name: string; fullName: string; url: string };
export type RefSideEffect = { ref: string; sha: string };

export type ImportOutcomeInput = {
  message: string;
  errorCode?: AppErrorCode | null;
  repository?: { fullName: string; url: string; createdByThisOperation: boolean } | null;
  branch: string;
  commitSha?: string | null;
  importedFileCount: number;
  excluded: Array<{ path: string; reason: string }>;
  emptyDirectoryCount: number;
  singleRootDetected: boolean;
  findings: ImportFindingSummary[];
  scan: ImportScanSummary;
  cleanup?: ImportCleanupSummary;
  remediation?: string | null;
};

export const emptyScanSummary: ImportScanSummary = { scannedFiles: 0, skippedFiles: 0, scannedBytes: 0, truncated: false };
export const noCleanupSummary: ImportCleanupSummary = { refDeleted: false, repositoryDeleted: false, repositoryRemainder: false };

export class ImportTransaction {
  private currentStage: ImportStage = "RECEIVED";
  private readonly timeline: Array<{ stage: ImportStage; at: string }> = [];
  private repository: RepositorySideEffect | null = null;
  private ref: RefSideEffect | null = null;

  constructor(readonly operationId: string) {}

  stage(stage: ImportStage, detail?: string): void {
    this.currentStage = stage;
    this.timeline.push({ stage, at: new Date().toISOString() });
    log("info", { service: "import", operationId: this.operationId, stage, detail });
  }

  note(level: "info" | "warn" | "error", fields: Record<string, string | number | boolean | null | undefined>): void {
    log(level, { service: "import", operationId: this.operationId, stage: this.currentStage, ...fields });
  }

  recordRepository(repository: RepositorySideEffect): void {
    this.repository = repository;
  }

  recordRef(ref: RefSideEffect): void {
    this.ref = ref;
  }

  get createdRepository(): RepositorySideEffect | null {
    return this.repository;
  }

  get createdRef(): RefSideEffect | null {
    return this.ref;
  }

  get stageName(): ImportStage {
    return this.currentStage;
  }

  get events(): ReadonlyArray<{ stage: ImportStage; at: string }> {
    return this.timeline;
  }

  build(status: ImportOutcomeStatus, input: ImportOutcomeInput): ImportOutcome {
    return {
      status,
      operationId: this.operationId,
      stage: this.currentStage,
      errorCode: input.errorCode ?? null,
      message: input.message,
      repository: input.repository ?? null,
      branch: input.branch,
      commitSha: input.commitSha ?? null,
      importedFileCount: input.importedFileCount,
      excluded: input.excluded,
      emptyDirectoryCount: input.emptyDirectoryCount,
      singleRootDetected: input.singleRootDetected,
      findings: input.findings,
      scan: input.scan,
      cleanup: input.cleanup ?? noCleanupSummary,
      remediation: input.remediation ?? null
    };
  }
}

export function describeImportError(error: unknown): { code: AppErrorCode | null; message: string; retryable: boolean } {
  if (error instanceof AppError) return { code: error.code, message: error.message, retryable: error.retryable };
  if (error instanceof GitHubApiError) {
    const mapped = mapGitHubError(error);
    return { code: mapped.code, message: mapped.message, retryable: mapped.retryable };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: null, message: "The import was cancelled because another step failed.", retryable: true };
  }
  return { code: null, message: "An unexpected error interrupted the import.", retryable: false };
}
