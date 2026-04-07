import { fork, type ChildProcess } from "child_process";
import path from "path";
import net from "net";

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

export async function startServer(appPath: string): Promise<number> {
  serverPort = await findFreePort();

  const serverJs = path.join(appPath, ".next", "standalone", "server.js");

  serverProcess = fork(serverJs, [], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOSTNAME: "localhost",
    },
    cwd: appPath,
    stdio: "pipe",
  });

  serverProcess.on("error", (err) => {
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

export async function restartServer(appPath: string): Promise<number> {
  stopServer();
  return startServer(appPath);
}

export async function connectToDevServer(port: number): Promise<number> {
  serverPort = port;
  await waitForServer(port);
  return port;
}
