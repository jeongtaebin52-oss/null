-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."DataCollection" DROP CONSTRAINT "DataCollection_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."DataEntry" DROP CONSTRAINT "DataEntry_collection_id_fkey";

-- AlterTable
ALTER TABLE "public"."Page" ADD COLUMN     "collab_invite_code" TEXT,
ADD COLUMN     "collab_invite_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collab_invite_updated_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."DataCollection";

-- DropTable
DROP TABLE "public"."DataEntry";

-- CreateTable
CREATE TABLE "public"."AppSecret" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppSession" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "app_user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppUser" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppWorkflow" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppWorkflowLog" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "AppWorkflowLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppSecret_page_id_idx" ON "public"."AppSecret"("page_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AppSecret_page_id_key_key" ON "public"."AppSecret"("page_id" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "AppSession_app_user_id_idx" ON "public"."AppSession"("app_user_id" ASC);

-- CreateIndex
CREATE INDEX "AppSession_token_idx" ON "public"."AppSession"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AppSession_token_key" ON "public"."AppSession"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_page_id_email_key" ON "public"."AppUser"("page_id" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "AppUser_page_id_idx" ON "public"."AppUser"("page_id" ASC);

-- CreateIndex
CREATE INDEX "AppWorkflow_page_id_idx" ON "public"."AppWorkflow"("page_id" ASC);

-- CreateIndex
CREATE INDEX "AppWorkflowLog_page_id_idx" ON "public"."AppWorkflowLog"("page_id" ASC);

-- CreateIndex
CREATE INDEX "AppWorkflowLog_workflow_id_idx" ON "public"."AppWorkflowLog"("workflow_id" ASC);

-- CreateIndex
CREATE INDEX "Event_page_id_live_session_id_type_idx" ON "public"."Event"("page_id" ASC, "live_session_id" ASC, "type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Page_collab_invite_code_key" ON "public"."Page"("collab_invite_code" ASC);

-- CreateIndex
CREATE INDEX "PageVersion_page_id_created_at_idx" ON "public"."PageVersion"("page_id" ASC, "created_at" ASC);

-- AddForeignKey
ALTER TABLE "public"."AppSecret" ADD CONSTRAINT "AppSecret_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppSession" ADD CONSTRAINT "AppSession_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppSession" ADD CONSTRAINT "AppSession_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppUser" ADD CONSTRAINT "AppUser_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppWorkflow" ADD CONSTRAINT "AppWorkflow_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

