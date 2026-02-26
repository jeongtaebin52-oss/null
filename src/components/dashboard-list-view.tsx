"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NullSpinner from "@/components/null-spinner";

type PageItem = {
  id: string;
  title: string | null;
  anon_number: number;
  status: "draft" | "live" | "expired";
  live_expires_at: string | null;
  deployed_at: string | null;
  total_visits: number;
  total_clicks: number;
  avg_duration_ms: number;
  snapshot_thumbnail?: string | null;
  updated_at?: string;
};

type LibraryResponse = {
  live: PageItem[];
  drafts: PageItem[];
  history: PageItem[];
};

/** §31 대시보드: 퍼블리시+배포 통합. 모든 작품을 한 목록에서 보고, 하나 골라 해당 작품 대시보드로. */
export default function DashboardListView() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/library?sort=recent", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login?next=" + encodeURIComponent("/dashboard");
          return null;
        }
        if (!res.ok) {
          setMessage("잠시 후 다시 시도해 주세요.");
          return null;
        }
        return res.json();
      })
      .then((payload) => {
        if (!payload) return;
        setData(payload);
        setMessage(null);
      })
      .catch(() => setMessage("잠시 후 다시 시도해 주세요."));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allWorks = data
    ? [
        ...data.live.map((p) => ({ ...p, _status: "live" as const })),
        ...data.drafts.map((p) => ({ ...p, _status: "draft" as const })),
        ...data.history.map((p) => ({ ...p, _status: "expired" as const })),
      ].sort((a, b) => {
        const au = new Date(a.status === "live" ? a.live_expires_at ?? a.updated_at ?? 0 : a.updated_at ?? 0).getTime();
        const bu = new Date(b.status === "live" ? b.live_expires_at ?? b.updated_at ?? 0 : b.updated_at ?? 0).getTime();
        return bu - au;
      })
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] transition hover:text-white"
          >
            <span aria-hidden>←</span> 라이브러리
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            대시보드
          </h1>
          <p className="mt-2 text-[15px] text-[#a3a3a3]">
            작품을 선택하면 해당 작품의 방문·클릭·체류 지표를 볼 수 있습니다.
          </p>
        </header>

        {message && (
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-[#a3a3a3]"
            role="status"
            aria-live="polite"
          >
            {message}
            <button
              type="button"
              onClick={() => { setMessage(null); fetchData(); }}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
            >
              다시 시도
            </button>
          </div>
        )}

        {!data ? (
          <div className="flex justify-center py-24">
            <NullSpinner />
          </div>
        ) : allWorks.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-center">
            <p className="text-[#737373]">작품이 없습니다.</p>
            <Link
              href="/library"
              className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-[#e5e5e5]"
            >
              라이브러리에서 작품 만들기
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allWorks.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard/${item.id}`}
                  className="group flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center bg-white/5">
                    {item.snapshot_thumbnail ? (
                      <img
                        src={item.snapshot_thumbnail}
                        alt={item.title || `익명 작품 #${item.anon_number}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl text-white/10" aria-hidden>◇</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 px-4 py-4">
                    <p className="truncate font-medium text-white">
                      {item.title || `익명 작품 #${item.anon_number}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item._status} deployed={!!item.deployed_at} />
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#737373]">
                      방문 {item.total_visits} · 클릭 {item.total_clicks}
                    </p>
                  </div>
                  <span className="self-center pr-4 text-white/20 transition group-hover:text-white/50" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, deployed }: { status: "live" | "draft" | "expired"; deployed: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {status === "live" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> 라이브
        </span>
      )}
      {status === "draft" && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#a3a3a3]">
          초안
        </span>
      )}
      {status === "expired" && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#a3a3a3]">
          만료
        </span>
      )}
      {deployed && (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          배포됨
        </span>
      )}
    </span>
  );
}
