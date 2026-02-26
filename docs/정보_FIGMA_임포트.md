# Figma 임포트 — 지원 범위 및 사용 안내

> NULL 에디터로 Figma 파일을 가져올 때의 지원 타입, 스타일/레이아웃 매핑, 미지원·폴백, 토큰 발급 방법을 정리한 문서입니다.

---

## 0. 기본 작품 불러와서 테스트하는 방법

1. **Figma에서 테스트할 파일 준비**  
   - 본인 Figma 파일을 열거나, [Figma Community](https://www.figma.com/community)에서 샘플 파일을 "Open in Figma"로 열기.

2. **파일 키 복사**  
   - 브라우저 주소창 URL이 `https://www.figma.com/design/XXXXX/...` 또는 `https://www.figma.com/file/XXXXX/...` 형태일 때, **`/design/` 또는 `/file/` 뒤의 XXXXX**가 파일 키입니다.  
   - 예: `https://www.figma.com/design/abc12Def34/My-File` → 파일 키 = `abc12Def34`.

3. **NULL 에디터 진입**  
   - 앱에서 **에디터(Advanced)** (`/editor/advanced`) 로 들어가서, **작품(페이지)을 연 상태**에서 Figma 가져오기를 해야 합니다.  
   - **URL에 `?pageId=...` 가 없으면** "작품(페이지)을 먼저 열어주세요" 라고 나옵니다. 이때 모달 안의 **"새 작품 만들고 Figma 가져오기"** 를 누르면 새 작품이 만들어지고 해당 페이지로 이동한 뒤, 다시 **"Figma에서 가져오기"** 메뉴를 열어 파일 키를 입력하면 됩니다.  
   - 또는 **내 라이브러리**에서 기존 작품을 연 다음, 에디터 메뉴(···) → "Figma에서 가져오기"를 사용할 수 있습니다.

4. **Figma에서 가져오기 실행**  
   - 에디터 상단 메뉴(···)에서 **"Figma에서 가져오기"** 클릭.  
   - **Figma 파일 키** 입력란에 2번에서 복사한 키 붙여넣기.  
   - **노드 ID**는 비우면 **전체 파일(첫 페이지)** 을 가져옵니다. 특정 프레임만 가져오려면 Figma에서 해당 노드 우클릭 → "Copy link" 후 URL의 `node-id=XXX` 부분을 넣으면 됩니다.

5. **Access Token**  
   - **서버에 `FIGMA_ACCESS_TOKEN` 환경 변수가 있으면** 토큰 입력란은 비워 둬도 됩니다.  
   - 없으면 [Figma Settings → Personal access tokens](https://www.figma.com/settings)에서 토큰을 발급한 뒤, 모달의 "Figma Access Token"란에 붙여넣기. (토큰 발급 상세는 아래 §5 참고.)

6. **가져오기 버튼 클릭**  
   - "가져오기" 실행 후, 현재 페이지 문서가 Figma 내용으로 덮어씌워집니다. 레이어·스타일이 NULL 형식으로 변환된 것을 확인하면 됩니다.

**한 줄**: Figma URL에서 파일 키 복사 → 에디터 "Figma에서 가져오기" → 파일 키 입력 → (선택) 토큰 입력 → 가져오기.

---

## 1. 지원 Figma 노드 타입

| Figma 타입 | NULL 타입 | 비고 |
|------------|-----------|------|
| DOCUMENT | (루트, 변환 대상 아님) | 최상위 문서 |
| CANVAS | (페이지, 변환 대상 아님) | 페이지 캔버스 |
| FRAME | frame | 레이아웃·제약·오버플로 지원 |
| SECTION | frame | 섹션을 프레임으로 매핑 |
| GROUP | group | 자식만 유지 |
| RECTANGLE | rect 또는 image | 이미지 fill 있으면 image |
| ELLIPSE | ellipse | arcData 있으면 도넛형 지원 |
| LINE | line | |
| REGULAR_POLYGON | polygon | pointCount → polygonSides |
| STAR | star | pointCount, starInnerRatio |
| VECTOR | path | fillGeometry path → pathData |
| TEXT | text | characters, style 매핑 |
| COMPONENT | component | |
| INSTANCE | instance | componentId → instanceOf |
| BOOLEAN_OPERATION | group | 복잡한 연산은 그룹으로 폴백 |
| TRANSFORM_GROUP | group | |
| SLICE | slice | |
| 기타 | group | 미지원 타입은 그룹으로 폴백 |

---

## 2. 스타일·레이아웃 매핑

### 2.1 채우기 (Fills)

- **SOLID** → NULL `fills` solid (color, opacity)
- **GRADIENT_LINEAR** → NULL `fills` linear (from, to, angle, stops). GRADIENT_RADIAL/ANGULAR/DIAMOND는 선형으로 근사하거나 단색 폴백
- **IMAGE** → 해당 노드를 **image** 타입으로 변환하고, Images API로 받은 URL을 `node.image.src`에 설정. 변환 시 IMAGE fill은 스킵

### 2.2 테두리 (Strokes)

- `strokes`, `strokeWeight`, `strokeAlign`(INSIDE/OUTSIDE/CENTER) → NULL `strokes` (color, width, align)

### 2.3 효과 (Effects)

- **DROP_SHADOW** → NULL `effects` shadow (x, y, blur, color, opacity)
- **INNER_SHADOW** → NULL shadow (내부 그림자)
- **LAYER_BLUR** / **BACKGROUND_BLUR** → NULL blur (blur 값)

### 2.4 텍스트 스타일

- `fontFamily` / `fontPostScriptName` → NULL `TextStyle.fontFamily` (폴백 스택 포함)
- `fontSize`, `fontWeight`, `letterSpacing`, `lineHeightPx` → 그대로 매핑
- `textAlignHorizontal` → left / center / right
- `textCase`, `textDecoration`, `italic` → textCase, lineThrough, underline, italic

### 2.5 레이아웃 (Auto Layout)

- `layoutMode` HORIZONTAL/VERTICAL → `dir`: row / column
- `itemSpacing` → gap
- `paddingTop/Right/Bottom/Left` → padding
- `counterAxisAlignItems` → align (start/center/end/stretch/baseline)
- `layoutWrap` → wrap

### 2.6 제약 (Constraints)

- horizontal: LEFT / RIGHT / LEFT_RIGHT / CENTER / SCALE → left, right, hCenter, scaleX
- vertical: TOP / BOTTOM / TOP_BOTTOM / CENTER / SCALE → top, bottom, vCenter, scaleY

---

## 3. 폰트·에셋 폴백

### 3.1 폰트

- Figma `fontFamily`(또는 `fontPostScriptName`)를 NULL `fontFamily`에 저장할 때 **폴백 스택**을 붙입니다.
- 형식: `"Figma폰트명, Space Grotesk, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"`
- 시스템/웹에 해당 Figma 폰트가 없으면 브라우저가 위 순서대로 다음 폰트를 사용합니다.

### 3.2 이미지 에셋 실패

- Figma Images API 호출 실패 또는 노드 ID 미지원 시 해당 노드의 `image.src`는 **빈 문자열**로 둡니다.
- 에디터에서 빈 src 이미지 노드는 placeholder(회색 박스 등)로 표시하는 것을 권장합니다.
- 특정 노드만 실패해도 나머지 문서는 정상 임포트됩니다.

---

## 4. 미지원·폴백 목록

| 항목 | 동작 |
|------|------|
| GRADIENT_RADIAL / ANGULAR / DIAMOND | 선형 그라디언트로 근사 또는 첫/끝 색 단색 |
| Figma 전용 블렌드 모드 | NULL 지원 범위 외는 `normal` |
| JUSTIFIED 정렬 | `left`로 폴백 |
| lineHeightPercent | lineHeightPx 기반으로 계산, 없으면 1.4 |
| Boolean 연산 결과 복잡 path | group으로 폴백 |
| 비디오/임베드 | 미지원, 노드 타입에 따라 group 등으로 폴백 |

---

## 5. Figma Access Token 발급 방법

1. [Figma](https://www.figma.com) 로그인 후 우측 상단 프로필 → **Settings**.
2. **Personal access tokens** (또는 **Account** → **Personal access tokens**) 메뉴로 이동.
3. **Generate new token**으로 토큰 생성. 이름은 예: `NULL import`.
4. 생성된 토큰을 복사해 두세요. **다시 표시되지 않으므로** 안전한 곳에 보관합니다.

**사용처**

- **서버**: API 라우트 `POST /api/pages/[pageId]/figma/import`에서 사용. body에 `accessToken`을 넣거나, 넣지 않으면 환경 변수 `FIGMA_ACCESS_TOKEN`을 사용합니다.
- **클라이언트**: 토큰은 서버로만 전달하고, 에디터 UI에는 마스킹해서 표시하는 것을 권장합니다. 환경 변수로만 쓰면 사용자 입력 필드는 생략 가능합니다.

**주의**

- 토큰은 코드 저장소나 클라이언트 번들에 포함하지 마세요.
- 팀/조직에서는 Figma 팀 설정에서 API 액세스 정책을 확인하세요.

---

## 6. 검증 체크리스트 (FIGMA_IMPORT 10)

샘플 Figma 파일로 임포트 후 아래를 확인하면 됩니다.

- [ ] **계층**: 페이지/프레임/그룹/도형·텍스트·이미지 계층이 NULL 에디터 트리에 올바르게 반영되는지
- [ ] **위치·크기**: `absoluteBoundingBox` → `frame` (x, y, w, h), rotation 반영
- [ ] **스타일**: 채우기(단색·선형 그라디언트), 테두리, 그림자·블러 효과
- [ ] **텍스트**: 내용(characters), 폰트·크기·정렬·줄간격 등 TextStyle
- [ ] **이미지**: 이미지 fill이 있는 노드가 image 타입으로 변환되고, Images API URL이 `image.src`에 설정되는지 (실패 시 빈 src)
- [ ] **Auto Layout**: layoutMode, padding, gap, align이 NULL auto layout으로 매핑되는지
- [ ] **제약**: constraints가 NULL constraints로 매핑되는지

---

## 7. 관련 파일

- **로드맵**: [보관_done_FIGMA_IMPORT_ROADMAP.md](./보관_done_FIGMA_IMPORT_ROADMAP.md)
- **API 클라이언트**: `src/lib/figma.ts`
- **변환기**: `src/lib/figmaToNull.ts`
- **API 라우트**: `src/app/api/pages/[pageId]/figma/import/route.ts`
- **에디터 UI**: `src/advanced/ui/AdvancedEditor.tsx` (Figma에서 가져오기 메뉴)
- **단위 테스트**: `tests/figmaToNull.test.ts` — `figmaNodesToNullDoc` (빈 문서, FRAME/RECTANGLE 변환, fileName, imageUrlMap)
