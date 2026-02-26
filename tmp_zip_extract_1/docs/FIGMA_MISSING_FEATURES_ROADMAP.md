# NULL — Figma 핵심 기능 구현 로드맵 (에디터 상위호환)

> **목표**: NULL 에디터를 Figma 수준으로 끌어올려, “진짜 Figma를 만든다”고 생각하고 편집 가능한 경험을 제공한다.  
> **기준**: 각 항목 완료 시 해당 항목 제목에 **✅ 완료** 표시. 순서대로 진행 권장.  
> **원칙**: Figma의 UI/UX·기능 동작을 최대한 재현하되, **언어·스택은 다르다**(NULL은 TypeScript/React/SVG 기반). 동작과 사용자 경험을 Figma에 맞춘다.

---

## 전제·범위

- 본 문서는 `EXECUTION_ORDER.md`(NULL 기본 기능), `NOCODE_FULLSTACK_ROADMAP.md`(노코드 풀스택)를 넘어, **에디터 자체의 Figma 기능 유사성**을 높이기 위한 로드맵이다.
- 언급된 기능은 현재 NULL에 없거나 부분 구현만 있어 Figma와 같은 사용자 경험을 주지 못하는 것들이다.
- 각 항목은 **Figma의 동작을 상세히 기술**하고, **NULL에서의 데이터 모델·UI·구현 방향**을 구체적으로 제시한다.

---

## 문서 간 관계

| 문서 | 역할 |
|------|------|
| `EXECUTION_ORDER.md` | NULL 기본 빌드·에디터·런타임 실행 순서 (1~n) |
| `NOCODE_FULLSTACK_ROADMAP.md` | 데이터·API·폼·라우팅 등 “풀스택” 기능 (작품 단위 격리) |
| **본 문서** | 에디터의 **Figma 수준 기능** (펜·Boolean·마스크·스크롤·코멘트·Smart Animate·그리드·UI 개선) |
| `FIGMA_IMPORT_ROADMAP.md` | **Figma 파일 → NULL 문서** 임포트 (API·파싱·변환·UI) |

**권장 순서**: EXECUTION_ORDER → NOCODE_FULLSTACK → **본 문서(FIGMA_MISSING_FEATURES)** → FIGMA_IMPORT.

---

## 1. 캔버스 기반 펜 도구 (베지어 핸들 직접 조작) ✅ 완료

### 1.1 Figma 동작 (스펙)

- **도구 선택**: 툴바에서 Pen(P) 또는 단축키 `P`. 커서가 크로스헤어로 변경.
- **캔버스 상호작용**
  - **클릭**: 현재 위치에 **앵커 포인트** 추가. 이전 앵커와 직선 세그먼트로 연결.
  - **드래그**: 앵커 추가 + **베지어 컨트롤 핸들** 생성. 드래그 방향·거리에 따라 곡률 결정. 곡선 세그먼트 생성.
  - **앵커 위 클릭**: 해당 앵커의 핸들만 조절(한쪽 또는 양쪽). `Alt`/`Option` 누른 채 드래그 시 **한쪽 핸들만** 조절(코너/뾰족한 곡선).
  - **Shift + 클릭/드래그**: 45° 스냅. 수평/수직/대각선 정렬.
- **종료**: `Esc` 또는 `Enter`로 패스 편집 완료. 더블클릭으로도 종료 가능.
- **닫힌 패스**: 첫 앵커 위 클릭 시 패스가 닫힘(closed path).
- **데이터**: Figma는 각 노드에 `fillGeometry`, `strokeGeometry` 또는 벡터 네트워크(vector network) 형태로 앵커·핸들·세그먼트를 저장.

### 1.2 NULL 데이터 모델

- **기존**: `NodeType`에 `"path"` 있음. `NodeShape.pathData`에 SVG `d` 문자열 저장 가능 (`scene.ts`).
- **추가 필요**:
  - **편집용 중간 표현**: 앵커 배열  
    `{ x, y, handle1X?, handle1Y?, handle2X?, handle2Y?, isSmooth?: boolean }[]`  
    `isSmooth === true`면 양쪽 핸들이 한 선상에 있음(코너 아님).
  - **pathData 생성**: 위 배열 → SVG `d`(M, L, C, Z 등) 변환 함수. `src/advanced/geom/pathData.ts`(신규) 권장.
  - **노드 저장**: 최종적으로는 `pathData`(문자열)만 Doc에 저장. 편집 모드일 때만 앵커 배열을 유지하고, 완료 시 `pathData`로 직렬화.

