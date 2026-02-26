import type { NodeType } from "../doc/scene";
import type { Tool } from "./AdvancedEditor.types";

export const GRID = 8;
export const DEFAULT_FONT_FAMILY =
  "Space Grotesk, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

export const DEFAULT_AUTO_LAYOUT = {
  mode: "auto" as const,
  dir: "row" as const,
  gap: 8,
  gapMode: "fixed" as const,
  padding: { t: 16, r: 16, b: 16, l: 16 },
  align: "start" as const,
  wrap: false,
};

export const NODE_TYPE_LABELS: Partial<Record<NodeType, string>> = {
  frame: "프레임",
  group: "그룹",
  rect: "사각형",
  ellipse: "원",
  line: "선",
  arrow: "화살표",
  polygon: "다각형",
  star: "별",
  path: "벡터",
  text: "텍스트",
  image: "이미지",
  video: "비디오",
  section: "섹션",
  slice: "슬라이스",
  component: "컴포넌트",
  instance: "인스턴스",
  hotspot: "핫스팟",
};

export const MESSAGE_LABELS: Record<string, string> = {
  save_failed: "저장에 실패했습니다.",
  publish_failed: "배포에 실패했습니다.",
  missing_page_id: "페이지 정보를 찾을 수 없습니다.",
  page_added: "페이지가 추가되었습니다.",
  page_duplicated: "페이지가 복제되었습니다.",
  page_deleted: "페이지가 삭제되었습니다.",
  page_delete_blocked: "페이지는 최소 1개 이상 유지되어야 합니다.",
  page_action_failed: "페이지 작업에 실패했습니다.",
  selection_required: "선택된 항목이 없습니다.",
  page_from_selection: "선택 항목으로 새 페이지를 만들었습니다.",
  form_step_added: "폼 단계를 추가했습니다.",
  form_step_failed: "폼 단계 추가에 실패했습니다.",
  snap_done: "그리드에 맞췄습니다.",
  mode_added: "모드를 추가했습니다.",
  mode_removed: "모드를 삭제했습니다.",
  mode_renamed: "모드를 이름 변경했습니다.",
  lock_applied: "선택 항목을 잠금 처리했습니다.",
  unlock_applied: "선택 항목 잠금을 해제했습니다.",
  hide_applied: "선택 항목을 숨겼습니다.",
  show_applied: "선택 항목 숨김을 해제했습니다.",
  fit_content_done: "내용에 맞게 크기를 조정했습니다.",
  tidy_parent_required: "같은 부모 안에서만 정리가 가능합니다.",
  tidy_done: "정리 완료",
  zoom_no_selection: "선택된 항목이 없습니다.",
  preset_added: "템플릿이 추가되었습니다.",
  preset_failed: "템플릿 추가에 실패했습니다.",
  component_pushed: "컴포넌트를 업데이트했습니다.",
  vector_coming_soon: "Boolean/Outline/Flatten/Join 등 벡터 연산은 추후 지원 예정입니다.",
  export_pdf_unsupported: "PDF 내보내기에 실패했습니다. jspdf를 확인해 주세요.",
};

export const TOOL_OPTIONS: Array<{ id: Tool; label: string }> = [
  { id: "select", label: "선택" },
  { id: "hand", label: "손" },
  { id: "frame", label: "프레임" },
  { id: "section", label: "섹션" },
  { id: "slice", label: "슬라이스" },
  { id: "rect", label: "사각형" },
  { id: "ellipse", label: "원" },
  { id: "line", label: "선" },
  { id: "arrow", label: "화살표" },
  { id: "polygon", label: "다각형" },
  { id: "star", label: "별" },
  { id: "path", label: "펜" },
  { id: "text", label: "텍스트" },
  { id: "image", label: "이미지" },
  { id: "video", label: "비디오" },
  { id: "comment", label: "코멘트" },
];

/** 툴바 그룹: 선택·손·코멘트 | 프레임·섹션·슬라이스 | 도형 | 텍스트·미디어 */
export const TOOL_GROUPS: Array<{ ids: Tool[] }> = [
  { ids: ["select", "hand", "comment"] },
  { ids: ["frame", "section", "slice"] },
  { ids: ["rect", "ellipse", "line", "arrow", "polygon", "star", "path"] },
  { ids: ["text", "image", "video"] },
];
