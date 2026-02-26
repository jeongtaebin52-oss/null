"use client";

import { useEffect, useState } from "react";
import Countdown from "@/components/countdown";

type FeedItem = {
  id: string;
  title: string | null;
  anon_number: number;
  live_started_at: string;
  live_expires_at: string;
  total_visits: number;
  avg_duration_ms: number;
  total_clicks: number;
  upvote_count: number;
};

const tabs = [
  { id: "new", label: "신규" },
  { id: "popular", label: "인기" },
  { id: "time", label: "시간순" },
];

export default function Feed() {
  const [tab, setTab] = useState("new");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/feed?tab=${tab}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-sm">
          <a href="/" className="text-lg font-semibold">
            NULL
          </a>
          <nav className="flex items-center gap-2 rounded-full border border-neutral-200 px-2 py-1 text-xs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-3 py-1 ${
                  tab === item.id ? "bg-neutral-900 text-white" : "text-neutral-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/account"
              className="rounded-full border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700"
            >
              계정
            </a>
            <a
              href="/editor"
              className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
            >
              <PlusIcon />
              만들기
            </a>
            <a
              href="/library"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200"
              aria-label="내 라이브러리"
            >
              <FolderIcon />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-xs text-neutral-500">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-neutral-200 bg-white p-8 text-sm text-neutral-500">
            아직 공개된 작품이 없습니다.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col rounded-[14px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                    <span className="font-medium">라이브</span>
                    <span className="font-medium">{item.title || `익명 작품 #${item.anon_number}`}</span>
                  </div>
                  <span className="rounded-full border border-neutral-200 px-2 py-1">
                    <Countdown expiresAt={item.live_expires_at} />
                  </span>
                </div>
                <div className="flex-1 px-4 py-4">
                  <div className="flex h-40 items-center justify-center rounded-[12px] border border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
                    캔버스 미리보기
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                    <MetricPill label="관객" value={item.total_visits} />
                    <MetricPill label="평균 체류" value={`${Math.round(item.avg_duration_ms / 1000)}s`} />
                    <MetricPill label="클릭" value={item.total_clicks} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs">
                  <a href={`/p/${item.id}`} className="flex items-center gap-1 text-neutral-900">
                    <ArrowIcon />
                    보러가기
                  </a>
                  <button type="button" className="flex items-center gap-1 text-neutral-600">
                    <ThumbIcon />
                    {item.upvote_count}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-full border border-neutral-200 px-2 py-1">
      {label} {value}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7.5h6l2 2H21v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5z" />
      <path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ThumbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3z" />
      <path d="M7 10l4.5-6.5a2 2 0 0 1 3.7 1.1L14 10h5a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
