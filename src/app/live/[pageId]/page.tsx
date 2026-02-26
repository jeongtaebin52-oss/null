import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import LiveView from "@/components/live-view";
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
    select: { title: true, anon_number: true, snapshot_thumbnail: true, status: true, live_expires_at: true },
  });
  if (!page) return { title: "작품을 찾을 수 없습니다" };
  const now = new Date();
  const isLive = page.status === "live" && page.live_expires_at && page.live_expires_at > now;
  const title = page.title || `익명 작품 #${page.anon_number}`;
  const description = isLive ? "실시간으로 공개 중인 작품입니다." : "공개가 만료된 작품입니다.";
  const ogImage = page.snapshot_thumbnail ?? undefined;
  return {
    title: `${title} | NULL`,
    description,
    openGraph: {
      title: `${title} | NULL`,
      description,
      url: `${baseUrl}/live/${pageId}`,
      siteName: "NULL",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | NULL`,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function LivePage({
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
  return <LiveView pageId={pageId} />;
}
