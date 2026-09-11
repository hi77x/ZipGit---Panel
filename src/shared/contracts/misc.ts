import type { RepositoryDto } from "./repository";

export type ReleaseAssetDto = { id: number; name: string; size: number; downloadCount: number; url: string };

export type ReleaseDto = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string | null;
  url: string;
  tarballUrl: string | null;
  zipballUrl: string | null;
  author: { login: string; avatarUrl: string | null } | null;
  assets: ReleaseAssetDto[];
};

export type NotificationDto = {
  id: string;
  unread: boolean;
  reason: string;
  updatedAt: string;
  title: string;
  type: string;
  url: string | null;
  repository: { fullName: string; owner: string; name: string; avatarUrl: string | null } | null;
};

export type CodeSearchResultDto = {
  path: string;
  name: string;
  sha: string;
  url: string;
  repository: { fullName: string; owner: string; name: string; avatarUrl: string | null };
  score: number;
};

export type SearchResponseDto = {
  query: string;
  repositories: RepositoryDto[];
  code: CodeSearchResultDto[];
  issues: Array<{ number: number; title: string; state: string; url: string; repository: { fullName: string } }>;
};
