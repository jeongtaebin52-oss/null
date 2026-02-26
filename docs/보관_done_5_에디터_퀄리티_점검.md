# 5. 에디터 퀄리티 점검 (완료)

> **목적**: 이미 구현된 것 포함 **전체 퀄리티**(버그·엣지 케이스·성능·UX·접근성) 점검·보강 리스트.  
> **기준**: 기능 유무가 아닌 **완성도·안정성·사용성**.  
> **상태**: Phase 1 검수 완료 → `보관_done_5_에디터_퀄리티_점검.md`로 보관.

---

## 0. 왜 별도 문서인가

- **기능** = "있는지 없는지" → [보관_done_4_FIGMA_100_갭_로드맵.md](./보관_done_4_FIGMA_100_갭_로드맵.md).
- **퀄리티** = "같은 기능이라도 얼마나 잘 동작·다듬어져 있는지" → 본 문서.
- 기능 100%가 되어도 퀄리티가 부족하면 "동일 선상"이라고 보기 어렵기 때문에, 둘 다 정리함.

---

## 1. 점검·보강 영역 (체크리스트)

| ID | 영역 | 점검·보강 내용 | 상태 |
|----|------|----------------|------|
| **Q1** | 버그·엣지 케이스 | 대표 플로우(생성/편집/삭제/복사/실행/내보내기)별 **엣지 케이스** 수집·재현·수정. Phase 1: 삭제 후 layoutDoc·빈 selection·손상된 children 검증(tests/editorEdgeCases.test.ts) 완료. | ✅ Phase 1 |
| **Q2** | 성능 | **대용량 문서**(수천 노드)에서 레이아웃·렌더·선택·드래그 **프레임·메모리** 유지. Phase 1: layoutDoc(2000노드)·cloneDoc(1500노드) 제한 시간 내 완료 검증(tests/stressDoc.test.ts Q2) 완료. | ✅ Phase 1 |
| **Q3** | UX 일관성 | 패널·모달·툴바·단축키 **일관된 동작·피드백·에러 메시지**. Phase 1: Figma 임포트 모달 Escape로 닫기(onKey 의존성·핸들 추가) 완료. | ✅ Phase 1 |
| **Q4** | 접근성 | **키보드만** 조작, **스크린 리더**(M5 구현됨) 완성도, 포커스·ARIA·대체 텍스트. Phase 1: 메시지 영역 `role="status"`·`aria-live="polite"` 추가 완료. | ✅ Phase 1 |
| **Q5** | 에러 처리 | API 실패·네트워크 끊김·잘못된 입력 시 **복구·메시지** 명확히. Phase 1: 코멘트 전송/해결/답글 실패 시 setMessage·MESSAGE_LABELS(comment_failed, comment_action_failed, restore_failed) 완료. | ✅ Phase 1 |
| **Q6** | 레이아웃·렌더 엣지 | Auto layout·제약·clip·overflow 등 **극단 값·조합**에서 깨짐·오류 없음. Phase 1: clipContent·overflowScrolling·column+wrap·극단 패딩/갭 테스트(tests/layout.test.ts Q6) 완료. | ✅ Phase 1 |
| **Q7** | 프로토타입 재생 | 전환·오버레이·조건·스크롤 트리거 등 **실제 재생**이 기대대로 동작. Phase 1: startPageId·navigate/overlay/closeOverlay·transition 보존·targetPageId 유효성 검증(tests/prototypePlayback.test.ts) 완료. | ✅ Phase 1 |

---

## 2. 실행 순서 제안

1. **Q1** — 버그·엣지 케이스 (가시적 오동작 먼저).
2. **Q2** — 성능 (대용량에서 체감 품질).
3. **Q5** — 에러 처리 (안정성).
4. **Q3, Q4** — UX·접근성.
5. **Q6, Q7** — 레이아웃·프로토타입 엣지.

---

## 3. 참고

- 점검·보강 완료한 항목은 상태를 ✅로 갱신.
- Phase 1 전체 완료 후 본 문서를 `보관_done_5_에디터_퀄리티_점검.md`로 보관함.
