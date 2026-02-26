/*
  Warnings:

  - You are about to drop the column `created_at` on the `AppRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AppCollection" ADD COLUMN     "strict" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AppRecord" DROP COLUMN "created_at";

-- CreateTable
CREATE TABLE "PageDomain" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "force_https" BOOLEAN NOT NULL DEFAULT false,
    "redirect_www" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageDomain_domain_key" ON "PageDomain"("domain");

-- CreateIndex
CREATE INDEX "PageDomain_page_id_idx" ON "PageDomain"("page_id");

-- AddForeignKey
ALTER TABLE "PageDomain" ADD CONSTRAINT "PageDomain_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
