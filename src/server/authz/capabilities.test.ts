import { describe, expect, it } from "vitest";
import { assertCapability, capabilitiesForRepository, capabilitiesForRole, capabilityDeniedReason, roleFromPermissions, type Capability, type RepositoryPermissionFlags, type RepositoryRole } from "./capabilities";

const flags = (role: RepositoryRole): RepositoryPermissionFlags | null => {
  switch (role) {
    case "admin": return { admin: true, maintain: true, push: true, triage: true, pull: true };
    case "maintain": return { maintain: true, push: true, triage: true, pull: true };
    case "write": return { push: true, triage: true, pull: true };
    case "triage": return { triage: true, pull: true };
    case "read": return { pull: true };
    default: return null;
  }
};

const roleCapabilities: Array<[RepositoryRole, Capability, boolean]> = [
  ["read", "readCode", true],
  ["read", "writeCode", false],
  ["read", "createIssue", true],
  ["read", "manageIssues", false],
  ["read", "mergePullRequest", false],
  ["triage", "manageIssues", true],
  ["triage", "managePullRequests", true],
  ["triage", "mergePullRequest", false],
  ["triage", "writeCode", false],
  ["write", "writeCode", true],
  ["write", "createBranch", true],
  ["write", "mergePullRequest", true],
  ["write", "manageReleases", true],
  ["write", "runWorkflow", true],
  ["write", "managePages", false],
  ["write", "manageRepository", false],
  ["maintain", "managePages", true],
  ["maintain", "manageRepository", false],
  ["admin", "manageRepository", true],
  ["admin", "optionalDeleteImportedRepository", true],
  ["none", "readCode", false],
  ["none", "importRepository", true]
];

describe("repository capability model", () => {
  it("maps GitHub permission flags to the strongest role", () => {
    expect(roleFromPermissions(null)).toBe("none");
    expect(roleFromPermissions({})).toBe("none");
    expect(roleFromPermissions(flags("read"))).toBe("read");
    expect(roleFromPermissions(flags("triage"))).toBe("triage");
    expect(roleFromPermissions(flags("write"))).toBe("write");
    expect(roleFromPermissions(flags("maintain"))).toBe("maintain");
    expect(roleFromPermissions(flags("admin"))).toBe("admin");
  });

  it.each(roleCapabilities)("role %s -> %s = %s", (role, capability, expected) => {
    expect(capabilitiesForRole(role)[capability]).toBe(expected);
  });

  it("denies every mutation on archived repositories but keeps reads and imports", () => {
    const capabilities = capabilitiesForRole("admin", { archived: true });
    expect(capabilities.readCode).toBe(true);
    expect(capabilities.runAudit).toBe(true);
    expect(capabilities.importRepository).toBe(true);
    expect(capabilities.writeCode).toBe(false);
    expect(capabilities.mergePullRequest).toBe(false);
    expect(capabilities.manageRepository).toBe(false);
  });

  it("treats unknown or missing permission payloads as no access", () => {
    const repository = { permissions: null, archived: false };
    expect(capabilitiesForRepository(repository).writeCode).toBe(false);
    expect(capabilityDeniedReason(repository, "writeCode")).toContain("does not have access");
  });

  it("throws a safe 403 AppError when a capability is missing", () => {
    try {
      assertCapability(capabilitiesForRole("read"), "mergePullRequest");
      throw new Error("expected assertCapability to throw");
    } catch (error) {
      expect(error).toMatchObject({ name: "AppError", code: "CAPABILITY_DENIED", status: 403, retryable: false });
    }
  });

  it("explains archived and role-based denials", () => {
    expect(capabilityDeniedReason({ permissions: flags("admin"), archived: true }, "writeCode")).toContain("archived");
    expect(capabilityDeniedReason({ permissions: flags("read"), archived: false }, "mergePullRequest")).toContain("read");
    expect(capabilityDeniedReason({ permissions: flags("write"), archived: false }, "managePages")).toContain("write");
    expect(capabilityDeniedReason({ permissions: flags("write"), archived: false }, "writeCode")).toBeNull();
  });
});
