import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | NULL",
  description: "NULL 서비스 개인정보 수집·이용·보관에 관한 안내.",
};

export default function PrivacyPage() {
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
        <h1 className="mb-6 text-xl font-semibold text-[#111111]">개인정보처리방침</h1>
        <p className="mb-4 text-sm text-[#666666]">
          NULL은 실제 수집하는 데이터 기준으로 본 방침을 운영합니다. 수집하지 않는 항목은 명시하지 않습니다.
        </p>
        <section className="space-y-4 text-sm text-[#111111]">
          <h2 className="font-medium text-[#111111]">1. 수집 항목</h2>
          <ul className="list-inside list-disc space-y-1 text-[#666666]">
            <li>익명 식별자(anon_id): 첫 방문 시 서버 발급, 로그인 전 활동 연계</li>
            <li>이메일: 가입·로그인 시 선택적 수집(유료 전환 시 활용 가능)</li>
            <li>비밀번호: 저장 시 해시 처리, 원문 미보관</li>
            <li>작품·이벤트 메타: page_id, session_id, ts, 클릭/이동 타입·좌표(정규화). 텍스트 입력값·스크린 캡처·아이 트래킹 미수집</li>
          </ul>
          <h2 className="font-medium text-[#111111]">2. 이용 목적</h2>
          <p className="text-[#666666]">
            서비스 제공, 실시간 관람·잔상·리플레이, abuse 방지(IP 해시·추천 제한), 법적 분쟁 대응.
          </p>
          <h2 className="font-medium text-[#111111]">3. 보관·파기</h2>
          <p className="text-[#666666]">
            공개 작품은 24시간 후 만료 정책에 따라 처리. 계정·이벤트 보관 기간은 서비스 정책에 따르며, 삭제 요청 시 해당 데이터 삭제.
          </p>
          <h2 className="font-medium text-[#111111]">4. 제3자 제공</h2>
          <p className="text-[#666666]">결제·인프라 업체에 필요한 최소 정보만 제공. 목록은 서비스 내 안내로 갱신.</p>
          <h2 className="font-medium text-[#111111]">5. 문의</h2>
          <p className="text-[#666666]">개인정보 관련 문의는 서비스 내 문의 경로를 이용해 주세요.</p>
        </section>
        <p className="mt-8 text-xs text-[#666666]">최종 갱신: 서비스 운영에 따라 수정될 수 있습니다.</p>
      </main>
    </div>
  );
}
