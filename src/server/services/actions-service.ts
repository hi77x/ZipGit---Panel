import "server-only";
import { z } from "zod";
import { GitHubClient } from "@/server/github/client";
import { GitHubApiError, mapGitHubError } from "@/server/github/errors";
import { RepositoryService } from "./repository-service";
import { requireCapability } from "@/server/authz/capabilities";
import { encodeGitHubSegment, isSafeGitHubRef } from "@/lib/url";
import { AppError } from "@/shared/contracts/api-error";
import pLimit from "p-limit";

const workflowSchema = z.object({ id: z.number(), name: z.string(), path: z.string(), state: z.string(), html_url: z.url(), badge_url: z.url().optional() });
const workflowsSchema = z.object({ total_count: z.number(), workflows: z.array(workflowSchema) });
const actorSchema = z.object({ login: z.string(), avatar_url: z.string().nullable().optional() }).nullable().optional();
const runSchema = z.object({
  id: z.number(), name: z.string().nullable().optional(), status: z.string().nullable(), conclusion: z.string().nullable(), event: z.string(),
  head_branch: z.string().nullable(), head_sha: z.string(), html_url: z.url(), created_at: z.string(), updated_at: z.string(), actor: actorSchema,
  workflow_id: z.number()
});
const runsSchema = z.object({ total_count: z.number(), workflow_runs: z.array(runSchema) });

export class ActionsService {
  constructor(private readonly github: GitHubClient, private readonly repositories = new RepositoryService(github)) {}

  async workflows(owner: string, repo: string, page = 1) {
    await this.repositories.assertAccessible(owner, repo);
    try {
      const result = await this.github.request({ path: `${this.base(owner, repo)}/workflows`, query: { page, per_page: 100 }, schema: workflowsSchema, endpointTemplate: "/repos/{owner}/{repo}/actions/workflows" });
      const limit = pLimit(6);
      const workflows = await Promise.all(result.data.workflows.map((workflow) => limit(async () => {
        try {
          const path = workflow.path.split("/").map(encodeURIComponent).join("/");
          const source = await this.github.request({ path: `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/contents/${path}`, schema: z.string(), accept: "application/vnd.github.raw+json", endpointTemplate: "/repos/{owner}/{repo}/contents/{workflow}" });
          return { ...workflow, dispatchable: /^\s*workflow_dispatch\s*:/m.test(source.data) };
        } catch (error) {
          return { ...workflow, dispatchable: error instanceof GitHubApiError && error.details.status === 404 ? false : null };
        }
      })));
      return { workflows, total: result.data.total_count, hasNext: Boolean(result.links.next) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw mapGitHubError(error, "ACTIONS_UNAVAILABLE");
      throw error;
    }
  }

  async runs(owner: string, repo: string, query: { workflowId?: number; status?: string; branch?: string; page: number }) {
    await this.repositories.assertAccessible(owner, repo);
    const path = query.workflowId ? `${this.base(owner, repo)}/workflows/${query.workflowId}/runs` : `${this.base(owner, repo)}/runs`;
    const result = await this.github.request({ path, query: { page: query.page, per_page: 30, status: query.status, branch: query.branch }, schema: runsSchema, endpointTemplate: query.workflowId ? "/repos/{owner}/{repo}/actions/workflows/{id}/runs" : "/repos/{owner}/{repo}/actions/runs" });
    return { runs: result.data.workflow_runs.map((run) => ({ ...run, ...actionEligibility(run.status) })), total: result.data.total_count, hasNext: Boolean(result.links.next) };
  }

  async dispatch(owner: string, repo: string, workflowId: number, input: { ref: string; inputs: Record<string, string> }) {
    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) throw new AppError("WORKFLOW_NOT_FOUND", "Invalid workflow identifier.", 400);
    if (!isSafeGitHubRef(input.ref)) throw new AppError("WORKFLOW_DISPATCH_INVALID", "Choose a valid Git reference.", 400, false, { ref: "Invalid ref" });
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, "runWorkflow");
    const branches = await this.repositories.branches(owner, repo, false);
    if (!branches.includes(input.ref)) throw new AppError("WORKFLOW_DISPATCH_INVALID", "Choose an existing branch for workflow dispatch.", 400, false, { ref: "Branch not found" });
    const entries = Object.entries(input.inputs);
    if (entries.length > 20 || entries.some(([key, value]) => key.length > 100 || value.length > 1_000)) throw new AppError("WORKFLOW_DISPATCH_INVALID", "Workflow inputs exceed allowed limits.", 400, false, { inputs: "At most 20 compact inputs are allowed" });
    try {
      await this.github.request({ method: "POST", path: `${this.base(owner, repo)}/workflows/${workflowId}/dispatches`, body: input, schema: z.null(), endpointTemplate: "/repos/{owner}/{repo}/actions/workflows/{id}/dispatches" });
      return { dispatched: true as const };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 422) throw mapGitHubError(error, "WORKFLOW_DISPATCH_INVALID");
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "ACTIONS_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
  }

  async mutateRun(owner: string, repo: string, runId: number, action: "rerun" | "rerun-failed" | "cancel") {
    if (!Number.isSafeInteger(runId) || runId <= 0) throw new AppError("WORKFLOW_RUN_NOT_FOUND", "Invalid workflow run identifier.", 400);
    const repository = await this.repositories.assertAccessible(owner, repo);
    requireCapability(repository, action === "cancel" ? "cancelWorkflow" : "runWorkflow");
    const endpoint = action === "rerun" ? "rerun" : action === "rerun-failed" ? "rerun-failed-jobs" : "cancel";
    try {
      await this.github.request({ method: "POST", path: `${this.base(owner, repo)}/runs/${runId}/${endpoint}`, schema: z.unknown(), endpointTemplate: `/repos/{owner}/{repo}/actions/runs/{id}/${endpoint}` });
      return { accepted: true as const };
    } catch (error) {
      if (error instanceof GitHubApiError && error.details.status === 404) throw mapGitHubError(error, "WORKFLOW_RUN_NOT_FOUND");
      if (error instanceof GitHubApiError && (error.details.status === 409 || error.details.status === 422)) {
        const fresh = await this.github.request({ path: `${this.base(owner, repo)}/runs/${runId}`, schema: runSchema, endpointTemplate: "/repos/{owner}/{repo}/actions/runs/{id}" });
        return { accepted: false as const, run: fresh.data };
      }
      if (error instanceof GitHubApiError && error.details.status === 403) throw mapGitHubError(error, "ACTIONS_WRITE_PERMISSION_REQUIRED");
      throw error;
    }
  }

  private base(owner: string, repo: string) { return `/repos/${encodeGitHubSegment(owner)}/${encodeGitHubSegment(repo)}/actions`; }
}

export function actionEligibility(status: string | null) {
  return { canCancel: status === "queued" || status === "in_progress", canRerun: status === "completed" };
}
