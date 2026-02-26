# 1. 1인 1공개 강제 정책 명확화 (D2) ✅ 완료

> **순서**: 남은 작업 중 **1번**. (완료)

---

## 정책 (확정)

| 구분 | 동시 공개 상한 |
|------|----------------|
| **기본(Free/Standard)** | **1개** (1인 1공개 강제) |
| **프로(Pro)** | **5개** |

- 엔터프라이즈 상한은 문서에 별도 기재하지 않음.
- "공개" = `Page.status === "live"` 이며 `live_expires_at` 이 유효한 페이지.

**한도 초과 시 (기본 플랜)**  
- 실행 시 문구 표시: **"추가 업로드는 플랜 업그레이드가 필요합니다. 또는 현재 공개 중인 작품을 공개 취소한 후 새 작품을 업로드해 주세요."**
- 게시 요청 **거부** (기존 live 자동 만료 없음).

---

## 구현 요약

- **plan.ts**: Free/Standard `maxLivePages: 1`, Pro `maxLivePages: 5`.
- **api/pages/[pageId]/publish**: `canPublishMore` false 시 403 + `error: "publish_limit_reached"`, `message` 위 문구 반환.
- **에디터**: publish 실패 시 `data.message` 있으면 그대로 표시.
