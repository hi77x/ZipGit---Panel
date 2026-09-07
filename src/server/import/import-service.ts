import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { AppError } from "@/shared/contracts/api-error";
import type { ImportFields, ImportResult } from "@/shared/contracts/import";
import { isSafeGitHubRef, encodeGitHubSegment } from "@/lib/url";
import { RepositoryService, validateRepositoryName } from "@/server/services/repository-service";
import { ZipReader } from "./zip-reader";
import { GitObjectWriter } from "./git-object-writer";

const createdRepoSchema = z.object({ full_name: z.string(), html_url: z.url(), name: z.string(), owner: z.object({ login: z.string() }) });

export class ImportService {
  private readonly reader = new ZipReader();
  private readonly repositories: RepositoryService;
  private readonly writer: GitObjectWriter;

  constructor(private readonly github: GitHubClient) {
    this.repositories = new RepositoryService(github);
    this.writer = new GitObjectWriter(github, this.reader);
  }

  async execute(filePath: string, fields: ImportFields): Promise<ImportResult> {
    const repositoryName = validateRepositoryName(fields.repositoryName);
    if (!isSafeGitHubRef(fields.defaultBranch)) throw new AppError("INVALID_BRANCH_NAME", "Choose a valid Git branch name.", 400, false, { defaultBranch: "Invalid branch name" });
    const archive = await this.reader.preflight(filePath, { excludeGenerated: fields.excludeGenerated, stripSingleRoot: fields.stripSingleRoot });
    let created: z.infer<typeof createdRepoSchema> | null = null;
    let createdBlobCount = 0;
    try {
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
      const creationPath = fields.ownerType === "user" ? "/user/repos" : `/orgs/${encodeGitHubSegment(fields.owner)}/repos`;
      created = (await this.github.request({
        method: "POST", path: creationPath,
        body: { name: repositoryName, description: fields.description || undefined, private: fields.visibility === "private", auto_init: false, has_issues: true, has_projects: true, has_wiki: false },
        schema: createdRepoSchema, endpointTemplate: fields.ownerType === "user" ? "/user/repos" : "/orgs/{org}/repos"
      })).data;
      const written = await this.writer.write(created.owner.login, created.name, archive, fields.commitMessage, fields.defaultBranch, (completed) => { createdBlobCount = completed; });
      return {
        repositoryUrl: created.html_url, fullName: created.full_name, commitSha: written.commitSha,
        importedFileCount: archive.entries.length, excluded: archive.excluded,
        emptyDirectoryCount: archive.emptyDirectoryCount, singleRootDetected: archive.singleRootDetected
      };
    } catch (error) {
      if (!created && error instanceof GitHubApiError && error.details.status === 422 && error.details.fields.some((field) => field.field === "name")) {
        throw new AppError("REPOSITORY_ALREADY_EXISTS", "A repository with this name already exists or the name is unavailable.", 409, false, { repositoryName: "Choose another repository name" });
      }
      if (created) {
        throw new AppError("IMPORT_PARTIALLY_COMPLETED", `GitHub repository was created, but import stopped after ${createdBlobCount} of ${archive.entries.length} blobs. Open it or retry with a new name.`, 502, false, {}, { cause: error, details: { repositoryUrl: created.html_url, stage: createdBlobCount ? "uploading-git-objects" : "creating-repository", createdBlobCount, totalBlobCount: archive.entries.length } });
      }
      if (error instanceof GitHubApiError) throw mapGitHubError(error);
      throw error;
    } finally {
      archive.zip.close();
    }
  }
}