### 1.3 NULL UI·이벤트

- **도구**: `Tool`에 `"path"` 이미 있음. 툴바에서 Pen 아이콘/라벨로 선택.
- **캔버스**: `AdvancedEditor` 캔버스 `onPointerDown`/`onPointerMove`/`onPointerUp`에서 `tool === "path"` 분기.
  - **상태**: `pathEditState: null | { nodeId: string; anchors: Anchor[]; closed: boolean }`.
  - 포인터 이벤트는 **캔버스 좌표**(pan/zoom 역변환)로 앵커/핸들 좌표 계산.
- **키보드**: `Esc`/`Enter`로 편집 완료. `Shift`는 전역 modifier. `Alt`는 한쪽 핸들만 조절.
- **렌더링**: 편집 중에는 `pathData` + 앵커/핸들 점을 SVG `<circle>` 또는 `<path>`로 오버레이. 선택된 앵커는 강조.

### 1.4 구현 단계

1. `pathData.ts`: 앵커 배열 ↔ SVG `d` 변환 (Cubic Bézier 기준).
2. `AdvancedEditor`: `pathEditState` 추가, Pen 선택 시 캔버스 포인터 핸들러에서 앵커 추가/이동/핸들 드래그.
3. 리사이즈 핸들처럼 “앵커/핸들 히트 영역” 계산 (거리 기반 또는 터치 친화적 반경).
4. `Esc`/`Enter` 시 `pathEditState`를 `pathData`로 변환해 `setDoc`로 노드 업데이트.

### 1.5 완료 조건

- Pen 도구로 직선·곡선 세그먼트를 그릴 수 있고, 기존 앵커의 핸들을 드래그해 곡선을 수정할 수 있다.
- `Alt`로 한쪽 핸들만 조절, `Shift`로 45° 스냅이 동작한다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 2. 고급 도형 연산 (Boolean Operations) ✅ 완료 ✅ 완료

### 2.1 Figma 동작 (스펙)

- **선택**: 두 개 이상의 **동일 레벨** 도형(사각형, 원, 패스 등) 선택.
- **메뉴**: 상단 툴바 또는 우클릭 → **Boolean** 그룹:
  - **Union**: 선택된 도형을 하나로 합침. 외곽선만 남김.
  - **Subtract**: 맨 앞(위) 도형이 아래 도형들을 “잘라 냄”. 결과는 단일 벡터.
  - **Intersect**: 겹치는 영역만 남김.
  - **Exclude**: 겹치는 영역만 제거(반대 연산).
- **결과**: 새로운 **벡터/패스 노드** 하나로 대체. 원본 노드는 제거. 그룹 해제 후 연산 가능.

### 2.2 NULL 데이터 모델

- **연산 결과**: 항상 `NodeType === "path"`인 노드 하나. `pathData`에 연산 결과 SVG path `d` 저장.
- **입력**: 연산 전 노드들의 `pathData` 또는 바운딩 도형을 기반으로 한 polygon/path. `rect`·`ellipse`는 `pathData`로 변환하는 유틸 필요 (`rectToPath`, `ellipseToPath`).

### 2.3 라이브러리·수학

- **후보**: `paper.js`(벡터 연산), `polybooljs`(폴리곤 Boolean), `boolean-subtract` 등. SVG path `d` 파싱 후 폴리곤으로 변환해 연산하고, 결과를 다시 `d`로 만드는 파이프라인.
- **제약**: 복잡한 path는 단순화(simplify) 후 연산하거나, 픽셀 기반 폴백(캔버스 비트맵 연산 후 트레이스)은 나중 검토.

### 2.4 NULL UI

- 툴바 또는 우클릭 메뉴에 **Boolean** 그룹: Union / Subtract / Intersect / Exclude. 2개 이상 선택 시에만 활성화.
- 실행 시: 선택 노드들로부터 `pathData` 수집 → 연산 → 새 `path` 노드 생성, 기존 노드 제거 및 `setDoc` 반영.

