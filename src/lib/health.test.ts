import { describe, expect, it } from "vitest";
import { computeHealth, gradeFor, type HealthInput } from "./health";

const perfect: HealthInput = {
  description: "A focused self-hosted GitHub command deck",
  hasReadme: true, hasLicense: true, hasContributing: true, hasCodeOfConduct: true, hasSecurityPolicy: true,
  hasCi: true, hasTests: true, hasChangelog: true, dependencyManifests: 1, topics: 5,
  contributors: 6, commitsLast90Days: 20, criticalFindings: 0, highFindings: 0, archived: false
};

describe("repository health", () => {
  it("awards a perfect score to a fully maintained repository", () => {
    const report = computeHealth(perfect);
    expect(report.score).toBe(100);
    expect(report.grade).toBe("A+");
    expect(report.improvements).toHaveLength(0);
  });

  it("penalizes committed secrets and missing documentation", () => {
    const report = computeHealth({ ...perfect, criticalFindings: 2, hasReadme: false, hasLicense: false, hasCi: false });
    expect(report.score).toBeLessThan(80);
    expect(report.improvements.some((check) => check.id === "secret-hygiene")).toBe(true);
    expect(report.improvements.some((check) => check.id === "readme")).toBe(true);
  });

  it("gives partial credit for a small warning", () => {
    const report = computeHealth({ ...perfect, highFindings: 1 });
    const hygiene = report.checks.find((check) => check.id === "secret-hygiene");
    expect(hygiene?.status).toBe("warn");
    expect(hygiene?.earned).toBe(6);
  });

  it("pauses scoring for archived repositories", () => {
    const report = computeHealth({ ...perfect, archived: true });
    expect(report.score).toBe(100);
    expect(report.checks).toHaveLength(0);
  });

  it("maps score boundaries to grades", () => {
    expect(gradeFor(95)).toBe("A+");
    expect(gradeFor(85)).toBe("A");
    expect(gradeFor(72)).toBe("B");
    expect(gradeFor(58)).toBe("C");
    expect(gradeFor(42)).toBe("D");
    expect(gradeFor(10)).toBe("F");
  });
});
