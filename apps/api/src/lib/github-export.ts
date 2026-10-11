import { Octokit } from "@octokit/rest";
import { env } from "../config/env.js";

// Ported from SAAS/backend/src/modules/github/github.service.ts.

class GitHubService {
  private octokit: Octokit;
  private token: string;

  constructor() {
    this.token = env.GITHUB_ACCESS_TOKEN ?? "";
    this.octokit = new Octokit({ auth: this.token });
  }

  get isConfigured() {
    return this.token.length > 0;
  }

  async createRepo(repoName: string, description: string): Promise<string> {
    if (!this.isConfigured) throw new Error("GitHub is not configured");

    try {
      const response = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description,
        auto_init: true,
        private: false,
      });
      return response.data.full_name;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 422) {
        const { data } = await this.octokit.rest.users.getAuthenticated();
        return `${data.login}/${repoName}`;
      }
      throw error;
    }
  }

  async commitFiles(repoFullName: string, files: { path: string; content: string }[], message = "AI Code Generation") {
    if (!this.isConfigured) throw new Error("GitHub is not configured");

    const [owner, repo] = repoFullName.split("/") as [string, string];

    const { data: refData } = await this.octokit.rest.git
      .getRef({ owner, repo, ref: "heads/main" })
      .catch(() => this.octokit.rest.git.getRef({ owner, repo, ref: "heads/master" }));

    const commitSha = refData.object.sha;

    const { data: commitData } = await this.octokit.rest.git.getCommit({ owner, repo, commit_sha: commitSha });
    const baseTreeSha = commitData.tree.sha;

    const tree = await Promise.all(
      files.map(async (file) => {
        const { data: blobData } = await this.octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });
        return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blobData.sha };
      }),
    );

    const { data: newTreeData } = await this.octokit.rest.git.createTree({ owner, repo, base_tree: baseTreeSha, tree });

    const { data: newCommitData } = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: newTreeData.sha,
      parents: [commitSha],
    });

    await this.octokit.rest.git.updateRef({ owner, repo, ref: refData.ref.replace("refs/", ""), sha: newCommitData.sha });

    return newCommitData.sha;
  }
}

export function getGithubService(): GitHubService {
  return new GitHubService();
}
