# 3. Figma 에디터 보강 (완료)

> **상태**: **done** — 2.1 우선 처리 8개(F6·B2·I2·I3·I4·I5·L2·M5) 완료.  
> **목적**: Figma 대비 에디터 완성도를 높이기 위한 리스트 & 실행 순서.

---

## 0. Figma 대비 에디터 완성도

| 구분 | 수치 | 설명 |
|------|------|------|
| **에디터 (Figma 대비)** | **약 90%** | [보관_done_FIGMA_90_EXECUTION_ORDER.md](./보관_done_FIGMA_90_EXECUTION_ORDER.md) Phase 1~10 완료. 툴바·레이어·속성·제약·Auto Layout·텍스트·Vector·Boolean·이미지/비디오·컴포넌트·Variants·스타일·Variables·프로토타입·View/Export/Dev/Pages·Version History·Plugins 구조 등 구현. |
| **남은 에디터 보강** | ✅ 8개 완료 + ⚪ 다수 | 2.1 — F6·B2·I2·I3·I4·I5·L2·M5 완료. 2.2 ⚪ 제한적 항목은 필요 시 보강. |
| **Figma 파일 불러오기** | **100%** | [보관_done_FIGMA_IMPORT_ROADMAP.md](./보관_done_FIGMA_IMPORT_ROADMAP.md) 1~10 완료. |

**한 줄**: 에디터는 Figma 대비 **약 90%** 잡혀 있고, 나머지는 아래 보강 항목들.

---

## 1. "Figma 전체"에 해당하는 것 vs 아닌 것

| 구분 | 설명 |
|------|------|
| **Figma 에디터** | 디자인·프로토타입·개발/내보내기 (도구, 레이아웃, 컴포넌트, 프로토타입 등) — **대부분 구현됨**. 남은 건 아래 "에디터 보강" |
| **Figma 파일 불러오기** | 기존 Figma 작업물을 NULL로 가져오기 — **보관_done_FIGMA_IMPORT_ROADMAP 1~10** (완료) |
| **노코드 풀스택 (NOCODE)** | 데이터 모델, CRUD API, 폼, 라우팅, 파일 업로드, 배포 등 — **Figma 기능이 아님**. [보관_done_NOCODE_FULLSTACK_ROADMAP.md](./보관_done_NOCODE_FULLSTACK_ROADMAP.md) 1~11 완료. |

---

## 2. Figma 에디터 보강 리스트 (전체)

### 2.1 ✅ 우선 처리 항목 (완료)

| ID | 항목 | 내용 | 상태 |
|----|------|------|------|
| F6 | 노드별 내보내기 설정 | 노드마다 export 포맷·배율(1x/2x/3x) 지정 | ✅ 완료 |
| B2 | 변수 폰트 | 가변 폰트(weight/width 축) 선택·슬라이더 | ✅ 완료 |
| I2 | 노이즈 효과 | Effect 타입 `noise` | ✅ 완료 |
| I3 | 그라디언트 정지점 | 선형 그라디언트에 stop 추가/삭제/위치·색 (현재 from/to/angle만) | ✅ 완료 |
| I4 | 이미지 채우기 | 도형에 이미지를 fill로 넣기 (fill with image) | ✅ 완료 |
| I5 | Vector network | path 세그먼트별 fill (segments d·fills, 추가/삭제/채우기 UI) | ✅ 완료 |
| L2 | 수천 노드 스트레스 테스트 | 대용량 문서 메모리·프레임 검증 | ✅ 완료 |
| M5 | 스크린 리더 | 선택 노드·속성 읽어주기 | ✅ 완료 |

### 2.2 ⚪ 제한적·확인 필요 (보강)

| ID | 항목 |
|----|------|
| A2 | 트리거 확장 (onPress/onDrag/whileHover 등) |
| A4, A5 | 전환/오버레이 옵션 세밀 제어 |
| B3~B5 | 폰트 UI, 단락·리스트, 텍스트 오버플로우 |
| D5, D6, D7 | 스마트 가이드, 스냅, 룰러·가이드 |
| E7 | "같은 X 선택" (스타일/이름/타입 일괄 선택) |
| G1, G2, G4 | 스타일 미리보기, 스타일 리셋, 변수 바인딩 표시 |
| H2 | Push overrides (인스턴스 → 메인 반영) |
| J6 | 픽셀 단위 라운딩 옵션 |
| K2, K3 | 코멘트 알림·배지, 실시간 반영 UI |
| L3, L4 | 레이어 가상 스크롤, Undo 스택 깊이 |
| M1~M4, M6, M7 | 키보드·포커스·ARIA·도움말·빈 상태 |
| N1, N3, N4 | 픽셀 스냅, 페이지 전환 시 선택, 이미지 로드 실패 처리 |

---

## 3. 실행 순서 제안

1. **✅ 8개 완료** — F6, B2, I2, I3, I4, I5, L2, M5.
2. **⚪** — 필요 시 2.2 제한적 항목 보강.

**참고**: [보관_done_FEATURE_CHECKLIST.md](./보관_done_FEATURE_CHECKLIST.md) 섹션 8 기준.

---

## 4. 요약

- **남은 리스트**: 에디터 보강 2.1 ✅ 8개 완료, 2.2 ⚪ 다수 (위 표).
- **Figma 임포트**: [보관_done_FIGMA_IMPORT_ROADMAP.md](./보관_done_FIGMA_IMPORT_ROADMAP.md) 1~10 완료.
- **NOCODE**: [보관_done_NOCODE_FULLSTACK_ROADMAP.md](./보관_done_NOCODE_FULLSTACK_ROADMAP.md) 1~11 완료 (Figma 구현 범위 아님).
