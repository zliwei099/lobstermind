import { createApp } from "./app.ts";
import { createHttpServer } from "./server.ts";
import { createFeishuLongConnectionSession } from "./integrations/feishu/long-connection.ts";

async function main(): Promise<void> {
  const app = createApp();
  let httpServer: ReturnType<typeof createHttpServer> | undefined;

  if (app.config.httpEnabled) {
    httpServer = createHttpServer(app);
    httpServer.server.listen(httpServer.config.port, httpServer.config.host, () => {
      console.log(`HTTP server listening on http://${httpServer?.config.host}:${httpServer?.config.port}`);
    });
  }

  if (app.config.feishuMode === "long-connection" || app.config.feishuMode === "hybrid") {
    const session = createFeishuLongConnectionSession(app.config, app.agent);
    console.log(
      `Feishu runtime: mode=${app.config.feishuLongConnectionMode}, adapter=${app.config.feishuLongConnectionAdapter}`
    );
    await session.start();

    const stop = async () => {
      await session.stop();
      httpServer?.server.close();
      process.exit(0);
    };

    process.on("SIGINT", () => {
      void stop();
    });
    process.on("SIGTERM", () => {
      void stop();
    });
    return;
  }

  if (!httpServer) {
    console.log("No runtime enabled. Set LOBSTERMIND_HTTP_ENABLED=true or enable a Feishu mode.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
