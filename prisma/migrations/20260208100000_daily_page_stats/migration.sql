-- §31.10 집계 데이터 분리: 일별 요약
CREATE TABLE "DailyPageStats" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPageStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyPageStats_page_id_date_key" ON "DailyPageStats"("page_id", "date");

CREATE INDEX "DailyPageStats_page_id_idx" ON "DailyPageStats"("page_id");

ALTER TABLE "DailyPageStats" ADD CONSTRAINT "DailyPageStats_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
