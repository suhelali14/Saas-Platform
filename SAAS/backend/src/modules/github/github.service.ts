import { Octokit } from '@octokit/rest';

export class GitHubService {
  private octokit: Octokit;
  private token: string;

  constructor() {
    this.token = process.env.GITHUB_ACCESS_TOKEN || '';
    this.octokit = new Octokit({ auth: this.token });
  }

  get isConfigured() {
    return this.token.length > 0;
  }

  /**
   * Creates a new GitHub repository and returns the repo name.
   */
  async createRepo(repoName: string, description: string): Promise<string> {
    if (!this.isConfigured) throw new Error('GitHub is not configured');

    try {
      const response = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description,
        auto_init: true, // Creates an initial commit with a README
        private: false,
      });

      return response.data.full_name; // e.g., "username/repo-name"
    } catch (error: any) {
      if (error.status === 422) {
        // Repo already exists, let's just return it and assume we will overwrite/update
        const { data } = await this.octokit.rest.users.getAuthenticated();
        return `${data.login}/${repoName}`;
      }
      throw error;
    }
  }

  /**
   * Commits a set of files to the repository.
   * `files` should be an array of { path: string, content: string }
   */
  async commitFiles(repoFullName: string, files: { path: string; content: string }[], message: string = 'AI Code Generation') {
    if (!this.isConfigured) throw new Error('GitHub is not configured');

    const [owner, repo] = repoFullName.split('/');

    // 1. Get the current commit object
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/main', // Assuming main branch
    }).catch(async (e) => {
        // Fallback to master if main doesn't exist
        return this.octokit.rest.git.getRef({
            owner, repo, ref: 'heads/master'
        });
    });

    const commitSha = refData.object.sha;

    // 2. Get the commit tree
    const { data: commitData } = await this.octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs and create a new tree
    const tree = await Promise.all(
      files.map(async (file) => {
        const { data: blobData } = await this.octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );

    const { data: newTreeData } = await this.octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree,
    });

    // 4. Create a new commit
    const { data: newCommitData } = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: newTreeData.sha,
      parents: [commitSha],
    });

    // 5. Update the reference
    await this.octokit.rest.git.updateRef({
      owner,
      repo,
      ref: refData.ref.replace('refs/', ''),
      sha: newCommitData.sha,
    });

    return newCommitData.sha;
  }
}
