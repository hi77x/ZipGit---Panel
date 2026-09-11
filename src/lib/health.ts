export type HealthStatus = "pass" | "warn" | "fail";

export type HealthCheck = {
  id: string;
  label: string;
  category: "documentation" | "engineering" | "security" | "community";
  status: HealthStatus;
  weight: number;
  earned: number;
  detail: string;
  action?: string;
};

export type HealthInput = {
  description: string | null;
  hasReadme: boolean;
  hasLicense: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasCi: boolean;
  hasTests: boolean;
  hasChangelog: boolean;
  dependencyManifests: number;
  topics: number;
  contributors: number;
  commitsLast90Days: number;
  criticalFindings: number;
  highFindings: number;
  archived: boolean;
};

export type HealthReport = {
  score: number;
  grade: string;
  checks: HealthCheck[];
  strengths: HealthCheck[];
  improvements: HealthCheck[];
  summary: string;
};

type CheckDefinition = Omit<HealthCheck, "earned"> & { earnedFor: (input: HealthInput) => number | null };

const definitions: CheckDefinition[] = [
  {
    id: "description", label: "Repository description", category: "documentation", status: "pass", weight: 5,
    detail: "A one-line description improves search and onboarding.",
    action: "Add a description in GitHub repository settings.",
    earnedFor: (input) => (input.description && input.description.trim().length >= 10 ? 5 : null)
  },
  {
    id: "readme", label: "README present", category: "documentation", status: "pass", weight: 12,
    detail: "A README explains what the project is and how to use it.",
    action: "Add a README.md at the repository root.",
    earnedFor: (input) => (input.hasReadme ? 12 : 0)
  },
  {
    id: "license", label: "Open-source license", category: "documentation", status: "pass", weight: 9,
    detail: "Without a license others cannot legally use the code.",
    action: "Add a LICENSE file such as MIT or Apache-2.0.",
    earnedFor: (input) => (input.hasLicense ? 9 : 0)
  },
  {
    id: "changelog", label: "Changelog", category: "documentation", status: "pass", weight: 4,
    detail: "A changelog makes releases understandable.",
    action: "Add CHANGELOG.md or enable release notes.",
    earnedFor: (input) => (input.hasChangelog ? 4 : null)
  },
  {
    id: "contributing", label: "Contribution guide", category: "community", status: "pass", weight: 4,
    detail: "CONTRIBUTING.md reduces friction for new contributors.",
    action: "Add CONTRIBUTING.md with setup and pull request guidance.",
    earnedFor: (input) => (input.hasContributing ? 4 : null)
  },
  {
    id: "code-of-conduct", label: "Code of conduct", category: "community", status: "pass", weight: 3,
    detail: "A code of conduct sets expectations for collaboration.",
    action: "Add CODE_OF_CONDUCT.md.",
    earnedFor: (input) => (input.hasCodeOfConduct ? 3 : null)
  },
  {
    id: "ci", label: "Continuous integration", category: "engineering", status: "pass", weight: 11,
    detail: "Automated checks catch regressions before review.",
    action: "Add a GitHub Actions workflow under .github/workflows.",
    earnedFor: (input) => (input.hasCi ? 11 : 0)
  },
  {
    id: "tests", label: "Test suite detected", category: "engineering", status: "pass", weight: 10,
    detail: "Tests signal that changes can be made safely.",
    action: "Add a test directory or test script.",
    earnedFor: (input) => (input.hasTests ? 10 : 0)
  },
  {
    id: "manifests", label: "Dependency manifest", category: "engineering", status: "pass", weight: 4,
    detail: "A manifest makes the project reproducible.",
    action: "Commit package.json, requirements.txt, go.mod, Cargo.toml, or similar.",
    earnedFor: (input) => (input.dependencyManifests > 0 ? 4 : null)
  },
  {
    id: "topics", label: "Discovery topics", category: "community", status: "pass", weight: 4,
    detail: "Topics help people discover the repository.",
    action: "Add at least three GitHub topics.",
    earnedFor: (input) => (input.topics >= 3 ? 4 : null)
  },
  {
    id: "activity", label: "Recent activity", category: "engineering", status: "pass", weight: 12,
    detail: "Active maintenance keeps dependencies and docs current.",
    action: "Push a commit within the last 90 days or archive the repository explicitly.",
    earnedFor: (input) => (input.commitsLast90Days >= 5 ? 12 : input.commitsLast90Days > 0 ? 7 : 0)
  },
  {
    id: "contributors", label: "Team beyond one author", category: "community", status: "pass", weight: 6,
    detail: "Multiple contributors reduce bus factor.",
    action: "Invite collaborators or document contribution paths.",
    earnedFor: (input) => (input.contributors >= 5 ? 6 : input.contributors >= 2 ? 4 : null)
  },
  {
    id: "security-policy", label: "Security policy", category: "security", status: "pass", weight: 5,
    detail: "SECURITY.md tells researchers how to report issues responsibly.",
    action: "Add SECURITY.md with a disclosure channel.",
    earnedFor: (input) => (input.hasSecurityPolicy ? 5 : null)
  },
  {
    id: "secret-hygiene", label: "No committed secrets", category: "security", status: "pass", weight: 15,
    detail: "Secrets in source control must be rotated even after removal.",
    action: "Rotate exposed credentials, remove them, and add pre-commit scanning.",
    earnedFor: (input) => (input.criticalFindings > 0 ? 0 : input.highFindings > 0 ? 6 : 15)
  }
];

export function computeHealth(input: HealthInput): HealthReport {
  if (input.archived) {
    return {
      score: 100,
      grade: "A",
      checks: [],
      strengths: [],
      improvements: [],
      summary: "This repository is archived. Health scoring is paused because no further maintenance is expected."
    };
  }
  const checks: HealthCheck[] = definitions.map((definition) => {
    const earned = definition.earnedFor(input);
    const status: HealthStatus = earned === null ? "warn" : earned >= definition.weight ? "pass" : earned > 0 ? "warn" : "fail";
    return { ...definition, earned: earned ?? Math.round(definition.weight / 2), status };
  });
  const totalWeight = checks.reduce((total, check) => total + check.weight, 0);
  const earned = checks.reduce((total, check) => total + check.earned, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const strengths = checks.filter((check) => check.status === "pass").sort((left, right) => right.weight - left.weight).slice(0, 4);
  const improvements = checks.filter((check) => check.status !== "pass").sort((left, right) => right.weight - left.weight).slice(0, 5);
  return {
    score,
    grade: gradeFor(score),
    checks,
    strengths,
    improvements,
    summary: `${checks.filter((check) => check.status === "pass").length} of ${checks.length} checks pass. ${improvements.length ? `Top improvement: ${improvements[0]?.label.toLowerCase()}.` : "Everything looks healthy."}`
  };
}

export function gradeFor(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 42) return "D";
  return "F";
}
