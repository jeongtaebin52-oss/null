import Link from "next/link";

export const metadata = {
  title: "이용약관 | NULL",
  description: "NULL 서비스 이용약관.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111]">
      <header className="border-b border-[#EAEAEA] bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-[#111111]">
            NULL
          </Link>
          <Link href="/" className="text-sm text-[#666666] hover:underline">
            홈으로
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-xl font-semibold text-[#111111]">이용약관</h1>
        <section className="space-y-4 text-sm text-[#111111]">
          <h2 className="font-medium text-[#111111]">제1조 (목적)</h2>
          <p className="text-[#666666]">
            본 약관은 NULL(이하 &quot;서비스&quot;)의 이용 조건, 권리·의무, 기타 필요한 사항을 정함을 목적으로 합니다.
          </p>
          <h2 className="font-medium text-[#111111]">제2조 (서비스 내용)</h2>
          <p className="text-[#666666]">
            서비스는 공개 캔버스 기반의 실험·관람·잔상·리플레이 등을 제공합니다. 구체 기능은 서비스 내 안내에 따릅니다.
          </p>
          <h2 className="font-medium text-[#111111]">제3조 (이용자 의무)</h2>
          <p className="text-[#666666]">
            이용자는 법령 및 약관을 준수하여야 하며, 타인 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.
          </p>
          <h2 className="font-medium text-[#111111]">제4조 (콘텐츠 정책)</h2>
          <p className="text-[#666666]">
            부적절한 콘텐츠(스팸·유해·개인정보 침해 등)는 신고·제재 대상이며, 운영 정책에 따라 숨김·강제 만료·계정 제한 등이 적용될 수 있습니다.
          </p>
          <h2 className="font-medium text-[#111111]">제5조 (변경·해지)</h2>
          <p className="text-[#666666]">
            약관·정책 변경 시 서비스 내 공지하며, 계속 이용 시 동의한 것으로 봅니다. 서비스는 필요한 경우 사전 공지 후 일부 또는 전부를 중단·변경할 수 있습니다.
          </p>
          <h2 className="font-medium text-[#111111]">제6조 (문의)</h2>
          <p className="text-[#666666]">약관·서비스 이용 관련 문의는 서비스 내 문의 경로를 이용해 주세요.</p>
        </section>
        <p className="mt-8 text-xs text-[#666666]">최종 갱신: 서비스 운영에 따라 수정될 수 있습니다.</p>
      </main>
    </div>
  );
}