### 2.5 완료 조건

- 두 개 이상 도형 선택 후 Union/Subtract/Intersect/Exclude 실행 시 하나의 path 노드로 결과가 나온다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 3. 레이어 마스크 (Mask) ✅ 완료

### 3.1 Figma 동작 (스펙)

- **적용**: 마스크로 쓸 레이어(도형·이미지 등)를 **마스크될 레이어(들) 위에** 배치. 상위 레이어를 “Use as mask”로 설정하면, 그 **형태·알파**에 따라 아래 레이어가 잘려 보임.
- **클리핑**: 마스크 레이어의 보이는 영역 = 아래 내용이 보이는 영역. 마스크 레이어 자체는 기본적으로 숨김(또는 “마스크만 보이기” 옵션).
- **다중**: 그룹에 마스크를 걸면 그룹 전체가 한 번에 마스크됨.

### 3.2 NULL 데이터 모델

- **옵션 A**: 노드에 `isMask: boolean`. `true`인 노드가 바로 아래 형제(들)을 마스크. 또는 **그룹**의 첫 번째 자식을 마스크로 해석.
- **옵션 B**: 노드에 `maskId?: string`. `maskId`가 가리키는 노드가 이 노드(또는 그룹)의 마스크.
- **저장 위치**: `Node` 타입에 `isMask?: boolean` 또는 `maskId?: string` 추가 (`scene.ts`). 그룹 단위로 적용 시: 그룹의 `children` 중 첫 번째가 마스크, 나머지가 마스크될 대상.

### 3.3 NULL 렌더링 (SVG)

- SVG `<mask>` 사용: `<mask id="mask-{id}">` 안에 마스크 노드의 **형상**을 그린다. 마스크 노드의 fill/opacity가 mask의 luminance/alpha로 사용되도록.
- 마스크될 노드(또는 그룹)에 `mask="url(#mask-{id})"` 적용.
- **에디터**: 마스크 노드는 반투명 오버레이로 표시하거나 “마스크” 뱃지로 구분. 레이어 패널에서 마스크 관계 표시.

### 3.4 NULL UI

- 우클릭 메뉴: **Use as mask** / **Release mask**. 레이어 패널에서 마스크된 그룹은 접기/펼치기로 구조 표시.

### 3.5 완료 조건

- 도형/이미지를 마스크로 설정하면 아래 레이어가 그 형태로 잘려 보인다. 에디터·플레이어 모두 동일 동작.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 4. 스크롤 기반 프로토타입 ✅ 완료

### 4.1 Figma 동작 (스펙)

- **Overflow Scrolling**: 프레임(또는 컴포넌트)에 **Overflow behavior** 설정.  
  `No scrolling` / `Vertical scroll` / `Horizontal scroll` / `Horizontal and vertical`.  
  자식이 프레임보다 크면 스크롤바(또는 터치 스크롤)로 스크롤 가능.
- **Scroll to**: 프로토타입 **액션** 중 하나. 트리거(클릭 등) 발생 시 **특정 프레임의 특정 위치**로 스크롤. 옵션: 수직/수평, 오프셋, 스무딩(이징).
- **스크롤 트리거**: “스크롤 위치가 N% 도달 시” 같은 트리거로 액션 실행(예: 섹션 진입 시 애니메이션).

### 4.2 NULL 데이터 모델

- **프레임 overflow**: `Node`(frame)의 `props` 또는 전용 필드에  
  `overflowScrolling: "none" | "vertical" | "horizontal" | "both"` 추가.
- **프로토타입 액션**: `PrototypeAction`에  
  `type: "scrollTo"; targetNodeId: string; axis?: "x" | "y" | "both"; offset?: number; transition?: PrototypeTransition` 추가.
- **프로토타입 트리거**: `PrototypeTrigger`에  
  `type: "scroll"; nodeId?: string; threshold?: number; unit?: "percent" | "pixel"` 추가. (해당 노드의 스크롤 위치가 threshold 도달 시 액션 실행.)

### 4.3 NULL 런타임 (플레이어)

