import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { executeAutomation } from "../lib/automation-engine";
import { logger } from "../lib/logger";
import { db } from "../src";
import { automations } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { restoreAutomationSchedules } from "../lib/automation-schedules";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

logger.info("Starting Automation Worker...");

void db.query.automations.findMany({ where: eq(automations.enabled, true) })
  .then((items) => restoreAutomationSchedules(items.map((item) => ({ ...item, nodes: item.nodes as never[] }))))
  .then((results) => results.filter(Boolean).forEach((failure) => logger.error(failure, "Failed to restore automation schedule")))
  .catch((error) => logger.error({ error }, "Failed to restore automation schedules"));

export const automationWorker = new Worker(
  "automation-queue",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Processing job");
    if (job.name === "execute-automation") {
      const { automationId, triggerPayload } = job.data;

      // Inject jobId into the payload so the engine can log it
      triggerPayload.jobId = job.id;

      await executeAutomation(automationId, triggerPayload);
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 automations concurrently
  },
);

automationWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed successfully");
});

automationWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down worker...");
  await automationWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Shutting down worker...");
  await automationWorker.close();
  process.exit(0);
});
