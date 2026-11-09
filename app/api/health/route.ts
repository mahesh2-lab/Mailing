import { checkDependencyHealth } from "@/lib/dependency-health";

export const runtime = "nodejs";

export async function GET() {
  const services = await checkDependencyHealth();

  const healthy = services.every((service) => service.status === "ok");
  return Response.json(
    { status: healthy ? "ok" : "error", services, timestamp: new Date().toISOString() },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
