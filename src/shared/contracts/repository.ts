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
  updatedAt: string;
  defaultBranch: string;
  url: string;
  avatarUrl: string;
};
