export type ActorDto = { login: string; avatarUrl: string | null };

export type LabelDto = { name: string; color: string; description: string | null };

export type IssueState = "open" | "closed";

export type IssueSummaryDto = {
  id: number;
  number: number;
  title: string;
  state: IssueState;
  stateReason: string | null;
  user: ActorDto;
  labels: LabelDto[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  isPullRequest: boolean;
};

export type IssueCommentDto = {
  id: number;
  body: string;
  user: ActorDto;
  createdAt: string;
  updatedAt: string | null;
  url: string;
};

export type IssueDetailDto = IssueSummaryDto & {
  body: string;
  assignees: ActorDto[];
  milestone: string | null;
  locked: boolean;
};

export type CreateIssueInput = {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
};

export type UpdateIssueInput = {
  state?: "open" | "closed";
  title?: string;
  body?: string;
  labels?: string[];
  state_reason?: "completed" | "not_planned" | "reopened";
};
