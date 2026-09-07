import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../lib/logger";
import { processMailFetchJob } from "../lib/mail-fetch-processor";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

logger.info("Starting Mail Fetch Worker...");

export const mailWorker = new Worker(
  "mail-fetch-queue",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Processing mail fetch job");
    await processMailFetchJob(job.data);
  },
  {
    connection,
    concurrency: 4,
  },
);

mailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Mail fetch job completed successfully");
});

mailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Mail fetch job failed");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down mail worker...");
  await mailWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Shutting down mail worker...");
  await mailWorker.close();
  process.exit(0);
});
