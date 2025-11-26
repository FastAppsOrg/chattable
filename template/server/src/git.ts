import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Execute a shell command and return the result
 */
async function executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}\nStderr: ${error.stderr || ""}`);
  }
}

/**
 * Git status - Show the working tree status
 */
export async function gitStatus(): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand("git status");
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git add - Add files to staging area
 */
export async function gitAdd(files: string): Promise<CallToolResult> {
  try {
    const { stdout, stderr } = await executeCommand(`git add ${files}`);
    const message = stdout || stderr || `Successfully added: ${files}`;
    return {
      content: [{ type: "text", text: message }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git commit - Record changes to the repository
 */
export async function gitCommit(message: string): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git push - Update remote refs
 */
export async function gitPush(remote?: string, branch?: string): Promise<CallToolResult> {
  try {
    const command = remote && branch ? `git push ${remote} ${branch}` : "git push";
    const { stdout, stderr } = await executeCommand(command);
    const message = stdout || stderr;
    return {
      content: [{ type: "text", text: message }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git pull - Fetch from and integrate with another repository or local branch
 */
export async function gitPull(remote?: string, branch?: string): Promise<CallToolResult> {
  try {
    const command = remote && branch ? `git pull ${remote} ${branch}` : "git pull";
    const { stdout, stderr } = await executeCommand(command);
    const message = stdout || stderr;
    return {
      content: [{ type: "text", text: message }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git log - Show commit logs
 */
export async function gitLog(limit: number = 10): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand(`git log --oneline -n ${limit}`);
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git branch - List, create, or delete branches
 */
export async function gitBranch(action?: "list" | "create" | "delete", name?: string): Promise<CallToolResult> {
  try {
    let command = "git branch";

    if (action === "create" && name) {
      command = `git branch ${name}`;
    } else if (action === "delete" && name) {
      command = `git branch -d ${name}`;
    }

    const { stdout } = await executeCommand(command);
    return {
      content: [{ type: "text", text: stdout || `Branch operation completed: ${action} ${name || ""}` }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git checkout - Switch branches or restore working tree files
 */
export async function gitCheckout(branch: string, createNew: boolean = false): Promise<CallToolResult> {
  try {
    const command = createNew ? `git checkout -b ${branch}` : `git checkout ${branch}`;
    const { stdout, stderr } = await executeCommand(command);
    const message = stdout || stderr;
    return {
      content: [{ type: "text", text: message }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Git diff - Show changes between commits, commit and working tree, etc
 */
export async function gitDiff(file?: string): Promise<CallToolResult> {
  try {
    const command = file ? `git diff ${file}` : "git diff";
    const { stdout } = await executeCommand(command);
    return {
      content: [{ type: "text", text: stdout || "No changes detected" }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * GitHub CLI - Create a pull request
 */
export async function ghPrCreate(
  title: string,
  body?: string,
  draft: boolean = false,
): Promise<CallToolResult> {
  try {
    let command = `gh pr create --title "${title.replace(/"/g, '\\"')}"`;

    if (body) {
      command += ` --body "${body.replace(/"/g, '\\"')}"`;
    }

    if (draft) {
      command += " --draft";
    }

    const { stdout } = await executeCommand(command);
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * GitHub CLI - List pull requests
 */
export async function ghPrList(limit: number = 10, state: string = "open"): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand(`gh pr list --limit ${limit} --state ${state}`);
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * GitHub CLI - List issues
 */
export async function ghIssueList(limit: number = 10, state: string = "open"): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand(`gh issue list --limit ${limit} --state ${state}`);
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * GitHub CLI - View repository information
 */
export async function ghRepoView(): Promise<CallToolResult> {
  try {
    const { stdout } = await executeCommand("gh repo view");
    return {
      content: [{ type: "text", text: stdout }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}
