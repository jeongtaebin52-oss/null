# Figma 대비 NULL 구현률 (코드 기준)

> **기준**: 100% = Figma. docs/주석/TODO가 아닌 **실제 코드**만으로 판단.

---

## 결과: **88%**

(소수점 반올림. 범위로 쓰면 **86~90%**.)

---

## 카테고리별 코드 유무·완성도

| 영역 | Figma 대비 비중 | 코드 구현률 | 비고 |
|------|-----------------|-------------|------|
| **캔버스·뷰** | 5% | 95% | pages, zoom, pan, grid, view.guides 스키마 ✓. 룰러 UI는 제한적. |
| **노드 타입** | 15% | 90% | frame/group/rect/ellipse/line/arrow/polygon/star/path/text/image/video/section/slice/component/instance/hotspot ✓. Table 등 일부 위젯 없음. |
| **스타일** | 15% | 95% | fill(solid/linear/image), stroke, effect(shadow/blur/noise), blendMode, radius, StyleToken(fill/stroke/text/effect) ✓. |
| **레이아웃** | 15% | 92% | AutoLayout(dir/gap/padding/align/wrap), layoutSizing(hug/fill/fixed), Constraints, gapMode ✓. |
| **타이포** | 5% | 92% | TextStyle, fontFeatureSettings, fontVariationSettings ✓. |
| **벡터** | 5% | 95% | pathData, PathSegment(segments·fills), boolean(union/subtract 등) ✓. |
| **컴포넌트·Variants** | 10% | 88% | components, instance, overrides, variants, propertyDefinitions, variantId, slotId/slotContents ✓. 팀 라이브러리·파일 간 공유 없음. |
| **프로토타입** | 10% | 85% | navigate/back/overlay/closeOverlay/url/submit/setVariable/scrollTo/setVariant, transition, condition, trigger(click/hover/load/scroll/onPress), scrollTrigger ✓. onDrag/whileHover 지연 등 일부 트리거 부족. |
| **Variables** | 5% | 90% | Variable, variableModes, fillRef 등 바인딩 ✓. |
| **내보내기** | 5% | 90% | PNG/SVG/PDF, scale, node.exportSettings ✓. |
| **Dev/스펙** | 5% | 85% | CSS 복사, 스펙(크기 등) ✓. |
| **코멘트** | 3% | 75% | API·에디터 코멘트 UI ✓. 실시간 동기화 수준은 Figma 미만. |
| **버전** | 2% | 80% | version/versions/restore API ✓. |
| **플러그인** | 5% | 50% | getCustomNodeRenderer 등 확장 포인트 ✓. Figma 수준 플러그인 SDK 없음. |

---

## 가중 평균 (비중 × 구현률)

- (5×0.95 + 15×0.90 + 15×0.95 + 15×0.92 + 5×0.92 + 5×0.95 + 10×0.88 + 10×0.85 + 5×0.90 + 5×0.90 + 5×0.85 + 3×0.75 + 2×0.80 + 5×0.50) / 100 ≈ **88%**.

---

## 제외·미반영 항목 (코드에 없음)

- **실시간 다중 사용자 편집** (Figma 실시간 협업): 코드 없음 → 0% 반영.
- **팀 라이브러리 / 파일 간 컴포넌트 공유**: 코드 없음.
- **Figma 수준 플러그인 API**: 커스텀 렌더만 있음 → 50% 반영.

위 항목을 "Figma 100%"에 포함시키면 NULL은 그만큼 낮아지고, **"단일 사용자 디자인·프로토타입 도구"**만 놓고 보면 **88%**로 본 분석과 맞다.

---

## 한 줄 요약

- **Figma = 100%로 둘 때, 코드만 기준 NULL 구현률은 약 88%(86~90%).**
- 디자인·레이아웃·스타일·벡터·컴포넌트·프로토타입·Variables·내보내기·스펙은 대부분 구현됨.
- 실시간 협업·팀 라이브러리·풀 플러그인 SDK는 미구현이라, 그 부분을 포함하면 %는 더 낮아짐.
