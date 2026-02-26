# NULL — Figma 임포트 로드맵

> **목표**: 기존 Figma 작업물을 NULL 에디터로 불러오기. Figma API로 파일을 읽어 NULL 문서(advanced doc)로 변환.  
> **기준**: 각 항목을 완료하면 해당 항목 제목에 **✅ 완료** 표시. 순서대로 진행 권장.  
> **위치**: NOCODE_FULLSTACK_ROADMAP(1~11) 등 핵심 로드맵 **이후**, 맨 마지막에 구현하는 기능으로 둠.  
> **원칙**: "토씨 하나 안 틀리게" 완벽 1:1보다는 **실용적으로 충분한 fidelity**를 목표로, 누락/차이는 폴백·문서화로 보완.

---

## 전제·범위

- **입력**: Figma 파일 URL 또는 File Key + (선택) Node ID(특정 프레임만). 사용자 Figma Access Token 또는 팀 토큰.
- **출력**: NULL advanced doc(SerializableDoc) 형태. 현재 작품(페이지)에 "임포트된 페이지"로 추가하거나 새 작품으로 생성.
- **Figma API**: REST API v1. `GET /v1/files/:file_key`, `GET /v1/files/:file_key/nodes?ids=...`, `GET /v1/images/:file_key` 등 사용. 공식 스펙·레이트 리밋 준수.
- **미지원/나중**: 플러그인 내보내기(.fig 로컬 파일)는 Figma가 포맷 비공개이므로 본 로드맵에서 제외. API 기반만 다룸.

---

## 1. Figma API 클라이언트 및 인증

- `src/lib/figma.ts`(또는 `src/lib/figma/`) 신규: Figma REST API 호출 래퍼.
- **인증**: 환경 변수 `FIGMA_ACCESS_TOKEN` 또는 사용자 입력 토큰. 토큰은 서버에서만 사용(API 라우트에서 호출), 클라이언트에 노출 금지.
- **엔드포인트**: `GET https://api.figma.com/v1/files/:file_key`(문서 트리), `GET https://api.figma.com/v1/files/:file_key/nodes?ids=:node_id`(하위 노드), `GET https://api.figma.com/v1/images/:file_key?ids=...&format=png|jpg|svg`(이미지 URL).
- **에러·레이트**: 4xx/5xx 처리, 429 시 재시도(Retry-After) 또는 사용자 안내. 응답 타입(FileResponse, Node 등)은 Figma API 스펙에 맞게 타입 정의.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 2. Figma 파일·노드 트리 파싱

- API 응답에서 `document`(루트 노드), `name`, `id`, `children` 재귀 순회.
- **노드 타입 매핑 표**: Figma 타입(`FRAME`, `RECTANGLE`, `TEXT`, `COMPONENT`, `INSTANCE`, `ELLIPSE`, `VECTOR`, `LINE`, `REGULAR_POLYGON` 등) → NULL 쪽 타입(frame, rect, text, image, group, shape 등) 대응표 작성. 지원하지 않는 타입은 GROUP 또는 placeholder로 폴백.
- **기하**: `absoluteBoundingBox`(x, y, width, height) → NULL `frame`. `rotation` 있으면 NULL `frame.rotation`으로.
- **계층**: `children` 순서 유지, 부모–자식 관계를 NULL 노드 트리(`parentId`, `children`)로 구성.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 3. 스타일·채우기·테두리 변환

- **채우기**: Figma `fills`(solid, gradient) → NULL `fills`(Fill 타입). `opacity`, `blendMode`는 NULL 쪽 지원 범위 내로. 미지원 블렌드는 무시 또는 "passthrough" 등 문서화.
- **테두리**: `strokes`, `strokeWeight`, `strokeAlign`(INSIDE/OUTSIDE/CENTER) → NULL `strokes`, stroke 정렬 옵션.
- **효과**: `effects`(shadow, blur) → NULL `Effect` 타입이 있으면 매핑, 없으면 생략 또는 단순 그림자만.
- **텍스트 스타일**: `style`(fontName, fontSize, fontWeight, letterSpacing, lineHeightPx, textAlignHorizontal 등) → NULL `TextStyle`. 폰트는 `fontName`을 그대로 저장하고, NULL 쪽에 해당 폰트 없으면 폴백 폰트 목록 사용(문서에 명시).
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 4. 이미지·벡터 에셋 처리

- **이미지**: Figma 노드가 이미지인 경우(또는 export 설정이 있는 경우) `GET /v1/images/:file_key?ids=:node_id&format=png` 등으로 URL 획득. NULL 쪽에 업로드(현재 작품 저장소) 후 URL을 노드 `image.url` 등으로 저장. 비동기 처리이므로 임포트 플로우에서 "에셋 동기화" 단계로 분리 가능.
- **벡터**: Figma `vectorPaths`/path 데이터가 있으면 NULL shape/path 노드의 `pathData`(SVG path d)로 변환. 복잡한 Boolean 연산 결과는 단순 path로 근사하거나 이미지로 내보내서 사용.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 5. 레이아웃·제약 매핑

