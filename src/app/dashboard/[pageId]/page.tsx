import DashboardWorkView from "@/components/dashboard-work-view";

type Params = { pageId: string };

export default async function DashboardWorkPage({ params }: { params: Promise<Params> }) {
  const { pageId } = await params;
  return <DashboardWorkView pageId={pageId} />;
}
