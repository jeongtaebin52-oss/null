"use client";

import { useEffect, useMemo, useState } from "react";
import Countdown from "@/components/countdown";

type PageItem = {
  id: string;
  title: string | null;
  anon_number: number;
  status: "draft" | "live" | "expired";
  live_expires_at: string | null;
  total_visits: number;
  total_clicks: number;
  avg_duration_ms: number;
};

type TopElement = {
  element_id: string;
  count: number;
};

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
    plan?: {
      tier?: string;
      replay_enabled?: boolean;
    };
  };
};

export default function LibraryView() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const replayEnabled = Boolean(data?.summary?.plan?.replay_enabled);

  const fetchLibrary = () => {
    fetch("/api/library")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!payload) return;
        setData(payload);
      })
      .catch(() => null);
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

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

  function shortId(value: string) {
    if (!value) return "-";
    if (value.length <= 10) return value;
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }

  async function publish(pageId: string) {
    const res = await fetch(`/api/pages/${pageId}/publish`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      setMessage("재게시 완료");
      fetchLibrary();
      return;
    }
    setMessage(body?.error ?? "재게시 실패");
  }

  const top3 = useMemo(() => {
    const arr = data?.summary?.today?.top_elements;
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 3);
  }, [data]);

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-semibold">내 라이브러리</div>
          <a
            href="/editor"
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
          >
            새 작품 만들기
          </a>
        </header>

        {message ? <div className="text-xs text-neutral-500">{message}</div> : null}

        {/* Recorder loop: today's footprint + incidents */}
        <section className="rounded-[14px] border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-600">오늘의 발자취</div>
            <div className="text-[11px] text-neutral-400">
              {data?.summary?.plan?.tier ? `플랜 ${String(data.summary.plan.tier).toUpperCase()}` : null}
            </div>
          </div>

          {!data ? (
            <div className="mt-2 text-xs text-neutral-400">로딩 중...</div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                <Metric label="오늘 방문" value={data.summary?.today?.visits ?? 0} />
                <Metric
                  label="오늘 클릭"
                  value={typeof data.summary?.today?.clicks === "number" ? data.summary?.today?.clicks : "-"}
                />
                <Metric label="마지막 목격" value={formatLastSeen(data.summary?.today?.last_seen_at)} />
                <Metric label="TOP 요소" value={data.summary?.today?.top_element_id ? shortId(data.summary?.today?.top_element_id) : "-"} />
              </div>

              {/* 사건(Top 3) : Pro에서만 노출 (events 저장 정책 준수) */}
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  이상 구간
                </div>

                {replayEnabled ? (
                  top3.length ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {top3.map((it, idx) => (
                        <div
                          key={`${it.element_id}_${idx}`}
                          className="flex items-center justify-between rounded-[12px] border border-neutral-200 px-3 py-2 text-[11px] text-neutral-700"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-neutral-200 px-2 py-[2px] text-[10px] text-neutral-500">
                              #{idx + 1}
                            </span>
                            <span className="font-medium">{shortId(it.element_id)}</span>
                          </div>
                          <div className="text-neutral-600">클릭 {it.count}</div>
                        </div>
                      ))}
                      <div className="mt-1 text-[11px] text-neutral-400">
                        TODO(정책확정 필요): element_id → 라벨/요소 타입 매핑(라벨 원문 저장 금지 정책 준수)
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-neutral-400">오늘 기록된 클릭 사건이 없습니다.</div>
                  )
                ) : (
                  <div className="mt-2 text-[11px] text-neutral-400">
                    Free 플랜은 클릭 이벤트를 저장하지 않습니다. (이상 구간은 Pro에서만)
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* LIVE */}
        <section className="rounded-[14px] border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600">현재 라이브</div>
          {!data ? (
            <div className="mt-2 text-xs text-neutral-400">로딩 중...</div>
          ) : data.live?.length ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {data.live.map((item) => (
                <div key={item.id} className="rounded-[14px] border border-neutral-200 p-4">
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="font-medium">라이브</span>
                      <span className="font-medium">{item.title || `익명 작품 #${item.anon_number}`}</span>
                    </div>
                    {item.live_expires_at ? <Countdown expiresAt={item.live_expires_at} /> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                    <Metric label="관객(누적)" value={item.total_visits} />
                    <Metric label="평균 체류" value={`${Math.round(item.avg_duration_ms / 1000)}s`} />
                    <Metric label="클릭(누적)" value={item.total_clicks} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <a href={`/p/${item.id}`} className="rounded-full border border-neutral-900 px-3 py-1 text-xs">
                      작품 보기
                    </a>
                    <a
                      href={`/editor?pageId=${item.id}`}
                      className="rounded-full border border-neutral-200 px-3 py-1 text-xs"
                    >
                      수정
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-neutral-400">라이브 작품이 없습니다.</div>
          )}
        </section>

        {/* Drafts / History */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[14px] border border-neutral-200 bg-white p-4">
            <div className="text-xs font-semibold text-neutral-600">초안</div>
            <div className="mt-3 flex flex-col gap-3 text-xs text-neutral-600">
              {!data ? (
                <div className="text-neutral-400">로딩 중...</div>
              ) : data.drafts?.length ? (
                data.drafts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-[12px] border border-neutral-200 p-3"
                  >
                    <span>{item.title || `익명 작품 #${item.anon_number}`}</span>
                    <div className="flex items-center gap-2">
                      <a href={`/editor?pageId=${item.id}`} className="text-neutral-900">
                        열기
                      </a>
                      <button type="button" onClick={() => publish(item.id)} className="text-neutral-900">
                        재게시
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-neutral-400">초안이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="rounded-[14px] border border-neutral-200 bg-white p-4">
            <div className="text-xs font-semibold text-neutral-600">히스토리</div>
            <div className="mt-3 flex flex-col gap-3 text-xs text-neutral-600">
              {!data ? (
                <div className="text-neutral-400">로딩 중...</div>
              ) : data.history?.length ? (
                data.history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-[12px] border border-neutral-200 p-3"
                  >
                    <span>{item.title || `익명 작품 #${item.anon_number}`}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => publish(item.id)} className="text-neutral-900">
                        재게시
                      </button>
                      <a href={`/editor?pageId=${item.id}`} className="text-neutral-900">
                        복제
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-neutral-400">히스토리가 없습니다.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-full border border-neutral-200 px-2 py-1">
      {label} {value}
    </span>
  );
}
