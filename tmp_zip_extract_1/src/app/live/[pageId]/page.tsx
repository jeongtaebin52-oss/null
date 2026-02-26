import LiveView from "@/components/live-view";

export default async function LivePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <LiveView pageId={pageId} />;
}
