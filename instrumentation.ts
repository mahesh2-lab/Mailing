export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkDependencyHealth } = await import("./lib/dependency-health");

  const maxRetries = Number(process.env.STARTUP_HEALTH_RETRIES ?? 5);
  const retryDelayMs = Number(process.env.STARTUP_HEALTH_RETRY_DELAY_MS ?? 1500);
  const timeoutMs = Number(process.env.STARTUP_HEALTH_TIMEOUT_MS ?? 6000);

  const services = await checkDependencyHealth({
    retries: maxRetries,
    retryDelayMs,
    timeoutMs,
    onRetry: (service, attempt, totalRetries, err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[startup-health] ${service}: attempt ${attempt}/${totalRetries} failed (${message}). Retrying in ${retryDelayMs}ms...`,
      );
    },
  });

  for (const service of services) {
    const retryInfo = service.retries ? ` (after ${service.retries} retries)` : "";
    const errorInfo = service.status === "error" && service.error ? `: ${service.error}` : "";
    console.info(`[startup-health] ${service.name}: ${service.status}${retryInfo}${errorInfo}`);
  }

  const failed = services.filter((service) => service.status !== "ok");

  if (failed.length) {
    throw new Error(
      `Startup dependency check failed: ${failed
        .map((service) => `${service.name}${service.error ? ` (${service.error})` : ""}`)
        .join(", ")}`,
    );
  }
}
