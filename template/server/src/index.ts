import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

import { env } from "./env.js";
import { mcp } from "./middleware.js";
import server from "./server.js";
import { widgetsDevServer } from "skybridge/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express() as Express;

  app.use(express.json());

  // MCP endpoint must be registered first
  app.use(mcp(server));

  // Mount Vite dev server in development mode
  if (env.NODE_ENV !== "production") {
    const viteRouter = await widgetsDevServer();
    app.use(viteRouter);
  }

  // Serve static files from dist in production
  const webDistPath = path.resolve(__dirname, "assets");
  app.use("/assets", express.static(webDistPath));

  app.listen(env.PORT, (error) => {
    if (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }

    console.log(`Server listening on port ${env.PORT}`);
    console.log(`MCP endpoint: http://localhost:${env.PORT}/mcp`);
  });

  process.on("SIGINT", async () => {
    console.log("Server shutdown complete");
    process.exit(0);
  });
}

startServer();
