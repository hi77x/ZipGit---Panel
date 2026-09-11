import "server-only";
import { AppError } from "@/shared/contracts/api-error";
import type { RepositoryDto, RepositoryPermissionFlags } from "@/shared/contracts/repository";

export type { RepositoryPermissionFlags } from "@/shared/contracts/repository";

export const capabilityNames = [
  "readRepository",
  "readCode",
  "readActions",
  "runAudit",
  "writeCode",
  "createBranch",
  "deleteBranch",
  "createIssue",
  "commentOnIssue",
  "manageIssues",
  "createPullRequest",
  "reviewPullRequest",
  "managePullRequests",
  "mergePullRequest",
  "manageReleases",
  "runWorkflow",
  "cancelWorkflow",
  "managePages",
  "manageRepository",
  "optionalDeleteImportedRepository",
  "importRepository"
] as const;

export type Capability = (typeof capabilityNames)[number];
export type RepositoryRole = "admin" | "maintain" | "write" | "triage" | "read" | "none";
export type CapabilityMap = Record<Capability, boolean>;

export function roleFromPermissions(flags: RepositoryPermissionFlags | null | undefined): RepositoryRole {
  if (!flags) return "none";
  if (flags.admin) return "admin";
  if (flags.maintain) return "maintain";
  if (flags.push) return "write";
  if (flags.triage) return "triage";
  if (flags.pull) return "read";
  return "none";
}

export function capabilitiesForRole(role: RepositoryRole, options: { archived?: boolean } = {}): CapabilityMap {
  const read = role !== "none";
  const triage = read && role !== "read";
  const write = triage && role !== "triage";
  const maintain = write && role !== "write";
  const admin = role === "admin";
  const map: CapabilityMap = {
    readRepository: read,
    readCode: read,
    readActions: read,
    runAudit: read,
    writeCode: write,
    createBranch: write,
    deleteBranch: write,
    createIssue: read,
    commentOnIssue: read,
    manageIssues: triage,
    createPullRequest: write,
    reviewPullRequest: read,
    managePullRequests: triage,
    mergePullRequest: write,
    manageReleases: write,
    runWorkflow: write,
    cancelWorkflow: write,
    managePages: maintain,
    manageRepository: admin,
    optionalDeleteImportedRepository: admin,
    importRepository: true
  };
  if (options.archived) {
    for (const capability of capabilityNames) {
      if (capability !== "readRepository" && capability !== "readCode" && capability !== "readActions" && capability !== "runAudit" && capability !== "importRepository") map[capability] = false;
    }
  }
  return map;
}

export function capabilitiesForRepository(repository: Pick<RepositoryDto, "permissions" | "archived">): CapabilityMap {
  return capabilitiesForRole(roleFromPermissions(repository.permissions), { archived: repository.archived });
}

export function hasCapability(capabilities: CapabilityMap, capability: Capability): boolean {
  return capabilities[capability];
}

export function assertCapability(capabilities: CapabilityMap, capability: Capability): void {
  if (capabilities[capability]) return;
  throw new AppError("CAPABILITY_DENIED", "Your GitHub role on this repository does not allow this operation.", 403, false, {}, { details: { capability } });
}

export function requireCapability(repository: Pick<RepositoryDto, "permissions" | "archived">, capability: Capability): void {
  assertCapability(capabilitiesForRepository(repository), capability);
}

export function capabilityDeniedReason(repository: Pick<RepositoryDto, "permissions" | "archived">, capability: Capability): string | null {
  const capabilities = capabilitiesForRepository(repository);
  if (capabilities[capability]) return null;
  const role = roleFromPermissions(repository.permissions);
  if (repository.archived) return "This repository is archived and read-only on GitHub.";
  if (role === "none") return "Your account does not have access to this repository.";
  return `Your GitHub role (${role}) does not allow this operation.`;
}
