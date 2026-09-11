import type { HealthReport } from "@/lib/health";
import type { DetectedManifest } from "@/lib/dependencies";
import type { SecretFinding, SecretSeverity } from "@/lib/secret-rules";

export type LanguageSlice = { name: string; bytes: number; percent: number; color: string };
export type ContributorStat = { login: string; avatarUrl: string | null; commits: number; percent: number };
export type ActivityDay = { date: string; count: number };
export type RepoFile = { path: string; content: string };

export type RepositoryChecks = {
  readme: { exists: boolean; path: string | null; bytes: number };
  license: string | null;
  changelog: boolean;
  contributing: boolean;
  codeOfConduct: boolean;
  securityPolicy: boolean;
  ci: string[];
  tests: boolean;
  topics: string[];
  archived: boolean;
  description: string | null;
  defaultBranch: string;
  hasPagesWorkflow: boolean;
  hasDependabot: boolean;
};

export type AuditReportDto = {
  generatedAt: string;
  fileCount: number;
  totalBytes: number;
  truncated: boolean;
  commitsScanned: number;
  checks: RepositoryChecks;
  health: HealthReport;
  secrets: {
    findings: SecretFinding[];
    summary: { total: number; bySeverity: Record<SecretSeverity, number>; riskScore: number; affectedFiles: number };
  };
  languages: LanguageSlice[];
  contributors: ContributorStat[];
  activity: ActivityDay[];
  manifests: DetectedManifest[];
  recommendations: Array<{ id: string; title: string; detail: string; severity: "high" | "medium" | "low"; category: string }>;
};
