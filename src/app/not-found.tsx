"use client";

import Link from "next/link";

/** NOTE: comment removed (encoding issue). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 py-12 text-[#111111]">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[#111111]">페이지를 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-[#666666]" role="status">
          요청하신 페이지가 존재하지 않거나 삭제되었습니다.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => (typeof window !== "undefined" ? window.history.back() : undefined)}
            className="rounded-[14px] border border-[#EAEAEA] bg-white px-5 py-3 text-sm font-medium text-[#111111]"
            aria-label="뒤로가기"
          >
            뒤로
          </button>
          <Link
            href="/"
            className="rounded-[14px] border border-[#111111] bg-[#111111] px-5 py-3 text-sm font-semibold text-white"
            aria-label="홈으로"
          >
            홈
          </Link>
          <Link
            href="/library"
            className="rounded-[14px] border border-[#EAEAEA] bg-white px-5 py-3 text-sm font-medium text-[#111111]"
            aria-label="라이브러리로"
          >
            라이브러리
          </Link>
        </div>
      </div>
    </div>
  );
}
