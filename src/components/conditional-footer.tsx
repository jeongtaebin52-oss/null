"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";

/** §32 배포 뷰(/p/...)에서는 푸터 비표시 — 사용자 웹만 보이게. */
export default function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/p/")) return null;
  return (
    <footer className="border-t border-[#EAEAEA] bg-white py-4 text-center text-xs text-[#666666]">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a href="/account" className="hover:underline" aria-label="내 계정">
          내 계정
        </a>
        <span className="mx-2" aria-hidden>·</span>
        <a href="/settings" className="hover:underline" aria-label="설정">
          설정
        </a>
        <span className="mx-2" aria-hidden>·</span>
        <a href="/terms" className="hover:underline" aria-label="이용약관">
          이용약관
        </a>
        <span className="mx-2" aria-hidden>·</span>
        <a href="/privacy" className="hover:underline" aria-label="개인정보처리방침">
          개인정보처리방침
        </a>
        <span className="mx-2" aria-hidden>·</span>
        <a href="mailto:?subject=NULL%20문의" className="hover:underline" aria-label="문의">
          문의
        </a>
        <span className="mx-2" aria-hidden>·</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
