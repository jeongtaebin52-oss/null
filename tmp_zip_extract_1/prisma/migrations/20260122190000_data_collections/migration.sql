-- CreateTable
CREATE TABLE "DataCollection" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataEntry" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataCollection_owner_id_slug_key" ON "DataCollection"("owner_id", "slug");

-- CreateIndex
CREATE INDEX "DataCollection_owner_id_updated_at_idx" ON "DataCollection"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "DataEntry_collection_id_created_at_idx" ON "DataEntry"("collection_id", "created_at");

-- AddForeignKey
ALTER TABLE "DataCollection" ADD CONSTRAINT "DataCollection_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataEntry" ADD CONSTRAINT "DataEntry_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "DataCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
