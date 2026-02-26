-- §31.6 세그먼트: 생성/저장/공유·조건 빌더(AND/OR/NOT)
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Segment_page_id_idx" ON "Segment"("page_id");

ALTER TABLE "Segment" ADD CONSTRAINT "Segment_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
