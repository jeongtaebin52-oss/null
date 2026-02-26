-- DropForeignKey
ALTER TABLE "DataCollection" DROP CONSTRAINT "DataCollection_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "DataEntry" DROP CONSTRAINT "DataEntry_collection_id_fkey";

-- AddForeignKey
ALTER TABLE "DataCollection" ADD CONSTRAINT "DataCollection_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataEntry" ADD CONSTRAINT "DataEntry_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "DataCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
