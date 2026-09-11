export type TreeEntryType = "blob" | "tree" | "commit";

export type TreeEntry = {
  path: string;
  name: string;
  type: TreeEntryType;
  sha: string;
  size: number | null;
};

export type FileContentDto = {
  path: string;
  name: string;
  sha: string;
  size: number;
  encoding: string;
  content: string;
  decoded: boolean;
  htmlUrl: string;
  downloadUrl: string | null;
  truncated: boolean;
};

export type BranchDto = {
  name: string;
  sha: string;
  isDefault: boolean;
  protected: boolean;
  updatedAt: string | null;
};

export type CommitRefDto = {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string;
  authorAvatar: string | null;
  authoredAt: string | null;
};

export type FileDiffDto = {
  filename: string;
  previousFilename: string | null;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
  binary: boolean;
  truncated: boolean;
};

export type CommitDto = CommitRefDto & {
  url: string;
  parents: string[];
  additions: number;
  deletions: number;
  files: FileDiffDto[];
};

export type CompareDto = {
  status: "ahead" | "behind" | "diverged" | "identical";
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  additions: number;
  deletions: number;
  files: FileDiffDto[];
  commits: CommitRefDto[];
};

export type WriteFileInput = {
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string;
};
