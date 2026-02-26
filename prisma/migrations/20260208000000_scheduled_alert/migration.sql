-- §31.7 예약 리포트, §31.8 알림 룰(자동 급감 알림)
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "scheduled_report_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "auto_drop_alert" BOOLEAN NOT NULL DEFAULT false;
