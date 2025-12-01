import { execSync } from "child_process";
import { log } from "../logger.js";

/**
 * Execute a git command and return stdout
 */
function git(args: string, options?: { cwd?: string }): string {
  const cwd = options?.cwd || "/workspace";
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const error = err as { stderr?: Buffer; message?: string };
    const stderr = error.stderr?.toString() || error.message || "";
    throw new Error(`Git command failed: git ${args}\n${stderr}`);
  }
}

/**
 * Check if we're in a git repository
 */
export function isGitRepo(cwd: string = "/workspace"): boolean {
  try {
    git("rev-parse --git-dir", { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(cwd: string = "/workspace"): string {
  return git("rev-parse --abbrev-ref HEAD", { cwd });
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd: string = "/workspace"): boolean {
  const status = git("status --porcelain", { cwd });
  return status.length > 0;
}

/**
 * Stage a file
 */
export function stageFile(filePath: string, cwd: string = "/workspace"): void {
  git(`add "${filePath}"`, { cwd });
}

/**
 * Commit staged changes
 */
export function commit(message: string, cwd: string = "/workspace"): void {
  // Escape double quotes in the message
  const escapedMessage = message.replace(/"/g, '\\"');
  git(`commit -m "${escapedMessage}"`, { cwd });
}

/**
 * Push the current branch
 * Uses GITHUB_TOKEN for authentication
 */
export function push(cwd: string = "/workspace"): void {
  const branch = getCurrentBranch(cwd);
  const token = process.env.GITHUB_TOKEN;

  if (token) {
    // Get the remote URL and inject token for authentication
    const remoteUrl = git("remote get-url origin", { cwd });
    if (remoteUrl.includes("github.com") && !remoteUrl.includes("@")) {
      const authUrl = remoteUrl.replace(
        "https://github.com",
        `https://${token}@github.com`
      );
      // Push with -u to set upstream
      git(`push -u ${authUrl} ${branch}`, { cwd });
      return;
    }
  }

  git(`push -u origin ${branch}`, { cwd });
}

/**
 * Pull the latest changes
 */
export function pull(cwd: string = "/workspace"): void {
  git("pull", { cwd });
}

/**
 * Fetch from remote
 */
export function fetch(cwd: string = "/workspace"): void {
  git("fetch origin", { cwd });
}

/**
 * Create and checkout a new branch from a base
 */
export function createBranch(
  branchName: string,
  baseBranch: string,
  cwd: string = "/workspace"
): void {
  git(`checkout -b ${branchName} origin/${baseBranch}`, { cwd });
}

/**
 * Checkout an existing branch
 */
export function checkoutBranch(branchName: string, cwd: string = "/workspace"): void {
  git(`checkout ${branchName}`, { cwd });
}

/**
 * Check if a file exists in the repository
 */
export function fileExists(filePath: string, cwd: string = "/workspace"): boolean {
  try {
    git(`ls-files --error-unmatch "${filePath}"`, { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Commit and push a single file with a message
 * This is used by Green to update .ai/plan.md
 */
export function commitAndPushFile(
  filePath: string,
  message: string,
  cwd: string = "/workspace"
): void {
  log.info(`Committing ${filePath}: ${message}`);

  stageFile(filePath, cwd);

  if (!hasUncommittedChanges(cwd)) {
    log.info("No changes to commit");
    return;
  }

  commit(message, cwd);
  push(cwd);

  log.info(`Pushed ${filePath} to remote`);
}

/**
 * Ensure we're on the correct branch
 */
export function ensureBranch(
  targetBranch: string,
  cwd: string = "/workspace"
): void {
  const current = getCurrentBranch(cwd);
  if (current !== targetBranch) {
    log.info(`Switching from ${current} to ${targetBranch}`);
    fetch(cwd);
    try {
      checkoutBranch(targetBranch, cwd);
    } catch {
      // Branch might not exist locally, try to create from remote
      git(`checkout -b ${targetBranch} origin/${targetBranch}`, { cwd });
    }
  }
}
