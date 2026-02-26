"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function BillingSuccessPage() {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plan?.id) setPlan(data.plan.id);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF] px-6 py-12 text-center">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-[#111111]">구독 완료</h1>
        <p className="mt-2 text-sm text-[#666666]">
          {plan ? `현재 플랜: ${plan.toUpperCase()}` : "플랜 정보를 불러오는 중..."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/library"
            className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-[#FFFFFF]"
            aria-label="내 라이브러리로 이동"
          >
            내 라이브러리로
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#EAEAEA] px-4 py-2 text-sm text-[#111111]"
            aria-label="홈으로 이동"
          >
            홈으로
          </Link>
          <Link
            href="/upgrade"
            className="rounded-full border border-[#EAEAEA] px-4 py-2 text-sm text-[#111111]"
            aria-label="플랜 변경"
          >
            플랜 변경
          </Link>
        </div>
      </div>
    </div>
  );
}
