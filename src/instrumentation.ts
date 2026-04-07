export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWebSocketServer } = await import("@/lib/websocket");
    getWebSocketServer();

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();

    const { initLimitTracker } = await import("@/lib/limit-tracker");
    initLimitTracker();
  }
}
