-- CreateTable
CREATE TABLE "PageSetting" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageNotification" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "recipient_anon_id" TEXT,
    "type" TEXT NOT NULL,
    "ref_id" TEXT,
    "title" TEXT,
    "body" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallState" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageSetting_page_id_key_key" ON "PageSetting"("page_id", "key");

-- CreateIndex
CREATE INDEX "PageSetting_page_id_idx" ON "PageSetting"("page_id");

-- CreateIndex
CREATE INDEX "PageNotification_page_id_recipient_user_id_read_at_idx" ON "PageNotification"("page_id", "recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "PageNotification_page_id_recipient_anon_id_read_at_idx" ON "PageNotification"("page_id", "recipient_anon_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "CallState_page_id_participant_id_key" ON "CallState"("page_id", "participant_id");

-- CreateIndex
CREATE INDEX "CallState_page_id_idx" ON "CallState"("page_id");

-- AddForeignKey
ALTER TABLE "PageSetting" ADD CONSTRAINT "PageSetting_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageNotification" ADD CONSTRAINT "PageNotification_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallState" ADD CONSTRAINT "CallState_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
