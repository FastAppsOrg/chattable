import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, readdir, mkdir, stat, rm } from "fs/promises";
import { join, resolve, dirname, relative, sep } from "path";

/**
 * The root directory for all filesystem operations.
 * All paths will be resolved relative to this directory.
 */
const PROJECT_ROOT = process.cwd();

/**
 * Security helper to prevent directory traversal attacks.
 * Ensures that the resolved path stays within the project root.
 *
 * @param relativePath - User-provided path (can be relative or absolute)
 * @returns Absolute path within the project root
 * @throws Error if the path tries to escape the project root
 */
export function safePath(relativePath: string): string {
  const resolved = resolve(PROJECT_ROOT, relativePath);

  // Ensure the resolved path starts with the project root
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error("Access denied: Path outside project root");
  }

  return resolved;
}

/**
 * Read the content of a file at the specified path.
 */
export async function readFileContent(path: string): Promise<CallToolResult> {
  try {
    const filePath = safePath(path);
    const content = await readFile(filePath, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error reading file: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Write content to a file at the specified path.
 * Creates the file if it doesn't exist, overwrites if it does.
 * Automatically creates parent directories as needed.
 */
export async function writeFileContent(
  path: string,
  content: string,
): Promise<CallToolResult> {
  try {
    const filePath = safePath(path);

    // Create parent directories if they don't exist
    await mkdir(dirname(filePath), { recursive: true });

    // Write the file
    await writeFile(filePath, content, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: `Successfully wrote to ${path}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error writing file: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * List files and directories in the specified directory.
 */
export async function listDirectory(path: string = "."): Promise<CallToolResult> {
  try {
    const dirPath = safePath(path);
    const entries = await readdir(dirPath, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(dirPath, entry.name);
        try {
          const stats = await stat(fullPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } catch {
          // If we can't stat the file, return basic info
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
          };
        }
      }),
    );

    // Sort: directories first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(files, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error listing directory: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Recursively search for files matching a pattern.
 * Supports simple glob patterns like "*.ts" or "src/**\/*.tsx"
 */
async function searchFilesRecursive(
  dir: string,
  pattern: string,
  results: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(PROJECT_ROOT, fullPath);

      // Skip node_modules, .git, and other common directories
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === ".next" ||
        entry.name === "build"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await searchFilesRecursive(fullPath, pattern, results);
      } else {
        // Simple pattern matching
        if (matchesPattern(relativePath, pattern)) {
          results.push(relativePath);
        }
      }
    }

    return results;
  } catch (error) {
    // Silently skip directories we can't read
    return results;
  }
}

/**
 * Simple pattern matching for file search.
 * Supports:
 * - Exact matches: "src/index.ts"
 * - Wildcards: "*.ts", "src/*.ts"
 * - Glob-like: "**\/*.ts" (any .ts file in any subdirectory)
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "(.*/)?")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Search for files matching a query pattern.
 */
export async function searchFiles(query: string): Promise<CallToolResult> {
  try {
    const results = await searchFilesRecursive(PROJECT_ROOT, query);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No files found matching pattern: ${query}`,
          },
        ],
        isError: false,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} file(s):\n${results.join("\n")}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error searching files: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Delete a file or directory at the specified path.
 * For directories, use recursive option to delete non-empty directories.
 */
export async function deleteFile(
  path: string,
  recursive: boolean = false,
): Promise<CallToolResult> {
  try {
    const filePath = safePath(path);

    // Check if the path exists
    try {
      const stats = await stat(filePath);

      // Delete the file or directory
      await rm(filePath, { recursive, force: false });

      const itemType = stats.isDirectory() ? "directory" : "file";
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted ${itemType}: ${path}`,
          },
        ],
        isError: false,
      };
    } catch (statError: any) {
      if (statError.code === "ENOENT") {
        return {
          content: [
            {
              type: "text",
              text: `File or directory not found: ${path}`,
            },
          ],
          isError: true,
        };
      }
      throw statError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error deleting file: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
