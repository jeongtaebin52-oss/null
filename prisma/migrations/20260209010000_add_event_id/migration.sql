-- Add event_id for idempotency
ALTER TABLE "Event" ADD COLUMN "event_id" TEXT;
CREATE UNIQUE INDEX "Event_event_id_key" ON "Event"("event_id");
