import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError } from "@/server/github/errors";
import { AppError } from "@/shared/contracts/api-error";
import type { ImportFields, ImportOutcome, ImportScanSummary } from "@/shared/contracts/import";
import { isSafeGitHubRef, encodeGitHubSegment } from "@/lib/url";
import { RepositoryService, validateRepositoryName } from "@/server/services/repository-service";
import { ZipReader, type ZipPreflight } from "./zip-reader";
import { GitObjectWriter } from "./git-object-writer";
import { importLimits, repositoryCleanupEnabled } from "./constants";
import { scanArchiveContents, type ImportScanResult } from "./secret-preflight";
import { describeImportError, ImportTransaction } from "./import-transaction";

const createdRepoSchema = z.object({ full_name: z.string(), html_url: z.url(), name: z.string(), owner: z.object({ login: z.string() }) });

type OutcomeBase = {
  branch: string;
  importedFileCount: number;
  excluded: Array<{ path: string; reason: string }>;
  emptyDirectoryCount: number;
  singleRootDetected: boolean;
  findings: ImportScanResult["findings"];
  scan: ImportScanSummary;
};

export class ImportService {
  private readonly reader = new ZipReader();
  private readonly repositories: RepositoryService;
  private readonly writer: GitObjectWriter;
  private readonly cleanupEnabled: boolean;

  constructor(private readonly github: GitHubClient, options: { cleanupEnabled?: boolean } = {}) {
    this.repositories = new RepositoryService(github);
    this.writer = new GitObjectWriter(github, this.reader);
    this.cleanupEnabled = options.cleanupEnabled ?? repositoryCleanupEnabled();
  }

  async execute(filePath: string, fields: ImportFields): Promise<ImportOutcome> {
    const operationId = randomUUID();
    const transaction = new ImportTransaction(operationId);
    const repositoryName = validateRepositoryName(fields.repositoryName);
    if (!isSafeGitHubRef(fields.defaultBranch)) throw new AppError("INVALID_BRANCH_NAME", "Choose a valid Git branch name.", 400, false, { defaultBranch: "Invalid branch name" });
    transaction.stage("RECEIVED", `repository=${fields.owner}/${repositoryName}`);
    const archive = await this.reader.preflight(filePath, { excludeGenerated: fields.excludeGenerated, stripSingleRoot: fields.stripSingleRoot });
    try {
      const scan = await scanArchiveContents(this.reader, archive.zip, archive.entries, importLimits().scan);
      transaction.stage("PREFLIGHTED", `files=${archive.entries.length} scanned=${scan.summary.scannedFiles} truncated=${scan.summary.truncated}`);
      const base = this.baseOutcome(fields, archive, scan);
      if (scan.blocking.length > 0) {
        transaction.note("warn", { event: "import_rejected", blockingFindings: scan.blocking.length, highRiskUnscanned: scan.highRiskUnscanned.length, scanTruncated: scan.summary.truncated });
        return transaction.build("rejected", {
          ...base,
          errorCode: "POTENTIAL_SECRET_DETECTED",
          message: rejectionMessage(scan),
          remediation: "Remove the reported files or rotate the credentials, then retry. RepoDeck deliberately has no bypass switch: fix the archive or adjust the secret rules in a pull request."
        });
      }
      await this.authorize(fields, repositoryName);
      transaction.stage("AUTHORIZED");
      return await this.publish(transaction, fields, repositoryName, archive, base);
    } finally {
      archive.zip.close();
    }
  }

  private baseOutcome(fields: ImportFields, archive: ZipPreflight, scan: ImportScanResult): OutcomeBase {
    return {
      branch: fields.defaultBranch,
      importedFileCount: archive.entries.length,
      excluded: archive.excluded,
      emptyDirectoryCount: archive.emptyDirectoryCount,
      singleRootDetected: archive.singleRootDetected,
      findings: scan.findings,
      scan: scan.summary
    };
  }

  private async authorize(fields: ImportFields, repositoryName: string): Promise<void> {
    if (fields.ownerType === "organization") {
      const orgs = await this.github.request({ path: "/user/orgs", query: { per_page: 100 }, schema: z.array(z.object({ login: z.string() })), endpointTemplate: "/user/orgs" });
      if (!orgs.data.some((org) => org.login.toLowerCase() === fields.owner.toLowerCase())) throw new AppError("GITHUB_PERMISSION_DENIED", "The selected organization is not available to this account.", 403);
    } else {
      const viewer = await this.repositories.viewer();
      if (viewer.login.toLowerCase() !== fields.owner.toLowerCase()) throw new AppError("GITHUB_PERMISSION_DENIED", "The selected user owner does not match the signed-in account.", 403);
    }
    try {
      await this.repositories.detail(fields.owner, repositoryName);
      throw new AppError("REPOSITORY_ALREADY_EXISTS", "A repository with this name already exists.", 409, false, { repositoryName: "Choose another repository name" });
    } catch (error) {
      if (!(error instanceof AppError && error.code === "REPOSITORY_NOT_FOUND_OR_FORBIDDEN")) throw error;
    }
  }

