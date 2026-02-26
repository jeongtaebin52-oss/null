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

type TabId = "reports" | "live" | "ip" | "settings";

const STORAGE_KEY = "admin_key";

  type AdminStats = { open_reports: number; live_count: number };
  type SettingsMap = {
    live_hours?: number;
    anon_prefix?: string;
    feed_popular_k?: number;
    allow_noip_fallback?: boolean;
    witness_cap_minutes?: number;
    spikes_window_hours?: number;
    spikes_bucket_minutes?: number;
    spikes_highlight_minutes?: number;
    spikes_top_k?: number;
    replay_highlight_window_ms?: number;
    replay_top_click_windows?: number;
    replay_top_leave_windows?: number;
    replay_top_button_clicks?: number;
  };

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
  const [reportSort, setReportSort] = useState<"date" | "priority">("date");
  const [pages, setPages] = useState<LivePage[]>([]);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ipDraft, setIpDraft] = useState("");
  const [ipReason, setIpReason] = useState("");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [settingsDraft, setSettingsDraft] = useState<SettingsMap>({});
  const [confirmAction, setConfirmAction] = useState<{ type: "hide" | "expire"; pageId: string; title: string } | null>(null);
  const [liveSort, setLiveSort] = useState<"expires" | "viewers" | "clicks" | "reports">("expires");
  const [liveSearch, setLiveSearch] = useState("");

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

  useEffect(() => {
    if (!confirmAction) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmAction(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmAction]);

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
        throw new Error(data?.error ?? "요청에 실패했습니다.");
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
      const data = await adminFetch(`/api/admin/reports?status=${reportStatus}&sort=${reportSort}`);
      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers, reportStatus, reportSort]);

  const refreshLivePages = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const q = liveSearch.trim() ? `&q=${encodeURIComponent(liveSearch.trim())}` : "";
      const data = await adminFetch(`/api/admin/pages/live?sort=${liveSort}${q}`);
      setPages(Array.isArray(data?.pages) ? data.pages : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers, liveSort, liveSearch]);

  const refreshBlocks = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await adminFetch("/api/admin/ip-blocks");
      setBlocks(Array.isArray(data?.blocks) ? data.blocks : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, headers]);

  const refreshStats = useCallback(async () => {
    if (!headers) return;
    try {
      const data = await adminFetch("/api/admin/stats");
      setStats({ open_reports: data?.open_reports ?? 0, live_count: data?.live_count ?? 0 });
    } catch {
      setStats(null);
    }
  }, [adminFetch, headers]);

  const refreshSettings = useCallback(async () => {
    if (!headers) return;
    try {
      const data = await adminFetch("/api/admin/settings");
      const s = (data?.settings ?? {}) as SettingsMap;
      setSettings(s);
      setSettingsDraft({ ...s });
    } catch {
      setSettings({});
      setSettingsDraft({});
    }
  }, [adminFetch, headers]);

  useEffect(() => {
    if (!headers) return;
    if (tab === "reports") void refreshReports();
    if (tab === "live") void refreshLivePages();
    if (tab === "ip") void refreshBlocks();
    if (tab === "settings") void refreshSettings();
  }, [headers, refreshBlocks, refreshLivePages, refreshReports, refreshSettings, tab, liveSort]);

  useEffect(() => {
    if (headers) void refreshStats();
  }, [headers, refreshStats]);

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
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleHidePage = async (pageId: string) => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    setConfirmAction(null);
    try {
      await adminFetch(`/api/admin/pages/${pageId}/hide`, {
        method: "POST",
        body: JSON.stringify({ reason: "admin_hide" }),
      });
      await refreshLivePages();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleExpirePage = async (pageId: string) => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    setConfirmAction(null);
    try {
      await adminFetch(`/api/admin/pages/${pageId}/force-expire`, { method: "POST" });
      await refreshLivePages();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!headers) return;
    setLoading(true);
    setNotice(null);
    try {
      await adminFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(settingsDraft),
      });
      setSettings(settingsDraft);
      setNotice("설정이 저장되었습니다.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
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
      setNotice(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">관리 콘솔</div>
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
          {(["reports", "live", "ip", "settings"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-full border px-3 py-1 ${tab === item ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}
              onClick={() => setTab(item)}
            >
              {item === "reports" ? "신고" : item === "live" ? "라이브" : item === "ip" ? "IP 차단" : "설정"}
            </button>
          ))}
          <div className="ml-auto text-[11px] text-neutral-500">{loading ? "불러오는 중..." : "준비됨"}</div>
        </div>

        {stats != null ? (
          <div className="rounded-[12px] border border-[#EAEAEA] bg-[#FFFFFF] px-4 py-3 text-xs text-[#666666]">
            <span className="font-semibold text-[#111111]">알림·모니터링</span>
            <span className="ml-3">열린 신고 {stats.open_reports}건</span>
            <span className="ml-3">라이브 {stats.live_count}건</span>
            <button type="button" className="ml-2 rounded border border-[#EAEAEA] bg-white px-2 py-0.5 text-[#111111]" onClick={refreshStats}>새로고침</button>
          </div>
        ) : null}

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
              <select
                value={reportSort}
                onChange={(e) => setReportSort(e.target.value as "date" | "priority")}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
                aria-label="신고 정렬"
              >
                <option value="date">접수일</option>
                <option value="priority">우선순위</option>
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
                <div className="text-xs text-neutral-500">
                  {reportStatus === "open" ? "처리 대기 신고가 없습니다." : "표시할 신고가 없습니다."}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "live" ? (
          <section className="space-y-3 rounded-[16px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={liveSearch}
                onChange={(e) => setLiveSearch(e.target.value)}
                placeholder="작품 ID·소유자 검색"
                className="w-40 rounded-md border border-neutral-200 px-2 py-1 text-xs"
                aria-label="라이브 목록 검색 (작품 ID 또는 소유자)"
              />
              <span className="text-[11px] text-neutral-500">정렬:</span>
              <select
                value={liveSort}
                onChange={(e) => setLiveSort(e.target.value as "expires" | "viewers" | "clicks" | "reports")}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
                aria-label="라이브 목록 정렬"
              >
                <option value="expires">남은 시간</option>
                <option value="viewers">관객 수</option>
                <option value="clicks">클릭 수</option>
                <option value="reports">신고 수</option>
              </select>
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
                        onClick={() => setConfirmAction({ type: "hide", pageId: page.id, title: page.title ?? `익명 #${page.anon_number}` })}
                        disabled={!headers}
                      >
                        숨김
                      </button>
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1"
                        onClick={() => setConfirmAction({ type: "expire", pageId: page.id, title: page.title ?? `익명 #${page.anon_number}` })}
                        disabled={!headers}
                      >
                        만료
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-500">
                  {liveSearch.trim() ? "검색 결과 없음" : "현재 라이브 작품 없음"}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="space-y-3 rounded-[16px] border border-neutral-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="text-xs font-semibold text-neutral-600">시스템 설정 (7.4.1)</div>
            <div className="grid gap-3 text-xs">
              <div>
                <label className="block text-neutral-500">휘발 시간(공개 유지 시간, 시간)</label>
                <select
                  value={settingsDraft.live_hours ?? 24}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, live_hours: Number(e.target.value) }))}
                  className="mt-1 rounded border border-neutral-200 px-2 py-1"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
              <div>
                <label className="block text-neutral-500">익명 접두사 (표시용, 최대 32자)</label>
                <input
                  type="text"
                  value={settingsDraft.anon_prefix ?? ""}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, anon_prefix: e.target.value }))}
                  placeholder="예: 익명"
                  className="mt-1 w-64 rounded border border-neutral-200 px-2 py-1"
                />
              </div>
                <div>
                  <label className="block text-neutral-500">피드 인기 정렬 시간 감쇠 k (1~24)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={settingsDraft.feed_popular_k ?? 8}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, feed_popular_k: Number(e.target.value) || 8 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">IP 미확인 허용 (noip fallback)</label>
                  <label className="mt-1 inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settingsDraft.allow_noip_fallback ?? true}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, allow_noip_fallback: e.target.checked }))}
                    />
                    <span>허용</span>
                  </label>
                </div>
                <div>
                  <label className="block text-neutral-500">WITNESS 캡(분, 1~120)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settingsDraft.witness_cap_minutes ?? 20}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, witness_cap_minutes: Number(e.target.value) || 20 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">스파이크 윈도우(시간, 1~168)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={settingsDraft.spikes_window_hours ?? 24}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, spikes_window_hours: Number(e.target.value) || 24 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">스파이크 버킷(분, 1~60)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settingsDraft.spikes_bucket_minutes ?? 5}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, spikes_bucket_minutes: Number(e.target.value) || 5 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">스파이크 하이라이트(분, 5~180)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={settingsDraft.spikes_highlight_minutes ?? 30}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, spikes_highlight_minutes: Number(e.target.value) || 30 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">스파이크 Top-K (1~10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsDraft.spikes_top_k ?? 3}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, spikes_top_k: Number(e.target.value) || 3 }))}
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">리플레이 하이라이트 윈도우(ms, 5000~300000)</label>
                  <input
                    type="number"
                    min={5000}
                    max={300000}
                    value={settingsDraft.replay_highlight_window_ms ?? 30000}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, replay_highlight_window_ms: Number(e.target.value) || 30000 }))
                    }
                    className="mt-1 w-32 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">리플레이 클릭 급증 Top-N (1~10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsDraft.replay_top_click_windows ?? 3}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, replay_top_click_windows: Number(e.target.value) || 3 }))
                    }
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">리플레이 이탈 급증 Top-N (1~10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsDraft.replay_top_leave_windows ?? 2}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, replay_top_leave_windows: Number(e.target.value) || 2 }))
                    }
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500">리플레이 버튼 집중 Top-N (1~10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsDraft.replay_top_button_clicks ?? 1}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, replay_top_button_clicks: Number(e.target.value) || 1 }))
                    }
                    className="mt-1 w-24 rounded border border-neutral-200 px-2 py-1"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1 text-white"
                  onClick={handleSaveSettings}
                  disabled={!headers}
              >
                저장
              </button>
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

        {confirmAction ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            onClick={(e) => e.target === e.currentTarget && setConfirmAction(null)}
          >
            <div className="max-w-sm rounded-[14px] border border-neutral-200 bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h2 id="admin-confirm-title" className="text-sm font-semibold text-neutral-900">
                {confirmAction.type === "hide" ? "페이지 숨김" : "강제 만료"}
              </h2>
              <p className="mt-2 text-xs text-neutral-600">
                {confirmAction.type === "hide"
                  ? `「${confirmAction.title}」을(를) 피드·공개 목록에서 숨기시겠습니까?`
                  : `「${confirmAction.title}」을(를) 즉시 만료하시겠습니까?`}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
                  onClick={() => setConfirmAction(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs text-white"
                  onClick={() =>
                    confirmAction.type === "hide"
                      ? handleHidePage(confirmAction.pageId)
                      : handleExpirePage(confirmAction.pageId)
                  }
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
