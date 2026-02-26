import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import WorkView from "@/components/work-view";
import { getBaseUrl } from "@/lib/url";
import { NullLoadingScreen } from "@/components/null-spinner";

const baseUrl = getBaseUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageId: string }>;
}): Promise<Metadata> {
  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { title: true, anon_number: true, snapshot_thumbnail: true, status: true, live_expires_at: true, deployed_at: true },
  });
  // /p/[pageId]는 배포된 페이지만 노출합니다.
  if (!page || page.deployed_at == null) return { title: "작품을 찾을 수 없습니다" };
  const now = new Date();
  const isLive = page.status === "live" && page.live_expires_at && page.live_expires_at > now;
  const title = page.title || `익명 작품 #${page.anon_number}`;
  const description = isLive ? "실시간으로 공개 중인 작품입니다." : "";
  const ogImage = page.snapshot_thumbnail ?? undefined;
  return {
    title,
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      url: `${baseUrl}/p/${pageId}`,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description || undefined,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true, deployed_at: true },
  });
  // 배포 취소된 페이지는 404 처리합니다.
  if (!page || page.deployed_at == null) notFound();
  return (
    <Suspense fallback={<NullLoadingScreen label="페이지를 불러오는 중..." />}>
      <WorkView pageId={pageId} standalone />
    </Suspense>
  );
}
