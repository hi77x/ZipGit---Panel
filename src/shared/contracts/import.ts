import { z } from "zod";

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
export type ImportResult = {
  repositoryUrl: string;
  fullName: string;
  commitSha: string;
  importedFileCount: number;
  excluded: Array<{ path: string; reason: string }>;
  emptyDirectoryCount: number;
  singleRootDetected: boolean;
};
