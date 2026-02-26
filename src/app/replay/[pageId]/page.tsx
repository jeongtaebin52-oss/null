import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ReplayView from "@/components/replay-view";
import { getBaseUrl } from "@/lib/url";

const baseUrl = getBaseUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageId: string }>;
}): Promise<Metadata> {
  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { title: true, anon_number: true, snapshot_thumbnail: true },
  });
  if (!page) return { title: "리플레이를 찾을 수 없습니다" };
  const title = page.title || `게스트 페이지 #${page.anon_number}`;
  const description = "24시간 리플레이로 과거 동작을 다시 볼 수 있습니다.";
  const ogImage = page.snapshot_thumbnail ?? undefined;
  return {
    title: `${title} 리플레이 | NULL`,
    description,
    openGraph: {
      title: `${title} 리플레이 | NULL`,
      description,
      url: `${baseUrl}/replay/${pageId}`,
      siteName: "NULL",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} 리플레이 | NULL`,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true },
  });
  if (!page) notFound();
  return <ReplayView pageId={pageId} />;
}
