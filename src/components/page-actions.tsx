"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  pageId: string;
  initialUpvotes?: number;
  className?: string;
};

type Toast = { kind: "ok" | "err"; text: string } | null;

export default function PageActions({ pageId, initialUpvotes = 0, className }: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [toast, setToast] = useState<Toast>(null);
  const [hasUpvoted, setHasUpvoted] = useState(false);

  const [upvoting, setUpvoting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  /** §29.4 추천 취소: 관람 페이지 로드 시 추천 여부 조회 */
  useEffect(() => {
    fetch(`/api/pages/${pageId}/upvote`, { method: "GET", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.upvoted === "boolean") setHasUpvoted(data.upvoted);
      })
      .catch(() => {});
  }, [pageId]);

  // report reason is optional; keep short & dry (no emotional copy)
  const [reasonPreset, setReasonPreset] = useState<string>("phishing");
  const [reasonText, setReasonText] = useState<string>("");

  const reason = useMemo(() => {
    const extra = reasonText.trim();
    if (!extra) return reasonPreset;
    // keep short; server trims too
    return `${reasonPreset}: ${extra}`.slice(0, 500);
  }, [reasonPreset, reasonText]);

  const showToast = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2200);
  };

  const onUpvote = async () => {
    if (upvoting) return;
    setUpvoting(true);
    const method = hasUpvoted ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/pages/${pageId}/upvote`, { method, credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) showToast("err", "익명 세션이 필요합니다.");
        else if (res.status === 403) showToast("err", "차단되었습니다.");
        else if (res.status === 404) showToast("err", "사용할 수 없습니다.");
        else showToast("err", "실패했습니다.");
        return;
      }

      if (data?.duplicated) {
        setHasUpvoted(true);
        showToast("ok", "이미 추천했습니다.");
        return;
      }

      if (typeof data?.upvote_count === "number") setUpvotes(data.upvote_count);
      else if (hasUpvoted) setUpvotes((v) => Math.max(0, v - 1));
      else setUpvotes((v) => v + 1);
      setHasUpvoted(!hasUpvoted);
      showToast("ok", hasUpvoted ? "추천을 취소했습니다." : "추천했습니다.");
    } finally {
      setUpvoting(false);
    }
  };

  const onReport = async () => {
    if (reporting) return;
    setReporting(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) showToast("err", "익명 세션이 필요합니다.");
        else if (res.status === 403) showToast("err", "차단되었습니다.");
        else if (res.status === 404) showToast("err", "사용할 수 없습니다.");
        else showToast("err", "실패했습니다.");
        return;
      }

      if (data?.ok) {
        showToast("ok", "신고가 접수됐습니다.");
        setReportOpen(false);
        setReasonText("");
      } else {
        showToast("err", "실패했습니다.");
      }
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className={className}>
      {/* toast */}
      {toast ? (
        <div
          className={[
            "fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-[14px] border px-4 py-2 text-xs shadow-sm",
            toast.kind === "ok"
              ? "border-[#EAEAEA] bg-white text-[#111]"
              : "border-[#EAEAEA] bg-white text-[#111]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUpvote}
          disabled={upvoting}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-50 ${hasUpvoted ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-900 bg-white text-neutral-900"}`}
          aria-label={hasUpvoted ? "추천 취소" : "추천"}
        >
          <ThumbIcon />
          <span>{upvotes}</span>
        </button>

        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-700"
          aria-label="신고"
        >
          <FlagIcon />
          <span>신고</span>
        </button>
      </div>

      {reportOpen ? (
        <div className="mt-2 w-full rounded-[14px] border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-neutral-900">신고</div>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px]"
            >
              닫기
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            <label className="text-[11px] text-neutral-500">사유</label>
            <select
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="w-full rounded-[14px] border border-neutral-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-neutral-900"
            >
              <option value="phishing">피싱</option>
              <option value="spam">스팸</option>
              <option value="malicious-link">악성 링크</option>
              <option value="illegal">불법</option>
              <option value="other">기타</option>
            </select>

            <label className="text-[11px] text-neutral-500">메모 (선택)</label>
            <input
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="간단한 메모"
              className="w-full rounded-[14px] border border-neutral-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-neutral-900"
            />

            <div className="mt-1 text-[11px] text-neutral-500">
              텍스트 입력은 행동 분석에 수집되지 않습니다. 신고 처리를 위한 용도입니다.
            </div>

            <button
              type="button"
              onClick={onReport}
              disabled={reporting}
              className="mt-2 inline-flex w-full items-center justify-center rounded-[14px] bg-neutral-900 px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {reporting ? "신고 중..." : "제출"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThumbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3Z" />
      <path d="M7 10h10a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7V10Z" />
      <path d="M10 10V6a3 3 0 0 1 3-3h1v7" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 22V4" />
      <path d="M4 4h12l-1 4 1 4H4" />
    </svg>
  );
}
