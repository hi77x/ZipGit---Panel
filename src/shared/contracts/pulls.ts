import type { FileDiffDto } from "./content";
import type { ActorDto, LabelDto } from "./issues";

export type PullState = "open" | "closed";
export type MergeMethod = "merge" | "squash" | "rebase";

export type PullRefDto = { ref: string; sha: string; label: string };

export type PullSummaryDto = {
  id: number;
  number: number;
  title: string;
  state: PullState;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string | null;
  user: ActorDto;
  head: PullRefDto;
  base: PullRefDto;
  labels: LabelDto[];
  comments: number;
  reviewComments: number;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  url: string;
};

export type PullDetailDto = PullSummaryDto & {
  body: string;
  mergedBy: ActorDto | null;
  requestedReviewers: ActorDto[];
  maintainerCanModify: boolean;
};

export type PullReviewDto = {
  id: number;
  user: ActorDto;
  state: string;
  body: string;
  submittedAt: string | null;
};

export type PullFileDto = FileDiffDto;

export type CreatePullInput = {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
};

export type MergePullInput = {
  method: MergeMethod;
  commitTitle?: string;
  commitMessage?: string;
  deleteBranch?: boolean;
};

export type MergeResultDto = {
  merged: boolean;
  message: string;
  sha: string | null;
  branchDeleted: boolean;
};

export type CreateReviewInput = {
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  body?: string;
};
