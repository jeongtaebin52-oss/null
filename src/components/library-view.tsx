"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Countdown from "@/components/countdown";
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

type TopElement = { element_id: string; count: number };

type LibraryResponse = {
  live: PageItem[];
  drafts: PageItem[];
  history: PageItem[];
  summary?: {
    today?: {
      visits?: number;
      clicks?: number | null;
      top_element_id?: string | null;
      top_elements?: TopElement[] | null;
      last_seen_at?: string | null;
    };
    plan?: { tier?: string; replay_enabled?: boolean };
  };
};

type SortOption = "recent" | "name";
type StatusFilter = "all" | "live" | "draft" | "expired";

function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  const diff = Date.now() - t;
  if (diff < 0) return "-";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export default function LibraryView() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const allWorks = useMemo(() => {
    if (!data) return [];
    const list = [
      ...data.live.map((p) => ({ ...p, _status: "live" as const })),
      ...data.drafts.map((p) => ({ ...p, _status: "draft" as const })),
      ...data.history.map((p) => ({ ...p, _status: "expired" as const })),
    ];
    const byStatus =
      statusFilter === "all"
        ? list
        : list.filter((p) => p._status === statusFilter);
    const q = searchQuery.trim().toLowerCase();
    const byQuery = q
      ? byStatus.filter(
          (p) =>
            (p.title ?? "").toLowerCase().includes(q) ||
            String(p.anon_number).includes(q)
        )
      : byStatus;
    const sorted = [...byQuery];
    if (sort === "name") {
      sorted.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", "ko")
      );
    } else {
      sorted.sort((a, b) => {
        const au = new Date(
          a._status === "live" ? a.live_expires_at ?? a.updated_at ?? 0 : a.updated_at ?? 0
        ).getTime();
        const bu = new Date(
          b._status === "live" ? b.live_expires_at ?? b.updated_at ?? 0 : b.updated_at ?? 0
        ).getTime();
        return bu - au;
      });
    }
    return sorted;
  }, [data, statusFilter, searchQuery, sort]);

  const fetchLibrary = useCallback(() => {
    const params = new URLSearchParams({ sort });
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/library?${params}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          window.location.href =
            "/login?next=" + encodeURIComponent("/library");
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
  }, [sort, statusFilter]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  async function publish(pageId: string) {
    setPublishingId(pageId);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/publish`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setMessage("재게시 완료");
        fetchLibrary();
      } else {
        setMessage(body?.error ?? "재게시 실패");
      }
    } finally {
      setPublishingId(null);
    }
  }

  async function duplicate(pageId: string) {
    setDuplicatingId(pageId);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.pageId) {
        setMessage("복제됨");
        fetchLibrary();
      } else {
        setMessage(body?.error ?? body?.message ?? "복제 실패");
      }
    } finally {
      setDuplicatingId(null);
    }
  }

  async function deployPage(pageId: string, deploy: boolean) {
    setDeployingId(pageId);
    setMessage(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deploy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data?.message as string) ?? "배포 처리 실패");
        return;
      }
      setMessage(deploy ? "배포되었습니다." : "배포가 취소되었습니다.");
      fetchLibrary();
    } catch {
      setMessage("배포 처리 실패");
    } finally {
      setDeployingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#111111]">
              내 작품
            </h1>
            <p className="mt-0.5 text-sm text-[#666666]">
              퍼블리시·배포한 작품을 한곳에서 관리하고, 작품별 대시보드에서 지표를 확인하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#FAFAFA]"
            >
              대시보드
            </Link>
            <a
              href="/editor/advanced"
              className="rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white hover:bg-[#333333]"
              style={{ color: "#ffffff" }}
            >
              새 작품 만들기
            </a>
          </div>
        </header>

        {/* Toolbar: search, filter, sort */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목·작품 번호 검색"
            className="w-full max-w-xs rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#999999] focus:border-[#111111] focus:outline-none"
            aria-label="검색"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "live", "draft", "expired"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-[#111111] text-white"
                    : "bg-white text-[#666666] hover:bg-[#F0F0F0]"
                }`}
              >
                {s === "all" ? "전체" : s === "live" ? "라이브" : s === "draft" ? "초안" : "만료"}
              </button>
            ))}
            <span className="text-[11px] text-[#999999]">|</span>
            <button
              type="button"
              onClick={() => setSort("recent")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                sort === "recent" ? "bg-[#111111] text-white" : "bg-white text-[#666666] hover:bg-[#F0F0F0]"
              }`}
            >
              최신순
            </button>
            <button
              type="button"
              onClick={() => setSort("name")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                sort === "name" ? "bg-[#111111] text-white" : "bg-white text-[#666666] hover:bg-[#F0F0F0]"
              }`}
            >
              이름순
            </button>
          </div>
        </div>

        {/* One-line summary (전체 or 라이브일 때만) */}
        {(statusFilter === "all" || statusFilter === "live") && data?.summary?.today && (
          <div className="mb-6 rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-xs text-[#666666]">
            오늘 방문 <strong className="text-[#111111]">{data.summary.today.visits ?? 0}</strong>
            {" · "}
            클릭 <strong className="text-[#111111]">
              {typeof data.summary.today.clicks === "number" ? data.summary.today.clicks : "-"}
            </strong>
            {" · "}
            마지막 활동 {formatLastSeen(data.summary.today.last_seen_at)}
          </div>
        )}

        {message && (
          <div
            className="mb-4 flex items-center gap-2 rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-sm text-[#666666]"
            role="status"
            aria-live="polite"
          >
            {message}
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                fetchLibrary();
              }}
              className="rounded-lg border border-[#111111] px-3 py-1 text-xs font-medium text-[#111111]"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Unified card grid */}
        {!data ? (
          <div className="flex justify-center py-16">
            <NullSpinner />
          </div>
        ) : allWorks.length === 0 ? (
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-12 text-center">
            <p className="text-[#666666]">
              {searchQuery.trim() ? "검색 결과가 없습니다." : "작품이 없습니다."}
            </p>
            {!searchQuery.trim() && (
              <a
                href="/editor/advanced"
                className="mt-4 inline-block rounded-xl bg-[#111111] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333]"
                style={{ color: "#ffffff" }}
              >
                새 작품 만들기
              </a>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allWorks.map((item) => (
              <li key={item.id} className="relative">
                <article className="flex overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex h-28 w-24 shrink-0 items-center justify-center bg-[#F5F5F5]">
                    {item.snapshot_thumbnail ? (
                      <img
                        src={item.snapshot_thumbnail}
                        alt={item.title || `익명 작품 #${item.anon_number}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-[#DDDDDD]" aria-hidden>◇</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-3 pr-3 pl-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[#111111]" title={item.title || `익명 작품 #${item.anon_number}`}>
                        {item.title || `익명 작품 #${item.anon_number}`}
                      </h2>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                          className="rounded-lg p-1 text-[#666666] hover:bg-[#F0F0F0] hover:text-[#111111]"
                          aria-label="더 보기"
                        >
                          ⋯
                        </button>
                        {openMenuId === item.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              aria-hidden
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-[#EAEAEA] bg-white py-1 shadow-lg">
                              <a
                                href={`/editor/advanced?pageId=${item.id}`}
                                className="block px-4 py-2 text-left text-xs text-[#111111] hover:bg-[#FAFAFA]"
                              >
                                에디터에서 수정
                              </a>
                              {item._status !== "live" && (
                                <button
                                  type="button"
                                  onClick={() => { publish(item.id); setOpenMenuId(null); }}
                                  disabled={publishingId === item.id}
                                  className="block w-full px-4 py-2 text-left text-xs text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-60"
                                >
                                  {publishingId === item.id ? "재게시 중…" : "재게시"}
                                </button>
                              )}
                              {item._status === "expired" && (
                                <button
                                  type="button"
                                  onClick={() => { duplicate(item.id); setOpenMenuId(null); }}
                                  disabled={duplicatingId === item.id}
                                  className="block w-full px-4 py-2 text-left text-xs text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-60"
                                >
                                  {duplicatingId === item.id ? "복제 중…" : "복제"}
                                </button>
                              )}
                              {item.deployed_at ? (
                                <button
                                  type="button"
                                  onClick={() => { deployPage(item.id, false); setOpenMenuId(null); }}
                                  disabled={deployingId === item.id}
                                  className="block w-full px-4 py-2 text-left text-xs text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-60"
                                >
                                  배포 취소
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { deployPage(item.id, true); setOpenMenuId(null); }}
                                  disabled={deployingId === item.id}
                                  className="block w-full px-4 py-2 text-left text-xs text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-60"
                                >
                                  {deployingId === item.id ? "배포 중…" : "배포"}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {item._status === "live" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
                          <span className="h-1 w-1 rounded-full bg-red-500" /> 라이브
                          {item.live_expires_at && (
                            <>
                              <span className="text-[#999999]">·</span>
                              <Countdown expiresAt={item.live_expires_at} />
                            </>
                          )}
                        </span>
                      )}
                      {item._status === "draft" && (
                        <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] font-medium text-[#666666]">초안</span>
                      )}
                      {item._status === "expired" && (
                        <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] font-medium text-[#666666]">만료</span>
                      )}
                      {item.deployed_at && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">배포됨</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#666666]">
                      방문 {item.total_visits} · 클릭 {item.total_clicks}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item._status === "live" && (
                        <a
                          href={`/live/${item.id}`}
                          className="rounded-lg bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333333]"
                          style={{ color: "#ffffff" }}
                        >
                          라이브 보기
                        </a>
                      )}
                      {item.deployed_at && (
                        <a
                          href={`/p/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20"
                        >
                          배포 URL
                        </a>
                      )}
                      {!item.deployed_at && item._status !== "live" && (
                        <button
                          type="button"
                          onClick={() => deployPage(item.id, true)}
                          disabled={deployingId === item.id}
                          className="rounded-lg border border-[#3B82F6] bg-[#3B82F6]/10 px-3 py-1.5 text-xs font-medium text-[#2563eb] hover:bg-[#3B82F6]/20 disabled:opacity-60"
                        >
                          {deployingId === item.id ? "배포 중…" : "배포"}
                        </button>
                      )}
                      <Link
                        href={`/dashboard/${item.id}`}
                        className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#111111] hover:bg-[#FAFAFA]"
                      >
                        대시보드
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
