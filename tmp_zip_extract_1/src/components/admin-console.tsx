"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Report = {
  id: string;
  reason?: string | null;
  status: string;
  action?: string | null;
  created_at: string;
  page?: {
    id: string;
    title?: string | null;
    status: string;
    is_hidden: boolean;
    live_expires_at?: string | null;
    report_count?: number | null;
  } | null;
};

type LivePage = {
  id: string;
  title?: string | null;
  anon_number: number;
  owner_id: string;
  status: string;
  is_hidden: boolean;
  live_started_at?: string | null;
  live_expires_at?: string | null;
  total_visits: number;
  total_clicks: number;
  avg_duration_ms: number;
  upvote_count: number;
  report_count: number;
  owner?: { anon_id: string } | null;
  created_at: string;
  updated_at: string;
};

type IpBlock = {
  id: string;
  ip_hash: string;
  reason?: string | null;
  created_at: string;
  expires_at?: string | null;
};

type TabId = "reports" | "live" | "ip";

const STORAGE_KEY = "admin_key";

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

export default function AdminConsole() {
  const [adminKey, setAdminKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [tab, setTab] = useState<TabId>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportStatus, setReportStatus] = useState("open");
  const [pages, setPages] = useState<LivePage[]>([]);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ipDraft, setIpDraft] = useState("");
  const [ipReason, setIpReason] = useState("");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAdminKey(stored);
  }, []);

  useEffect(() => {
    if (!keySaved) return;
    const timeout = window.setTimeout(() => setKeySaved(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [keySaved]);

  const headers = useMemo(() => {
    if (!adminKey) return null;
    return { "x-admin-key": adminKey, "Content-Type": "application/json" };
  }, [adminKey]);

  const adminFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      if (!headers) throw new Error("admin_key_missing");
      const res = await fetch(path, {
        ...options,
        headers: { ...headers, ...(options?.headers ?? {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "request_failed");
      }
      return data;
    },
    [headers],
  );

  const refreshReports = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await adminFetch(`/api/admin/reports?status=${reportStatus}`);
      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers, reportStatus]);

  const refreshLivePages = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await adminFetch("/api/admin/pages/live");
      setPages(Array.isArray(data?.pages) ? data.pages : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers]);

  const refreshBlocks = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await adminFetch("/api/admin/ip-blocks");
      setBlocks(Array.isArray(data?.blocks) ? data.blocks : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers]);

  useEffect(() => {
    if (!headers) return;
    if (tab === "reports") void refreshReports();
    if (tab === "live") void refreshLivePages();
    if (tab === "ip") void refreshBlocks();
  }, [headers, refreshBlocks, refreshLivePages, refreshReports, tab]);

  const handleSaveKey = () => {
    if (typeof window === "undefined") return;
    if (!adminKey.trim()) return;
    localStorage.setItem(STORAGE_KEY, adminKey.trim());
    setKeySaved(true);
  };

  const handleReportAction = async (reportId: string, action: string, status = "resolved") => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const admin_note = reportNotes[reportId] ?? "";
      await adminFetch(`/api/admin/${reportId}/handle`, {
        method: "POST",
        body: JSON.stringify({ action, status, admin_note }),
      });
      await refreshReports();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  const handleHidePage = async (pageId: string) => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/pages/${pageId}/hide`, {
        method: "POST",
        body: JSON.stringify({ reason: "admin_hide" }),
      });
      await refreshLivePages();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExpirePage = async (pageId: string) => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/pages/${pageId}/force-expire`, { method: "POST" });
      await refreshLivePages();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddIpBlock = async () => {
    if (!headers) return;
    const ip = ipDraft.trim();
    if (!ip) return;
    setLoading(true);
    setNotice(null);
    try {
      await adminFetch("/api/admin/ip-blocks", {
        method: "POST",
        body: JSON.stringify({ ip, reason: ipReason.trim() }),
      });
      setIpDraft("");
      setIpReason("");
      await refreshBlocks();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Admin Console</div>
            <div className="text-2xl font-semibold">운영 관리</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="ADMIN_KEY 입력"
              className="w-64 rounded-md border border-neutral-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-2 text-xs text-white"
              onClick={handleSaveKey}
            >
              키 저장
            </button>
            {keySaved ? <span className="text-xs text-emerald-600">저장됨</span> : null}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(["reports", "live", "ip"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-full border px-3 py-1 ${tab === item ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}
              onClick={() => setTab(item)}
            >
              {item === "reports" ? "신고" : item === "live" ? "라이브" : "IP 차단"}
            </button>
          ))}
          <div className="ml-auto text-[11px] text-neutral-500">{loading ? "불러오는 중..." : "준비됨"}</div>
        </div>

        {notice ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{notice}</div> : null}

        {tab === "reports" ? (
          <section className="space-y-3 rounded-[16px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value)}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
              >
                <option value="open">열림</option>
                <option value="resolved">해결됨</option>
                <option value="dismissed">기각</option>
              </select>
              <button
                type="button"
                className="rounded-md border border-neutral-200 px-3 py-1 text-xs"
                onClick={refreshReports}
                disabled={!headers}
              >
                새로고침
              </button>
            </div>
            <div className="space-y-3">
              {reports.length ? (
                reports.map((report) => (
                  <div key={report.id} className="rounded-md border border-neutral-200 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">신고 #{report.id.slice(0, 6)}</div>
                        <div className="text-[11px] text-neutral-500">
                          페이지: {report.page?.title ?? report.page?.id ?? "-"} · {formatTime(report.created_at)}
                        </div>
                      </div>
                      <div className="text-[11px] text-neutral-500">상태: {report.status}</div>
                    </div>
                    <div className="mt-2 text-[11px] text-neutral-600">사유: {report.reason ?? "-"}</div>
                    <input
                      type="text"
                      value={reportNotes[report.id] ?? ""}
                      onChange={(e) => setReportNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      placeholder="관리자 메모"
                      className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-[11px]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleReportAction(report.id, "none", "resolved")}
                        disabled={!headers}
                      >
                        해결
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleReportAction(report.id, "none", "dismissed")}
                        disabled={!headers}
                      >
                        기각
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleReportAction(report.id, "hide_page", "resolved")}
                        disabled={!headers}
                      >
                        페이지 숨김
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleReportAction(report.id, "force_expire", "resolved")}
                        disabled={!headers}
                      >
                        강제 만료
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleReportAction(report.id, "ban_ip", "resolved")}
                        disabled={!headers}
                      >
                        IP 차단
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-500">표시할 신고가 없습니다.</div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "live" ? (
          <section className="space-y-3 rounded-[16px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-200 px-3 py-1 text-xs"
                onClick={refreshLivePages}
                disabled={!headers}
              >
                새로고침
              </button>
            </div>
            <div className="space-y-3">
              {pages.length ? (
                pages.map((page) => (
                  <div key={page.id} className="rounded-md border border-neutral-200 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{page.title ?? `익명 작품 #${page.anon_number}`}</div>
                        <div className="text-[11px] text-neutral-500">
                          {page.id} · {page.owner?.anon_id ?? page.owner_id}
                        </div>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {formatTime(page.live_started_at)} → {formatTime(page.live_expires_at)}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-600">
                      <span>방문 {page.total_visits}</span>
                      <span>클릭 {page.total_clicks}</span>
                      <span>평균 체류 {Math.round(page.avg_duration_ms / 1000)}s</span>
                      <span>신고 {page.report_count}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleHidePage(page.id)}
                        disabled={!headers}
                      >
                        숨김
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => handleExpirePage(page.id)}
                        disabled={!headers}
                      >
                        만료
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-500">라이브 페이지가 없습니다.</div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "ip" ? (
          <section className="space-y-3 rounded-[16px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={ipDraft}
                onChange={(e) => setIpDraft(e.target.value)}
                placeholder="차단할 IP"
                className="w-40 rounded-md border border-neutral-200 px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={ipReason}
                onChange={(e) => setIpReason(e.target.value)}
                placeholder="사유"
                className="w-64 rounded-md border border-neutral-200 px-2 py-1 text-xs"
              />
              <button
                type="button"
                className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white"
                onClick={handleAddIpBlock}
                disabled={!headers}
              >
                IP 차단
              </button>
              <button type="button" className="rounded-md border border-neutral-200 px-3 py-1 text-xs" onClick={refreshBlocks} disabled={!headers}>
                새로고침
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {blocks.length ? (
                blocks.map((block) => (
                  <div key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2">
                    <div>
                      <div className="font-semibold">해시 {block.ip_hash.slice(0, 12)}...</div>
                      <div className="text-[11px] text-neutral-500">사유: {block.reason ?? "-"}</div>
                    </div>
                    <div className="text-[11px] text-neutral-500">{formatTime(block.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-500">등록된 IP 차단이 없습니다.</div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
