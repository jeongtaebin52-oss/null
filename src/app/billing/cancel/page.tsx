"use client";

import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] px-6 py-12 text-center">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-medium text-[#666666]" role="status">취소됨</p>
        <h1 className="mt-1 text-xl font-semibold text-[#111111]">결제가 취소되었습니다</h1>
        <p className="mt-2 text-sm text-[#666666]">
          결제를 취소하셨거나 오류가 발생했습니다. 다시 시도하시려면 플랜 선택으로 이동해 주세요.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/upgrade"
            className="inline-block rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-[#FFFFFF]"
            aria-label="플랜 선택으로 돌아가기"
          >
            플랜 선택으로 돌아가기
          </Link>
          <Link
            href="/upgrade"
            className="inline-block rounded-full border border-[#EAEAEA] px-4 py-2 text-sm font-medium text-[#111111]"
            aria-label="다시 시도"
          >
            다시 시도
          </Link>
          <Link href="/" className="inline-block rounded-full border border-[#EAEAEA] px-4 py-2 text-sm font-medium text-[#111111]">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