  private async createRepository(fields: ImportFields, repositoryName: string) {
    const creationPath = fields.ownerType === "user" ? "/user/repos" : `/orgs/${encodeGitHubSegment(fields.owner)}/repos`;
    try {
      return (await this.github.request({
        method: "POST", path: creationPath,
        body: { name: repositoryName, description: fields.description || undefined, private: fields.visibility === "private", auto_init: false, has_issues: true, has_projects: true, has_wiki: false },
        schema: createdRepoSchema, endpointTemplate: fields.ownerType === "user" ? "/user/repos" : "/orgs/{org}/repos"
      })).data;
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422 && error.details.fields.some((field) => field.field === "name")) {
        throw new AppError("REPOSITORY_ALREADY_EXISTS", "A repository with this name already exists or the name is unavailable.", 409, false, { repositoryName: "Choose another repository name" });
      }
      throw error;
    }
  }

  private async publish(transaction: ImportTransaction, fields: ImportFields, repositoryName: string, archive: ZipPreflight, base: OutcomeBase): Promise<ImportOutcome> {
    const abort = new AbortController();
    try {
      const created = await this.createRepository(fields, repositoryName);
      transaction.recordRepository({ owner: created.owner.login, name: created.name, fullName: created.full_name, url: created.html_url });
      transaction.stage("REPOSITORY_CREATED", created.full_name);
      transaction.stage("BLOBS_WRITING", `blobs=${archive.entries.length}`);
      const tree = await this.writer.writeBlobs(created.owner.login, created.name, archive, { signal: abort.signal });
      transaction.stage("TREE_CREATED");
      const treeSha = await this.writer.createTree(created.owner.login, created.name, tree);
      const commitSha = await this.writer.createCommit(created.owner.login, created.name, { message: fields.commitMessage, tree: treeSha, parents: [] });
      transaction.stage("COMMIT_CREATED");
      await this.writer.publishRef(created.owner.login, created.name, fields.defaultBranch, commitSha);
      transaction.recordRef({ ref: `refs/heads/${fields.defaultBranch}`, sha: commitSha });
      transaction.stage("REF_PUBLISHED", fields.defaultBranch);
      await this.writer.configureDefaultBranch(created.owner.login, created.name, fields.defaultBranch);
      transaction.stage("DEFAULT_BRANCH_CONFIGURED");
      transaction.stage("COMPLETED");
      return transaction.build("completed", {
        ...base,
        message: `Imported ${archive.entries.length} files into ${created.full_name} as one root commit.`,
        repository: { fullName: created.full_name, url: created.html_url, createdByThisOperation: true },
        commitSha
      });
    } catch (error) {
      abort.abort();
      return await this.compensate(transaction, error, base);
    }
  }

  private async compensate(transaction: ImportTransaction, error: unknown, base: OutcomeBase): Promise<ImportOutcome> {
    const described = describeImportError(error);
    const created = transaction.createdRepository;
    const ref = transaction.createdRef;
    transaction.note("error", {
      event: "import_failed", errorCode: described.code, errorName: error instanceof Error ? error.name : "Unknown",
      failedAfterStage: transaction.stageName, retryable: described.retryable, repositoryCreated: Boolean(created), refPublished: Boolean(ref)
    });
    transaction.stage("COMPENSATING");
    let repositoryDeleted = false;
    let refDeleted = false;
    if (created && this.cleanupEnabled) {
      try {
        await this.writer.deleteRepository(created.owner, created.name);
        repositoryDeleted = true;
        transaction.note("info", { event: "import_repository_deleted" });
      } catch (deleteError) {
        transaction.note("warn", { event: "import_repository_delete_failed", errorName: deleteError instanceof Error ? deleteError.name : "Unknown" });
      }
    }
    if (created && !repositoryDeleted && ref) {
      try {
        await this.writer.deleteRef(created.owner, created.name, base.branch);
        refDeleted = true;
        transaction.note("info", { event: "import_ref_deleted", branch: base.branch });
      } catch (deleteError) {
        transaction.note("warn", { event: "import_ref_delete_failed", errorName: deleteError instanceof Error ? deleteError.name : "Unknown" });
      }
    }
    const repositoryRemainder = Boolean(created) && !repositoryDeleted;
    const cleanup = { refDeleted, repositoryDeleted, repositoryRemainder };
    const repository = created ? { fullName: created.fullName, url: created.url, createdByThisOperation: true } : null;
    if (!created) {
      return transaction.build("failed", {
        ...base, errorCode: described.code, cleanup, repository: null,
        message: `${described.message} No repository was created, so nothing needs cleaning up.`,
        remediation: described.retryable ? "Retry the import." : "Fix the reported problem and retry."
      });
    }
    if (repositoryDeleted) {
      return transaction.build("compensated", {
        ...base, errorCode: described.code, cleanup, repository,
        message: `${described.message} The repository and branch created by this operation were removed, so it is safe to retry.`,
        remediation: "Retry the import with the same or a new repository name."
      });
    }
    const branchState = ref ? (refDeleted ? "The import branch was removed." : `Branch ${base.branch} may still be published and must be deleted.`) : "No branch was published, so no partial content is visible.";
    return transaction.build("cleanup_incomplete", {
      ...base, errorCode: described.code, cleanup, repository,
      message: `${described.message} RepoDeck created ${created.fullName} but cannot remove it with the current permissions. ${branchState}`,
      remediation: `Delete ${created.fullName} at ${created.url} on GitHub, or enable repository cleanup by setting REPODECK_ALLOW_REPOSITORY_CLEANUP=true with a token that can delete repositories.`
    });
  }
}

function rejectionMessage(scan: ImportScanResult): string {
  const parts: string[] = [];
  if (scan.blocking.length > 0) parts.push(`${scan.blocking.length} blocking credential finding${scan.blocking.length === 1 ? "" : "s"}`);
  if (scan.highRiskUnscanned.length > 0) parts.push(`${scan.highRiskUnscanned.length} credential file${scan.highRiskUnscanned.length === 1 ? "" : "s"} that could not be scanned`);
  return `Import blocked before any GitHub mutation: ${parts.join(" and ")} detected in the archive.`;
}
