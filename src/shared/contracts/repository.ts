import { z } from "zod";

export const repositoryQuerySchema = z.object({
  affiliation: z.enum(["owner,collaborator,organization_member"]).default("owner,collaborator,organization_member"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30)
});

export const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  visibility: z.string().optional(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  watchers_count: z.number().optional(),
  open_issues_count: z.number().optional(),
  topics: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  disabled: z.boolean().optional(),
  fork: z.boolean().optional(),
  homepage: z.string().nullable().optional(),
  size: z.number().optional(),
  license: z.object({ spdx_id: z.string().nullable(), name: z.string().nullable() }).nullable().optional(),
  created_at: z.string().optional(),
  pushed_at: z.string().nullable().optional(),
  updated_at: z.string(),
  default_branch: z.string(),
  html_url: z.url(),
  owner: z.object({ login: z.string(), avatar_url: z.url() })
});

export type RepositoryDto = {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  visibility: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  topics: string[];
  archived: boolean;
  isFork: boolean;
  homepage: string | null;
  sizeKb: number;
  license: string | null;
  licenseName: string | null;
  createdAt: string | null;
  pushedAt: string | null;
  updatedAt: string;
  defaultBranch: string;
  url: string;
  avatarUrl: string;
};
