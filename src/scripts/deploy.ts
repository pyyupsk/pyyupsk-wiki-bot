import { logger } from "../lib/logger";
import { syncCommands } from "../services/deploy";

const [err] = await syncCommands(true);
if (err) {
  logger.error("deploy failed", { err: err.message });
  process.exit(1);
}
