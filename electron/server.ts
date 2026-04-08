import { spawn, execSync, type ChildProcess } from "child_process";
import path from "path";
import net from "net";
import { app } from "electron";

function getNodePath(): string {
  // In packaged mode, use the system Node.js since Electron's binary
  // with ELECTRON_RUN_AS_NODE has issues with native modules
  if (app.isPackaged) {
    try {
      const nodePath = execSync("where node", { encoding: "utf-8" }).trim().split("\n")[0].trim();
      if (nodePath) return nodePath;
    } catch {
      // Fall through
    }
  }
  // In dev mode, use the current process (Electron with ELECTRON_RUN_AS_NODE)
  return process.execPath;
}

let serverProcess: ChildProcess | null = null;
let serverPort: number = 0;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find free port"));
      }
    });
    server.on("error", reject);
  });
}

async function waitForServer(port: number, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok || response.status === 404) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

export async function startServer(standaloneDir: string): Promise<number> {
  serverPort = await findFreePort();

  const serverJs = path.join(standaloneDir, "server.js");

  const nodePath = getNodePath();
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(serverPort),
    HOSTNAME: "localhost",
  };

  // Only set ELECTRON_RUN_AS_NODE when using the Electron binary
  if (!app.isPackaged) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  serverProcess = spawn(nodePath, [serverJs], {
    env,
    cwd: standaloneDir,
    stdio: "pipe",
  });

  serverProcess.on("error", (err: Error) => {
    console.error("Next.js server error:", err);
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[next]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error("[next]", data.toString().trim());
  });

  await waitForServer(serverPort);
  return serverPort;
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

export function isServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

export function getServerPort(): number {
  return serverPort;
}

export function onServerExit(callback: (code: number | null) => void): void {
  if (serverProcess) {
    serverProcess.on("exit", callback);
  }
}

export async function restartServer(standaloneDir: string): Promise<number> {
  stopServer();
  return startServer(standaloneDir);
}

export async function connectToDevServer(port: number): Promise<number> {
  serverPort = port;
  await waitForServer(port);
  return port;
}
