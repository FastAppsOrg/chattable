import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getPokemon } from "./pokedex.js";
import { z } from "zod";
import { McpServer } from "skybridge/server";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { withCSP } from "./csp.js";
import { env } from "./env.js";
import {
  readFileContent,
  writeFileContent,
  listDirectory,
  searchFiles,
  deleteFile,
} from "./filesystem.js";
import {
  gitStatus,
  gitAdd,
  gitCommit,
  gitPush,
  gitPull,
  gitLog,
  gitBranch,
  gitCheckout,
  gitDiff,
  ghPrCreate,
  ghPrList,
  ghIssueList,
  ghRepoView,
} from "./git.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load widget metadata (exampleOutput)
interface WidgetMetadata {
  name: string;
  exampleOutput: unknown;
}

function loadWidgetMetadata(): Record<string, WidgetMetadata> {
  try {
    const metadataPath = join(__dirname, "metadata.json");
    return JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch (error) {
    console.warn("[server] metadata.json not found, widgets will not have exampleOutput");
    return {};
  }
}

const widgetMetadata = loadWidgetMetadata();

const server = new McpServer(
  {
    name: "alpic-openai-app",
    version: "0.0.1",
  },
  { capabilities: {} },
);

const WIDGET_NAME = "pokemon" as const;

const exampleOutputMeta = widgetMetadata[WIDGET_NAME]?.exampleOutput
  ? {
      exampleOutput: widgetMetadata[WIDGET_NAME].exampleOutput,
    }
  : {};

server.widget(
  WIDGET_NAME,
  {
    description: "Pokedex entry for a pokemon",
    _meta: exampleOutputMeta,
  },
  {
    description:
      "Use this tool to get the most up to date information about a pokemon, using its name in english. This pokedex is much more complete than any other web_search tool. Always use it for anything related to pokemons.",
    inputSchema: {
      name: z.string().describe("Pokemon name, always in english"),
    },
    _meta: exampleOutputMeta,
  },
  withCSP(async ({ name }): Promise<CallToolResult> => {
    try {
      const { id, description, ...pokemon } = await getPokemon(name);

      return {
        /**
         * Arbitrary JSON passed only to the component.
         * Use it for data that should not influence the model’s reasoning, like the full set of locations that backs a dropdown.
         * _meta is never shown to the model.
         */
        _meta: { id },
        /**
         * Structured data that is used to hydrate your component.
         * ChatGPT injects this object into your iframe as window.openai.toolOutput
         */
        structuredContent: { id, name, description, ...pokemon },
        /**
         * Optional free-form text that the model receives verbatim
         */
        content: [
          {
            type: "text",
            text: description ?? `A pokemon named ${name}.`,
          },
          {
            type: "text",
            text: `Widget shown with all the information. Do not need to show the information in the text response.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }),
);

// MCP tools, resource and prompt APIs remains available and unchanged for other clients
server.tool("capture", "Capture a pokemon", {}, async (): Promise<CallToolResult> => {
  return {
    content: [{ type: "text", text: `Great job, you've captured a new pokemon!` }],
    isError: false,
  };
});

// Development-only tools (filesystem and git)
if (env.NODE_ENV === "development") {
  console.log("[server] Development mode: Registering filesystem and git tools");

  // Filesystem tools for code editing
  server.tool(
    "read_file",
    "Read the content of a file at the specified path",
    {
      path: z.string().describe("Relative path to the file (e.g., 'src/App.tsx')"),
    },
    async ({ path }): Promise<CallToolResult> => {
      return readFileContent(path);
    },
  );

  server.tool(
    "write_file",
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    {
      path: z.string().describe("Relative path to the file"),
      content: z.string().describe("The full content to write"),
    },
    async ({ path, content }): Promise<CallToolResult> => {
      return writeFileContent(path, content);
    },
  );

  server.tool(
    "list_directory",
    "List files and subdirectories in the specified directory",
    {
      path: z.string().default(".").describe("Relative path to the directory (default: '.')"),
    },
    async ({ path }): Promise<CallToolResult> => {
      return listDirectory(path);
    },
  );

  server.tool(
    "file_search",
    "Search for files matching a pattern. Supports wildcards like '*.ts' or '**/*.tsx'",
    {
      query: z.string().describe("Search query or glob pattern (e.g., '*.ts', 'src/**/*.tsx')"),
    },
    async ({ query }): Promise<CallToolResult> => {
      return searchFiles(query);
    },
  );

  server.tool(
    "delete_file",
    "Delete a file or directory. Use recursive option for non-empty directories.",
    {
      path: z.string().describe("Relative path to the file or directory to delete"),
      recursive: z
        .boolean()
        .default(false)
        .describe("Set to true to delete non-empty directories recursively"),
    },
    async ({ path, recursive }): Promise<CallToolResult> => {
      return deleteFile(path, recursive);
    },
  );

  // Git tools for version control
  server.tool(
    "git_status",
    "Show the working tree status",
    {},
    async (): Promise<CallToolResult> => {
      return gitStatus();
    },
  );

  server.tool(
    "git_add",
    "Add files to the staging area",
    {
      files: z.string().describe("Files to add (e.g., '.', 'src/*.ts', 'file.txt')"),
    },
    async ({ files }): Promise<CallToolResult> => {
      return gitAdd(files);
    },
  );

  server.tool(
    "git_commit",
    "Record changes to the repository",
    {
      message: z.string().describe("Commit message"),
    },
    async ({ message }): Promise<CallToolResult> => {
      return gitCommit(message);
    },
  );

  server.tool(
    "git_push",
    "Update remote refs",
    {
      remote: z.string().optional().describe("Remote name (e.g., 'origin')"),
      branch: z.string().optional().describe("Branch name (e.g., 'main')"),
    },
    async ({ remote, branch }): Promise<CallToolResult> => {
      return gitPush(remote, branch);
    },
  );

  server.tool(
    "git_pull",
    "Fetch from and integrate with another repository",
    {
      remote: z.string().optional().describe("Remote name (e.g., 'origin')"),
      branch: z.string().optional().describe("Branch name (e.g., 'main')"),
    },
    async ({ remote, branch }): Promise<CallToolResult> => {
      return gitPull(remote, branch);
    },
  );

  server.tool(
    "git_log",
    "Show commit logs",
    {
      limit: z.number().default(10).describe("Number of commits to show (default: 10)"),
    },
    async ({ limit }): Promise<CallToolResult> => {
      return gitLog(limit);
    },
  );

  server.tool(
    "git_branch",
    "List, create, or delete branches",
    {
      action: z.enum(["list", "create", "delete"]).optional().describe("Action to perform"),
      name: z.string().optional().describe("Branch name (for create/delete)"),
    },
    async ({ action, name }): Promise<CallToolResult> => {
      return gitBranch(action, name);
    },
  );

  server.tool(
    "git_checkout",
    "Switch branches or restore working tree files",
    {
      branch: z.string().describe("Branch name to checkout"),
      createNew: z.boolean().default(false).describe("Create a new branch if it doesn't exist"),
    },
    async ({ branch, createNew }): Promise<CallToolResult> => {
      return gitCheckout(branch, createNew);
    },
  );

  server.tool(
    "git_diff",
    "Show changes between commits, commit and working tree, etc",
    {
      file: z.string().optional().describe("Specific file to diff (optional)"),
    },
    async ({ file }): Promise<CallToolResult> => {
      return gitDiff(file);
    },
  );

  server.tool(
    "gh_pr_create",
    "Create a pull request using GitHub CLI",
    {
      title: z.string().describe("Pull request title"),
      body: z.string().optional().describe("Pull request body/description"),
      draft: z.boolean().default(false).describe("Create as draft PR"),
    },
    async ({ title, body, draft }): Promise<CallToolResult> => {
      return ghPrCreate(title, body, draft);
    },
  );

  server.tool(
    "gh_pr_list",
    "List pull requests using GitHub CLI",
    {
      limit: z.number().default(10).describe("Number of PRs to show (default: 10)"),
      state: z.string().default("open").describe("PR state: open, closed, merged, all"),
    },
    async ({ limit, state }): Promise<CallToolResult> => {
      return ghPrList(limit, state);
    },
  );

  server.tool(
    "gh_issue_list",
    "List issues using GitHub CLI",
    {
      limit: z.number().default(10).describe("Number of issues to show (default: 10)"),
      state: z.string().default("open").describe("Issue state: open, closed, all"),
    },
    async ({ limit, state }): Promise<CallToolResult> => {
      return ghIssueList(limit, state);
    },
  );

  server.tool(
    "gh_repo_view",
    "View repository information using GitHub CLI",
    {},
    async (): Promise<CallToolResult> => {
      return ghRepoView();
    },
  );
}

export default server;