- **overflow**: 해당 프레임을 감싼 DOM에 `overflow: auto` / `overflow-x: auto` / `overflow-y: auto` 적용. `overflowScrolling: "both"`면 둘 다.
- **scrollTo 액션**: `targetNodeId`에 해당하는 DOM 요소를 찾아 `scrollIntoView({ behavior: "smooth", block/inline })` 또는 `element.scrollTo()` 호출. `transition`은 `behavior: "smooth"` + duration 대략 적용.
- **스크롤 트리거**: 해당 스크롤 컨테이너에 `scroll` 이벤트 리스너 또는 `IntersectionObserver`. `threshold` 도달 시 기존 액션 디스패치 로직으로 연결.

### 4.4 완료 조건

- 프레임에 overflow 스크롤 설정 시 플레이어에서 스크롤 가능.
- “Scroll to” 액션으로 특정 노드 위치로 스무스 스크롤된다.
- (선택) 스크롤 트리거로 특정 구간 도달 시 액션이 실행된다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 5. 협업 코멘트 (Comments) ✅ 완료

### 5.1 Figma 동작 (스펙)

- **코멘트 모드**: 툴바 또는 단축키로 “코멘트” 모드 진입. 캔버스 클릭 시 해당 위치에 **코멘트 핀** 생성.
- **핀**: 위치(x, y), 작성자, 내용, 생성 시각. 답글 스레드. 상태: Open / Resolved.
- **실시간**: 다른 사용자가 코멘트를 추가/수정/해결하면 실시간으로 표시(소켓 또는 폴링).

### 5.2 NULL 데이터 모델 (DB)

- **Comment** 모델 (Prisma):  
  `id`, `pageId`, `nodeId`(nullable), `userId`, `x`, `y`, `content`, `parentId`(답글용), `resolved: boolean`, `createdAt`, `updatedAt`.
- **작품 단위**: `pageId`는 “현재 작품(페이지)” 기준. 다른 작품 코멘트와 격리.

### 5.3 API

- `GET /api/pages/[pageId]/comments` — 목록 (nodeId, resolved 필터 가능).
- `POST /api/pages/[pageId]/comments` — 생성 (body: nodeId?, x, y, content, parentId?).
- `PATCH /api/pages/[pageId]/comments/[commentId]` — 수정/해결 (content, resolved).
- `DELETE /api/pages/[pageId]/comments/[commentId]` — 삭제.
- 권한: 해당 작품 편집/보기 권한 있는 사용자만.

### 5.4 실시간

- 기존 Socket 또는 새 이벤트: `comment:created`, `comment:updated`, `comment:resolved`, `comment:deleted`.  
  같은 `pageId`를 보고 있는 클라이언트에만 브로드캐스트.

### 5.5 에디터 UI

- **코멘트 모드** 토글: 툴바에 아이콘. 켜면 캔버스 클릭 시 코멘트 핀 생성 API 호출.
- **핀 렌더링**: 캔버스 위 오버레이에 (x, y)에 핀 아이콘. 클릭 시 우측 패널 또는 팝오버에 내용·답글·Resolve 버튼.
- **레이어 패널**: 선택 노드에 연결된 코멘트 개수 뱃지 또는 코멘트 전용 탭.

### 5.6 완료 조건

- 코멘트 모드에서 캔버스 클릭 시 핀이 생성되고, 목록/답글/해결이 가능하다. 다른 사용자 변경이 실시간으로 반영된다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 6. Smart Animate 및 고급 인터랙티브 컴포넌트 ✅ 완료

### 6.1 Smart Animate (자동 보간)

#### Figma 동작

- **같은 이름 노드**: 프레임 A → 프레임 B(또는 페이지 전환) 시, **이름이 같은 노드**를 매칭해 위치·크기·회전·opacity·채우기·그림자 등을 **자동 보간**.
- **옵션**: 트랜지션 duration, easing. 매칭되지 않는 노드는 페이드 인/아웃 처리 가능.

#### NULL 구현