- **Auto Layout**: Figma `layoutMode`(HORIZONTAL/VERTICAL), `primaryAxisSizingMode`, `counterAxisSizingMode`, `padding`, `itemSpacing`, `layoutAlign` 등 → NULL `LayoutMode`(auto), `dir`, `gap`, `padding`, `align` 등. 대응표 작성 후 변환. 미지원 항목은 기본값.
- **Constraints**: Figma `constraints`(horizontal, vertical) → NULL `constraints`(좌/우/상/하 스케일·고정). 비율 대응이 다르면 가장 가까운 동작으로 매핑.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 6. Figma → NULL 문서 변환기 통합

- **진입 함수**: `figmaFileToNullDoc(params: { fileKey: string; accessToken: string; nodeId?: string }) => Promise<SerializableDoc>`.
- 단계: (1) API로 파일/노드 로드, (2) 노드 트리 파싱(2번), (3) 스타일·채우기·테두리(3번), (4) 에셋(이미지/벡터) 처리(4번), (5) 레이아웃·제약(5번) 적용 후 NULL 노드 트리 생성. `createDoc`/`createNode` 등 기존 scene 유틸 사용해 유효한 Doc 생성.
- **ID**: Figma node id는 유일하므로 `nullNodeId = `figma_${figmaNodeId}` 또는 새 `makeId` 혼용. 중복 방지.
- **페이지**: Figma 최상위 FRAME 또는 선택한 노드를 NULL "페이지" 하나로 매핑. 다중 페이지 임포트 시 Figma 페이지별 최상위 프레임을 NULL 페이지 여러 개로 변환.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 7. API 라우트 및 권한

- `POST /api/figma/import`(또는 `POST /api/pages/[pageId]/figma/import`): body `{ fileKey: string; accessToken?: string; nodeId?: string; importAsNewPage?: boolean }`. 서버에서 Figma API 호출 후 `figmaFileToNullDoc` 실행. `accessToken`이 없으면 환경 변수 `FIGMA_ACCESS_TOKEN` 사용. 응답: `{ doc: SerializableDoc }` 또는 현재 작품에 페이지 추가 시 `{ pageId, versionId }` 등.
- **권한**: 현재 사용자(anon/user)가 해당 작품의 소유자이거나 편집 권한이 있을 때만 임포트 허용. 토큰은 로그에 남기지 않음.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 8. 에디터 UI — 임포트 진입점

- 에디터(AdvancedEditor) 메뉴 또는 상단에 **"Figma에서 가져오기"** 항목 추가.
- **UI**: Figma 파일 URL 또는 File Key 입력, (선택) 노드 ID, (선택) "새 페이지로" / "현재 페이지에 합치기". 토큰 입력은 환경 변수 사용 시 생략 가능, 개인 토큰 사용 시 입력 필드(마스킹).
- **플로우**: 제출 → API 호출 → 로딩 표시 → 성공 시 반환된 Doc을 현재 문서에 반영(페이지 추가 또는 교체). 실패 시 에러 메시지(권한/네트워크/파싱 실패 등).
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 9. 폰트·에셋 폴백 및 문서화

- **폰트**: Figma `fontName`(family, style)을 NULL `fontFamily` 등에 저장. 시스템/웹에 없는 폰트는 `sans-serif` 또는 설정 가능한 폴백 목록 사용. 설정 UI(폰트 매핑 테이블)는 선택.
- **에셋 실패**: 이미지 다운로드/저장 실패 시 해당 노드는 placeholder(회색 박스 + 경고 아이콘) 또는 제거 옵션. 로그에 node id 기록.
- **문서**: `docs/FIGMA_IMPORT.md`(또는 본 문서 하단)에 "지원 Figma 타입", "스타일/레이아웃 매핑 표", "미지원·폴백 목록", "토큰 발급 방법" 정리.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

## 10. 검증 및 최종 점검

- 샘플 Figma 파일(프레임, 텍스트, 이미지, 도형, Auto Layout 1개 이상)로 임포트 → NULL 에디터에서 열어 계층·위치·스타일·텍스트가 기대에 맞는지 확인.
- **완료 시**: 본 항목 제목에 `✅ 완료` 추가.

---

**총 10개 묶음.**  
1 → 2 → … → 10 순서대로 진행하고, 완료한 항목 제목에 **✅ 완료**를 붙이면 된다.  
**구현 시점**: NOCODE_FULLSTACK_ROADMAP(1~11) 및 기타 핵심 기능 **이후**, 맨 마지막에 진행.
