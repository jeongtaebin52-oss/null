-- DropForeignKey
ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_admin_id_fkey";

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