- **Doc diffing**: `startPageTransition(fromDoc, toDoc)` 시 노드 트리 비교. `id` 또는 `name` 기준으로 “같은 노드” 매칭.
- **속성 diff**: `frame`(x, y, w, h, rotation), `opacity`, `fills`, `effects` 등 변경된 속성만 추출.
- **애니메이션**: CSS `transition` 또는 Web Animations API로 변경 분만 duration/easing 적용해 보간. 전환 중에는 fromDoc·toDoc 노드를 겹쳐 그리며, 매칭된 노드만 애니메이션.

### 6.2 고급 인터랙티브 컴포넌트 (상태·변형)

#### Figma 동작

- **상태**: 컴포넌트에 Default / Hover / Pressed / Focus 등 **상태** 정의. 각 상태별로 스타일(채우기, 테두리 등) 다르게 설정.
- **인터랙션**: “On hover” → “Change to Hover”, “On click” → “Change to Pressed” 등. **Set state** 액션으로 같은 컴포넌트의 상태만 바꿀 수 있음.
- **변형(Variant)**: 여러 변형 중 하나로 전환도 가능.

#### NULL 데이터 모델

- **Node**(component/instance)에 `interactions` 배열:  
  `{ trigger: "hover" | "click" | "press"; action: { type: "setState"; stateId: string } | { type: "setVariant"; variantId: string } }`.
- **상태/변형**: 컴포넌트 정의 쪽에 `states: { id, name, overrides }` 또는 변형 트리. 인스턴스는 현재 `stateId`/`variantId` 보유.

#### NULL 런타임

- 플레이어에서 컴포넌트 인스턴스에 `onMouseEnter`/`onMouseLeave`/`onClick` 등 연결.  
  `setState`/`setVariant` 시 해당 인스턴스의 오버라이드 또는 렌더 분기만 바꿔서 다시 그리기.

### 6.3 완료 조건

- 페이지 전환 시 같은 이름 노드가 Smart Animate로 보간된다.
- 컴포넌트에 Hover/Click 시 상태 변경이 에디터에서 설정되고, 플레이어에서 동작한다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 7. 레이아웃 그리드 (Layout Grid) ✅ 완료

### 7.1 Figma 동작 (스펙)

- **프레임에 그리드**: Columns / Rows / Grid(정사각형) 중 선택. 여러 그리드 레이어를 겹쳐 쓸 수 있음.
- **Columns/Rows**: 개수, 정렬 타입(Stretch, Center, Left), 폭(width), 간격(gutter), margin(offset). 시각적으로 세로/가로 줄이 캔버스에 표시.
- **Grid**: 셀 크기. 시각적으로 격자 표시.
- **토글**: `Ctrl`+`G` / `Cmd`+`G`로 그리드 보이기/숨기기. 스냅은 별도 옵션.

### 7.2 NULL 데이터 모델

- **프레임** `props` 또는 전용 필드:  
  `layoutGrid: Array<{ type: "columns" | "rows" | "grid"; count?: number; width?: number; gutter?: number; offset?: number; color?: string; opacity?: number }>`.
- **에디터 전용**: “그리드 표시 여부”는 에디터 state (`showLayoutGrid: boolean`). Doc에는 저장하지 않아도 됨.

### 7.3 NULL UI·렌더링

- **속성 패널**: 프레임 선택 시 “Layout Grid” 섹션. 그리드 추가/삭제, type/count/width/gutter/offset 입력.
- **캔버스**: 프레임 노드 렌더 시 `layoutGrid`가 있으면 해당 프레임 좌표계 안에 `<line>` 또는 `<rect>`로 그리드 라인 그리기. `showLayoutGrid`가 false면 그리지 않음.
- **단축키**: `Ctrl`+`G` / `Cmd`+`G`로 `showLayoutGrid` 토글.

### 7.4 완료 조건

- 프레임에 Columns/Rows/Grid를 추가할 수 있고, 캔버스에 격자가 보인다. 단축키로 표시 전환 가능.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 8. 에디터 UI / 사용성 개선 (전면 재설계) ✅ 완료

### 8.1 Figma 참고 원칙

