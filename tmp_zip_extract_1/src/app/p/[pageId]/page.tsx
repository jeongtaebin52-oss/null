import { Suspense } from "react";
import WorkView from "@/components/work-view";

export default async function WorkPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <WorkView pageId={pageId} />
    </Suspense>
  );
}
