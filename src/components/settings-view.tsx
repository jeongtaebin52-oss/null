"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

/**
 * 계정 설정 및 환경 설정.
 * 로그아웃은 이 화면에서 제공.
 */
export default function SettingsView() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(() => {
    setLoggingOut(true);
    fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      .then(() => {
        if (typeof localStorage !== "undefined") localStorage.removeItem("anon_user_id");
        window.location.href = "/";
      })
      .finally(() => setLoggingOut(false));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 text-sm text-[#111111]">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#111111]">설정</h1>
        <p className="text-[#666666]">계정 설정과 환경을 관리합니다.</p>
      </header>

      <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-[#111111]">로그아웃</h2>
        <p className="mt-2 text-xs text-[#666666]">이 계정에서 로그아웃합니다.</p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-3 rounded-full border border-[#EAEAEA] bg-white px-4 py-2 text-xs font-semibold text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-60"
          aria-label="로그아웃"
        >
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </section>

      <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-[#111111]">계정</h2>
        <p className="mt-2 text-xs text-[#666666]">프로필과 계정 정보를 관리합니다.</p>
        <Link
          href="/account"
          className="mt-3 inline-block rounded-full border border-[#111111] bg-[#111111] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333333]"
          style={{ color: "#ffffff" }}
        >
          계정으로 이동
        </Link>
      </section>

      <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-[#111111]">알림</h2>
        <p className="mt-2 text-xs text-[#666666]">각 프로젝트 대시보드에서 디스코드 알림을 설정합니다.</p>
      </section>

      <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-semibold text-[#111111]">법적 고지</h2>
        <ul className="mt-2 list-inside list-disc text-xs text-[#666666]">
          <li>
            <Link href="/terms" className="text-[#111111] underline hover:no-underline">이용약관</Link>
          </li>
          <li>
            <Link href="/privacy" className="text-[#111111] underline hover:no-underline">개인정보처리방침</Link>
          </li>
        </ul>
      </section>

      <p className="text-xs text-[#666666]">
        <Link href="/" className="text-[#111111] underline hover:no-underline">홈으로 돌아가기</Link>
      </p>
    </div>
  );
}
