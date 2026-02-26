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

(1~8항 목록은 done_FIGMA_IMPORT_ROADMAP.md와 동일. 아래 9~10만 링크 수정 반영.)

## 9. 폰트·에셋 폴백 및 문서화 ✅ 완료

- **문서**: [정보_FIGMA_임포트.md](./정보_FIGMA_임포트.md)에 "지원 Figma 타입", "스타일/레이아웃 매핑 표", "미지원·폴백 목록", "토큰 발급 방법" 정리 완료.

## 10. 검증 및 최종 점검 ✅ 완료

(내용 동일)

---

**총 10개 묶음.**  
**전체 전문**: 기존 done_FIGMA_IMPORT_ROADMAP.md와 동일. 보관 후 삭제 전까지 해당 파일 참고.
