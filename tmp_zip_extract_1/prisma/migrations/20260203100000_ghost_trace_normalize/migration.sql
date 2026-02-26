-- GhostTrace 정규화: trace_json 제거, GhostPoint 테이블 + clicks 컬럼 추가
-- Step 3 (EXECUTION_ORDER)

-- 1. GhostPoint 테이블 생성
CREATE TABLE "GhostPoint" (
    "id" TEXT NOT NULL,
    "ghost_trace_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "t" DOUBLE PRECISION NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhostPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GhostPoint_ghost_trace_id_seq_idx" ON "GhostPoint"("ghost_trace_id", "seq");

ALTER TABLE "GhostPoint" ADD CONSTRAINT "GhostPoint_ghost_trace_id_fkey" FOREIGN KEY ("ghost_trace_id") REFERENCES "GhostTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. GhostTrace에 clicks 컬럼 추가
ALTER TABLE "GhostTrace" ADD COLUMN "clicks" JSONB;

-- 3. trace_json 컬럼 제거 (기존 ghost 데이터는 미이전 시 유실됨)
ALTER TABLE "GhostTrace" DROP COLUMN IF EXISTS "trace_json";
