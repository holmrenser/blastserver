-- Track when a worker picks a job up. Lets /api/queue derive
-- waiting/active/completed/failed counts straight from these tables, so the
-- queue-status read path no longer depends on the queue backend.
ALTER TABLE "blastjob" ADD COLUMN "started" TIMESTAMP(3);
ALTER TABLE "download" ADD COLUMN "started" TIMESTAMP(3);
