-- Index tuning for events and sessions
CREATE INDEX "Event_page_id_type_ts_idx" ON "Event"("page_id", "type", "ts");
CREATE INDEX "LiveSession_page_id_ended_at_idx" ON "LiveSession"("page_id", "ended_at");
