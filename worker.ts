import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { executeAutomation } from "./lib/automation-engine";
import { logger } from "./lib/logger";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

logger.info("Starting Automation Worker...");

const worker = new Worker(
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
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed successfully");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Shutting down worker...");
  await worker.close();
  process.exit(0);
});
