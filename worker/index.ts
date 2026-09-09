import "dotenv/config";
import { logger } from "../lib/logger";
import { automationWorker } from "./automation-worker";
import { mailWorker } from "./mail-worker";

logger.info("All background workers started (automation-queue & mail-fetch-queue)");

export { automationWorker, mailWorker };