- **툴바**: 간결. 자주 쓰는 도구만 노출. 나머지는 드롭다운·오버플로우(`...`).
- **좌측**: 페이지·레이어·자산(컴포넌트/스타일/변수) 등을 **탭** 또는 **접이식 섹션**으로 구분.
- **우측**: 선택 대상에 따라 **동적** 속성 패널. 섹션별 접기/펼치기.
- **우클릭**: 자주 쓰는 항목만 1단계에. 나머지는 서브메뉴로 그룹화.

### 8.2 NULL 툴바 재구성

- **그룹 예시**:  
  - 선택·손(Select, Hand)  
  - 프레임·도형(Frame, Rect, Ellipse, Line, Arrow, Polygon, Star, Path)  
  - 텍스트·미디어(Text, Image, Video)  
  - 컴포넌트·프로토타입  
  - 개발·내보내기  
- 각 그룹은 클릭 시 **드롭다운** 또는 **확장 메뉴**. 메인에는 아이콘만 또는 대표 1~2개.
- **오버플로우**: `...` 클릭 시 나머지 도구·Boolean·마스크 등.

### 8.3 좌측 패널

- **탭**: 페이지 | 레이어 | 자산(컴포넌트/스타일/변수).  
- **요소/프리셋**: “기본 요소”, “레이아웃”, “콘텐츠”, “내비/폼”, “인증/관리” 등 **카테고리**로 나누고, 각 카테고리 **접이식(Accordion)**.
- **페이지**: 추가/복제/삭제 버튼이 명확히 동작하고, 새 페이지가 목록에 즉시 반영되도록 버그 수정.

### 8.4 우측 패널

- 선택 노드 **타입**(text / frame / rect 등)과 **개수**(단일 / 다중)에 따라 내용 변경.
- **섹션**: 기하(위치·크기·회전) | 채우기·테두리·효과 | 레이아웃(Auto Layout 등) | 텍스트 | 프로토타입 | 변수. 각 섹션 **접기/펼치기** 가능.

### 8.5 우클릭 메뉴

- **1단계**: 잘라내기, 복사, 붙여넣기, 삭제, 그룹, 잠금 등 5~8개.
- **2단계**: 정렬, Boolean, 컴포넌트, 마스크, “더 보기…” 등 **서브메뉴** 또는 확장 모달.
- 아이콘 + 짧은 라벨로 시인성 확보.

### 8.6 완료 조건

- 툴바가 그룹화되고, 좌/우 패널이 탭·접이식으로 정리되어 “기능이 묻히지 않고” 찾기 쉽다. 우클릭 메뉴가 단계별로 정리되어 있다.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 9. 최종 점검 — Figma 에디터 기능 완성도 ✅ 완료

- 위 1~8 항목을 **Figma 동작과 대조**해, NULL 에디터에 구현되었는지·Figma와 비슷한 사용자 경험을 주는지 확인.
- 누락·불일치 항목 수정. **Figma 에디터 기능 완성도**를 목표 수준(예: 핵심 90% 이상)까지 끌어올리면 본 로드맵 완료.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 부록: Figma ↔ NULL 용어·기술 대응

| Figma | NULL |
|-------|------|
| Frame | `frame` 노드 |
| Vector / Pen path | `path` 노드, `pathData` (SVG `d`) |
| Component / Instance | `component` / `instance` 노드 |
| Auto Layout | `LayoutMode` `auto`, `dir`/`gap`/`padding`/`align` (`scene.ts`) |
| Constraints | `Constraints` (`scene.ts`) |
| Fill / Stroke / Effect | `Fill` / `Stroke` / `Effect` (`scene.ts`) |
| Prototype (trigger → action) | `PrototypeTrigger` / `PrototypeAction` (기존 doc 모델) |
| Layout Grid | `layoutGrid` (프레임 props, 본 로드맵 7번) |
| Comment | DB `Comment` + API + Socket (본 로드맵 5번) |
| Mask | `isMask` 또는 `maskId` (본 로드맵 3번) |

**총 9개 묶음.** 1 → 2 → … → 9 순서로 진행하고, 완료한 항목 제목에 **✅ 완료**를 붙인다.  
**구현 시점**: NOCODE_FULLSTACK_ROADMAP(1~11) 및 기타 핵심 기능 **이후**, Figma 임포트(FIGMA_IMPORT_ROADMAP) **이전**에 진행하는 것을 권장한다.
