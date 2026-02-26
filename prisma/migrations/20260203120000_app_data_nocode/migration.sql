-- CreateTable
CREATE TABLE "AppCollection" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRecord" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "collection_slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppCollection_page_id_slug_key" ON "AppCollection"("page_id", "slug");

-- CreateIndex
CREATE INDEX "AppCollection_page_id_idx" ON "AppCollection"("page_id");

-- CreateIndex
CREATE INDEX "AppRecord_page_id_collection_slug_idx" ON "AppRecord"("page_id", "collection_slug");

-- CreateIndex
CREATE INDEX "AppRecord_page_id_idx" ON "AppRecord"("page_id");

-- AddForeignKey
ALTER TABLE "AppCollection" ADD CONSTRAINT "AppCollection_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRecord" ADD CONSTRAINT "AppRecord_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRecord" ADD CONSTRAINT "AppRecord_page_id_collection_slug_fkey" FOREIGN KEY ("page_id", "collection_slug") REFERENCES "AppCollection"("page_id", "slug") ON DELETE CASCADE ON UPDATE CASCADE;
