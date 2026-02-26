import ReplayView from "@/components/replay-view";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <ReplayView pageId={pageId} />;
}
