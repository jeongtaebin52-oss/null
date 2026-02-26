# 4. Figma 100% 갭 로드맵 (12% 채우기) — 완료

> **목적**: Figma 에디터와 **기능** 동일 선상을 위한 남은 12% 정리.  
> **기준**: [정보_FIGMA_VS_NULL_분석.md](./정보_FIGMA_VS_NULL_분석.md) 코드 분석 결과(88%) 대비 부족 분.  
> **상태**: 갭 항목(P1, C1, A1, N1, K1, L1, D1, V1, H1) 모두 ✅ 완료.

---

## 0. 현재 상태

| 구분 | 수치 | 설명 |
|------|------|------|
| **NULL (코드 기준)** | **88%** | Figma = 100%로 둔 가중 평균. |
| **갭** | **12%** | 아래 영역별 미구현·미흡 합산. |
| **목표** | **100%** | 기능 목록만 Figma와 동일 선상. |

**한 줄**: 12%를 채우면 **기능** 면에서 Figma 에디터와 동일 선상에 올라갈 수 있음.

---

## 1. 갭 원인별 정리 (기능만)

| ID | 영역 | Figma에 있는데 NULL에 없는/약한 것 | 우선순위 | 상태 |
|----|------|-----------------------------------|----------|------|
| **P1** | 플러그인 | Figma 수준 **플러그인 SDK** (UI 추가·샌드박스 실행 등). Phase 1: RenderContext(Doc·selectionIds·pluginAPI), PluginAPI(getNode·getDoc·getPageId·getVariableMode), listPlugins() 완료. | 높음 | ✅ Phase 1 |
| **N1** | 노드 타입 | **Table** 노드 (NodeTable·그리드 레이아웃·에디터 UI·테스트 검증 완료). | 중간 | ✅ |
| **A1** | 프로토타입 | **onDragStart/onDragEnd**, **whileHover 지연** 등 트리거·세밀한 타이밍. | 중간 | ✅ 완료 |
| **C1** | 컴포넌트 | **팀 라이브러리**, **파일/문서 간 컴포넌트 공유**. Doc.libraries, Node.instanceLibraryId, RuntimeRenderer getLibraryDoc(libraryId)→Doc 완료. (한 문서 내 컴포넌트는 있음.) | 높음 | ✅ |
| **L1** | 레이아웃 | Auto layout **엣지 케이스**. 빈 자식·단일 자식·row 배치·min/max clamp 검증 테스트(tests/layout.test.ts) 완료. | 낮음 | ✅ |
| **K1** | 코멘트 | **실시간 동기화·프레즌스**. 코멘트 폴링 2.5s·visibility refetch, GET /api/pages/[pageId]/presence?heartbeat=1·15s 폴링·N명 보는 중 UI 완료. | 중간 | ✅ |
| **D1** | Dev/스펙 | **Inspect·코드 추출** 세부. CSS에 box-shadow·mix-blend-mode 반영 완료 (CSS·스펙은 있음). | 낮음 | ✅ |
| **V1** | 캔버스·뷰 | **룰러·가이드** UI·사용성. 룰러에 가이드 위치 마커 표시, 가이드선 더블클릭 시 개별 제거·툴팁 완료. | 낮음 | ✅ |
| **H1** | 버전 | **버전 diff·브랜치** UI. GET /api/pages/[pageId]/versions/[versionId](노드 수), 버전 목록에 "비교" 버튼·노드 수 diff 표시 완료. | 낮음 | ✅ |

---

## 2. 실행 순서 제안

1. **P1** — 플러그인 SDK (비중·갭 기여 가장 큼).
2. **C1** — 팀 라이브러리·파일 간 컴포넌트 공유.
3. **A1** — 프로토타입 트리거 확장 (onDrag, whileHover 지연 등).
4. **N1** — Table 등 노드 타입.
5. **K1** — 코멘트 실시간 동기화.
6. **L1, D1, V1, H1** — 레이아웃·Dev·룰러·버전 (필요 시).

---

## 3. 참고

- **기능만** 기준. 퀄리티(버그·성능·UX)는 [보관_done_5_에디터_퀄리티_점검.md](./보관_done_5_에디터_퀄리티_점검.md) 참고.
- 전체 완료 후 본 문서를 `done_4_FIGMA_100_갭_로드맵.md`로 이름 변경함.
