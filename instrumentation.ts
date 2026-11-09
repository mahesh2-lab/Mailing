export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkDependencyHealth } = await import("./lib/dependency-health");
  const services = await checkDependencyHealth();
  const failed = services.filter((service) => service.status !== "ok");

  for (const service of services) {
    console.info(`[startup-health] ${service.name}: ${service.status}`);
  }

  if (failed.length) {
    throw new Error(
      `Startup dependency check failed: ${failed.map((service) => service.name).join(", ")}`,
    );
  }
}
