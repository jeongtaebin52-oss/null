import type { PresetDefinition } from "./AdvancedEditor.types";
import { makeFrameNode, makeTextNode, makeRectNode, makeEllipseNode, makeGroupNode, fieldPlaceholder } from "./AdvancedEditor.nodes";
import { makeRuntimeId } from "./AdvancedEditor.utils";

export const PRESET_GROUPS: Array<{ title: string; items: PresetDefinition[] }> = [
  {
    title: "기본 요소",
    items: [
      {
        id: "button",
        label: "버튼",
        size: { w: 160, h: 48 },
        build: (origin) => {
          const frame = makeFrameNode(
            "버튼",
            { x: origin.x, y: origin.y, w: 160, h: 48, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 12,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 12, r: 20, b: 12, l: 20 },
                align: "center",
                wrap: false,
              },
            },
          );
          const label = makeTextNode("버튼 텍스트", "버튼", { x: 0, y: 0, w: 80, h: 24, rotation: 0 }, { color: "#FFFFFF", size: 16, weight: 600, align: "center" });
          frame.children = [label.id];
          label.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [label.id]: label } };
        },
      },
      {
        id: "input",
        label: "입력",
        size: { w: 240, h: 44 },
        build: (origin) => {
          const frame = makeFrameNode(
            "입력 필드",
            { x: origin.x, y: origin.y, w: 240, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const placeholder = makeTextNode("플레이스홀더", "입력", { x: 0, y: 0, w: 100, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
          frame.children = [placeholder.id];
          placeholder.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [placeholder.id]: placeholder } };
        },
      },
      {
        id: "textarea",
        label: "텍스트 영역",
        size: { w: 320, h: 120 },
        build: (origin) => {
          const frame = makeFrameNode("텍스트 영역", { x: origin.x, y: origin.y, w: 320, h: 120, rotation: 0 }, { fill: "#FFFFFF", radius: 10, stroke: { color: "#D1D5DB", width: 1 } });
          const placeholder = makeTextNode("플레이스홀더", "여러 줄 입력", { x: 12, y: 20, w: 200, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
          frame.children = [placeholder.id];
          placeholder.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [placeholder.id]: placeholder } };
        },
      },
      {
        id: "checkbox",
        label: "체크박스",
        size: { w: 160, h: 32 },
        build: (origin) => {
          const frame = makeFrameNode(
            "체크박스",
            { x: origin.x, y: origin.y, w: 160, h: 32, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 6, r: 8, b: 6, l: 8 },
                align: "center",
                wrap: false,
              },
            },
          );
          const box = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const label = makeTextNode("라벨", "체크박스", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { size: 14 });
          frame.children = [box.id, label.id];
          box.parentId = frame.id;
          label.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [box.id]: box, [label.id]: label } };
        },
      },
      {
        id: "toggle",
        label: "토글",
        size: { w: 180, h: 32 },
        build: (origin) => {
          const frame = makeFrameNode(
            "토글",
            { x: origin.x, y: origin.y, w: 180, h: 32, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 10,
                padding: { t: 6, r: 8, b: 6, l: 8 },
                align: "center",
                wrap: false,
              },
            },
          );
          const toggleGroup = makeGroupNode("토글 스위치", { x: 0, y: 0, w: 36, h: 20, rotation: 0 });
          const track = makeRectNode("트랙", { x: 0, y: 0, w: 36, h: 20, rotation: 0 }, { fill: "#E5E7EB", radius: 10 });
          const knob = makeEllipseNode("노브", { x: 2, y: 2, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#D1D5DB", width: 1 } });
          toggleGroup.children = [track.id, knob.id];
          track.parentId = toggleGroup.id;
          knob.parentId = toggleGroup.id;
          const label = makeTextNode("라벨", "토글", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { size: 14 });
          frame.children = [toggleGroup.id, label.id];
          toggleGroup.parentId = frame.id;
          label.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [toggleGroup.id]: toggleGroup, [track.id]: track, [knob.id]: knob, [label.id]: label } };
        },
      },
    ],
  },
  {
    title: "레이아웃",
    items: [
      {
        id: "section",
        label: "섹션",
        size: { w: 960, h: 540 },
        build: (origin) => {
          const frame = makeFrameNode("섹션", { x: origin.x, y: origin.y, w: 960, h: 540, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#E5E7EB", width: 1 } });
          return { rootId: frame.id, nodes: { [frame.id]: frame } };
        },
      },
      {
        id: "container",
        label: "컨테이너",
        size: { w: 640, h: 360 },
        build: (origin) => {
          const frame = makeFrameNode("컨테이너", { x: origin.x, y: origin.y, w: 640, h: 360, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#E5E7EB", width: 1 }, radius: 12 });
          return { rootId: frame.id, nodes: { [frame.id]: frame } };
        },
      },
      {
        id: "stack-column",
        label: "세로 스택",
        size: { w: 320, h: 240 },
        build: (origin) => {
          const frame = makeFrameNode(
            "세로 스택",
            { x: origin.x, y: origin.y, w: 320, h: 240, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "start",
                wrap: false,
              },
            },
          );
          const item1 = makeRectNode("아이템 1", { x: 0, y: 0, w: 120, h: 36, rotation: 0 }, { fill: "#E5E7EB", radius: 8 });
          const item2 = makeRectNode("아이템 2", { x: 0, y: 0, w: 160, h: 36, rotation: 0 }, { fill: "#E5E7EB", radius: 8 });
          const item3 = makeRectNode("아이템 3", { x: 0, y: 0, w: 140, h: 36, rotation: 0 }, { fill: "#E5E7EB", radius: 8 });
          frame.children = [item1.id, item2.id, item3.id];
          item1.parentId = frame.id;
          item2.parentId = frame.id;
          item3.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [item1.id]: item1, [item2.id]: item2, [item3.id]: item3 } };
        },
      },
      {
        id: "stack-row",
        label: "가로 스택",
        size: { w: 360, h: 120 },
        build: (origin) => {
          const frame = makeFrameNode(
            "가로 스택",
            { x: origin.x, y: origin.y, w: 360, h: 120, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "center",
                wrap: false,
              },
            },
          );
          const item1 = makeRectNode("아이템 1", { x: 0, y: 0, w: 60, h: 60, rotation: 0 }, { fill: "#E5E7EB", radius: 10 });
          const item2 = makeRectNode("아이템 2", { x: 0, y: 0, w: 60, h: 60, rotation: 0 }, { fill: "#E5E7EB", radius: 10 });
          const item3 = makeRectNode("아이템 3", { x: 0, y: 0, w: 60, h: 60, rotation: 0 }, { fill: "#E5E7EB", radius: 10 });
          frame.children = [item1.id, item2.id, item3.id];
          item1.parentId = frame.id;
          item2.parentId = frame.id;
          item3.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [item1.id]: item1, [item2.id]: item2, [item3.id]: item3 } };
        },
      },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      {
        id: "card",
        label: "카드",
        size: { w: 280, h: 360 },
        build: (origin) => {
          const frame = makeFrameNode(
            "카드",
            { x: origin.x, y: origin.y, w: 280, h: 360, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "start",
                wrap: false,
              },
            },
          );
          const media = makeRectNode("이미지", { x: 0, y: 0, w: 248, h: 160, rotation: 0 }, { fill: "#E5E7EB", radius: 8 });
          const title = makeTextNode("제목", "카드 제목", { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 18, weight: 600 });
          const body = makeTextNode("설명", "설명 텍스트", { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { size: 14, color: "#6B7280" });
          frame.children = [media.id, title.id, body.id];
          media.parentId = frame.id;
          title.parentId = frame.id;
          body.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [media.id]: media, [title.id]: title, [body.id]: body } };
        },
      },
      {
        id: "hero",
        label: "히어로",
        size: { w: 960, h: 360 },
        build: (origin) => {
          const frame = makeFrameNode(
            "히어로",
            { x: origin.x, y: origin.y, w: 960, h: 360, rotation: 0 },
            {
              fill: "#F3F4F6",
              stroke: null,
              radius: 16,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 16,
                padding: { t: 48, r: 48, b: 48, l: 48 },
                align: "start",
                wrap: false,
              },
            },
          );
          const heading = makeTextNode("헤드라인", "제품 소개 헤드라인", { x: 0, y: 0, w: 480, h: 40, rotation: 0 }, { size: 32, weight: 700 });
          const sub = makeTextNode("설명", "핵심 가치를 한 문장으로 소개하세요.", { x: 0, y: 0, w: 420, h: 24, rotation: 0 }, { size: 16, color: "#4B5563" });
          const button = makeFrameNode(
            "CTA 버튼",
            { x: 0, y: 0, w: 140, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "시작하기", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          button.children = [buttonLabel.id];
          buttonLabel.parentId = button.id;
          frame.children = [heading.id, sub.id, button.id];
          heading.parentId = frame.id;
          sub.parentId = frame.id;
          button.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [heading.id]: heading, [sub.id]: sub, [button.id]: button, [buttonLabel.id]: buttonLabel } };
        },
      },
      {
        id: "list",
        label: "리스트",
        size: { w: 320, h: 200 },
        build: (origin) => {
          const frame = makeFrameNode(
            "리스트",
            { x: origin.x, y: origin.y, w: 320, h: 200, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 10,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "start",
                wrap: false,
              },
            },
          );
          const item1 = makeTextNode("항목 1", "리스트 항목 1", { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { size: 14 });
          const item2 = makeTextNode("항목 2", "리스트 항목 2", { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { size: 14 });
          const item3 = makeTextNode("항목 3", "리스트 항목 3", { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { size: 14 });
          frame.children = [item1.id, item2.id, item3.id];
          item1.parentId = frame.id;
          item2.parentId = frame.id;
          item3.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [item1.id]: item1, [item2.id]: item2, [item3.id]: item3 } };
        },
      },
    ],
  },
  {
    title: "내비/폼",
    items: [
      {
        id: "navbar",
        label: "네비게이션 바",
        size: { w: 960, h: 64 },
        build: (origin) => {
          const frame = makeFrameNode(
            "네비게이션 바",
            { x: origin.x, y: origin.y, w: 960, h: 64, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 24,
                padding: { t: 12, r: 24, b: 12, l: 24 },
                align: "center",
                wrap: false,
              },
            },
          );
          const logo = makeTextNode("로고", "로고", { x: 0, y: 0, w: 60, h: 24, rotation: 0 }, { size: 18, weight: 700 });
          const links = makeFrameNode(
            "메뉴",
            { x: 0, y: 0, w: 240, h: 24, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 16,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const link1 = makeTextNode("메뉴 1", "제품", { x: 0, y: 0, w: 40, h: 20, rotation: 0 }, { size: 14 });
          const link2 = makeTextNode("메뉴 2", "기능", { x: 0, y: 0, w: 40, h: 20, rotation: 0 }, { size: 14 });
          const link3 = makeTextNode("메뉴 3", "가격", { x: 0, y: 0, w: 40, h: 20, rotation: 0 }, { size: 14 });
          const link4 = makeTextNode("메뉴 4", "문의", { x: 0, y: 0, w: 40, h: 20, rotation: 0 }, { size: 14 });
          links.children = [link1.id, link2.id, link3.id, link4.id];
          link1.parentId = links.id;
          link2.parentId = links.id;
          link3.parentId = links.id;
          link4.parentId = links.id;
          frame.children = [logo.id, links.id];
          logo.parentId = frame.id;
          links.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [logo.id]: logo, [links.id]: links, [link1.id]: link1, [link2.id]: link2, [link3.id]: link3, [link4.id]: link4 } };
        },
      },
      {
        id: "footer",
        label: "푸터",
        size: { w: 960, h: 120 },
        build: (origin) => {
          const frame = makeFrameNode(
            "푸터",
            { x: origin.x, y: origin.y, w: 960, h: 120, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 8,
                padding: { t: 24, r: 24, b: 24, l: 24 },
                align: "start",
                wrap: false,
              },
            },
          );
          const title = makeTextNode("푸터 타이틀", "푸터", { x: 0, y: 0, w: 120, h: 24, rotation: 0 }, { color: "#FFFFFF", size: 16, weight: 600 });
          const meta = makeTextNode("푸터 정보", "© 2026 NULL STUDIO", { x: 0, y: 0, w: 240, h: 20, rotation: 0 }, { color: "#D1D5DB", size: 12 });
          frame.children = [title.id, meta.id];
          title.parentId = frame.id;
          meta.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [title.id]: title, [meta.id]: meta } };
        },
      },
      {
        id: "appbar",
        label: "앱 바",
        size: { w: 360, h: 56 },
        build: (origin) => {
          const frame = makeFrameNode(
            "앱 바",
            { x: origin.x, y: origin.y, w: 360, h: 56, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 12, r: 16, b: 12, l: 16 },
                align: "center",
                wrap: false,
              },
            },
          );
          const title = makeTextNode("타이틀", "앱 바", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 16, weight: 600 });
          frame.children = [title.id];
          title.parentId = frame.id;
          return { rootId: frame.id, nodes: { [frame.id]: frame, [title.id]: title } };
        },
      },
      {
        id: "form",
        label: "폼",
        size: { w: 360, h: 320 },
        build: (origin) => {
          const frame = makeFrameNode(
            "폼",
            { x: origin.x, y: origin.y, w: 360, h: 320, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const title = makeTextNode("타이틀", "문의하기", { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 18, weight: 600 });
          const input = makeFrameNode(
            "이름 입력",
            { x: 0, y: 0, w: 300, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const inputLabel = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("name", "이름"),
            { x: 0, y: 0, w: 120, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          input.children = [inputLabel.id];
          inputLabel.parentId = input.id;
          const textarea = makeFrameNode(
            "메시지 입력",
            { x: 0, y: 0, w: 300, h: 96, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
            },
          );
          const messageLabel = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("message", "메시지"),
            { x: 12, y: 20, w: 220, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          textarea.children = [messageLabel.id];
          messageLabel.parentId = textarea.id;
          const button = makeFrameNode(
            "제출 버튼",
            { x: 0, y: 0, w: 140, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "보내기", { x: 0, y: 0, w: 60, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          button.children = [buttonLabel.id];
          buttonLabel.parentId = button.id;
          frame.children = [title.id, input.id, textarea.id, button.id];
          title.parentId = frame.id;
          input.parentId = frame.id;
          textarea.parentId = frame.id;
          button.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [title.id]: title,
              [input.id]: input,
              [inputLabel.id]: inputLabel,
              [textarea.id]: textarea,
              [messageLabel.id]: messageLabel,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
            },
          };
        },
      },
    ],
  },
  {
    title: "인증/관리",
    items: [
      {
        id: "auth-login",
        label: "로그인 폼",
        size: { w: 360, h: 360 },
        build: (origin) => {
          const frame = makeFrameNode(
            "로그인 폼",
            { x: origin.x, y: origin.y, w: 360, h: 360, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 20, r: 20, b: 20, l: 20 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const title = makeTextNode("타이틀", "로그인", { x: 0, y: 0, w: 200, h: 28, rotation: 0 }, { size: 20, weight: 700 });
          const email = makeFrameNode(
            "이메일 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const emailPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("email", "이메일"),
            { x: 0, y: 0, w: 160, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          email.children = [emailPlaceholder.id];
          emailPlaceholder.parentId = email.id;
          const password = makeFrameNode(
            "비밀번호 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const passwordPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("password", "비밀번호"),
            { x: 0, y: 0, w: 170, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          password.children = [passwordPlaceholder.id];
          passwordPlaceholder.parentId = password.id;
          const remember = makeFrameNode(
            "자동 로그인 체크박스",
            { x: 0, y: 0, w: 180, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const rememberBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const rememberLabel = makeTextNode("라벨", "자동 로그인", { x: 0, y: 0, w: 100, h: 18, rotation: 0 }, { size: 12 });
          remember.children = [rememberBox.id, rememberLabel.id];
          rememberBox.parentId = remember.id;
          rememberLabel.parentId = remember.id;
          const button = makeFrameNode(
            "로그인 버튼",
            { x: 0, y: 0, w: 160, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "로그인", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          button.children = [buttonLabel.id];
          buttonLabel.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "submit", url: "/api/auth/login", method: "POST" },
              },
            ],
          };
          const helper = makeTextNode("도움말", "비밀번호를 잊으셨나요?", { x: 0, y: 0, w: 200, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
          frame.children = [title.id, email.id, password.id, remember.id, button.id, helper.id];
          title.parentId = frame.id;
          email.parentId = frame.id;
          password.parentId = frame.id;
          remember.parentId = frame.id;
          button.parentId = frame.id;
          helper.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [title.id]: title,
              [email.id]: email,
              [emailPlaceholder.id]: emailPlaceholder,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [remember.id]: remember,
              [rememberBox.id]: rememberBox,
              [rememberLabel.id]: rememberLabel,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
              [helper.id]: helper,
            },
          };
        },
      },
      {
        id: "auth-logout",
        label: "로그아웃 버튼",
        size: { w: 160, h: 44 },
        build: (origin) => {
          const button = makeFrameNode(
            "로그아웃 버튼",
            { x: origin.x, y: origin.y, w: 160, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const label = makeTextNode(
            "버튼 텍스트",
            "로그아웃",
            { x: 0, y: 0, w: 80, h: 20, rotation: 0 },
            { color: "#FFFFFF", size: 14, weight: 600, align: "center" },
          );
          button.children = [label.id];
          label.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "submit", url: "/api/auth/logout", method: "POST" },
              },
            ],
          };
          return { rootId: button.id, nodes: { [button.id]: button, [label.id]: label } };
        },
      },
      {
        id: "auth-signup",
        label: "회원가입 폼",
        size: { w: 360, h: 440 },
        build: (origin) => {
          const frame = makeFrameNode(
            "회원가입 폼",
            { x: origin.x, y: origin.y, w: 360, h: 440, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 20, r: 20, b: 20, l: 20 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const title = makeTextNode(
            "타이틀",
            "회원가입",
            { x: 0, y: 0, w: 200, h: 28, rotation: 0 },
            { size: 20, weight: 700 },
          );
          const name = makeFrameNode(
            "이름 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const namePlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("name", "이름"),
            { x: 0, y: 0, w: 160, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          name.children = [namePlaceholder.id];
          namePlaceholder.parentId = name.id;
          const email = makeFrameNode(
            "이메일 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const emailPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("email", "이메일"),
            { x: 0, y: 0, w: 170, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          email.children = [emailPlaceholder.id];
          emailPlaceholder.parentId = email.id;
          const password = makeFrameNode(
            "비밀번호 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const passwordPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("password", "비밀번호"),
            { x: 0, y: 0, w: 180, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          password.children = [passwordPlaceholder.id];
          passwordPlaceholder.parentId = password.id;
          const confirm = makeFrameNode(
            "비밀번호 확인 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const confirmPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("passwordConfirm", "비밀번호 확인"),
            { x: 0, y: 0, w: 220, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          confirm.children = [confirmPlaceholder.id];
          confirmPlaceholder.parentId = confirm.id;
          const terms = makeFrameNode(
            "약관 체크박스",
            { x: 0, y: 0, w: 200, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const termsBox = makeRectNode(
            "체크",
            { x: 0, y: 0, w: 16, h: 16, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 },
          );
          const termsLabel = makeTextNode(
            "라벨",
            fieldPlaceholder("terms", "약관에 동의합니다"),
            { x: 0, y: 0, w: 220, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          terms.children = [termsBox.id, termsLabel.id];
          termsBox.parentId = terms.id;
          termsLabel.parentId = terms.id;
          const button = makeFrameNode(
            "회원가입 버튼",
            { x: 0, y: 0, w: 160, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode(
            "버튼 텍스트",
            "가입하기",
            { x: 0, y: 0, w: 80, h: 20, rotation: 0 },
            { color: "#FFFFFF", size: 14, weight: 600, align: "center" },
          );
          button.children = [buttonLabel.id];
          buttonLabel.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "submit", url: "/api/auth/signup", method: "POST" },
              },
            ],
          };
          const helper = makeTextNode(
            "안내",
            "이미 계정이 있나요? 로그인",
            { x: 0, y: 0, w: 240, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          frame.children = [title.id, name.id, email.id, password.id, confirm.id, terms.id, button.id, helper.id];
          title.parentId = frame.id;
          name.parentId = frame.id;
          email.parentId = frame.id;
          password.parentId = frame.id;
          confirm.parentId = frame.id;
          terms.parentId = frame.id;
          button.parentId = frame.id;
          helper.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [title.id]: title,
              [name.id]: name,
              [namePlaceholder.id]: namePlaceholder,
              [email.id]: email,
              [emailPlaceholder.id]: emailPlaceholder,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [confirm.id]: confirm,
              [confirmPlaceholder.id]: confirmPlaceholder,
              [terms.id]: terms,
              [termsBox.id]: termsBox,
              [termsLabel.id]: termsLabel,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
              [helper.id]: helper,
            },
          };
        },
      },
      {
        id: "auth-flow",
        label: "로그인/회원가입 플로우",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("인증 플로우", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "payment-form",
        label: "결제 폼",
        size: { w: 420, h: 520 },
        build: (origin) => {
          const frame = makeFrameNode(
            "결제 폼",
            { x: origin.x, y: origin.y, w: 420, h: 520, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 20, r: 20, b: 20, l: 20 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const title = makeTextNode(
            "타이틀",
            "결제",
            { x: 0, y: 0, w: 200, h: 24, rotation: 0 },
            { size: 18, weight: 700 },
          );
          const planRow = makeFrameNode(
            "요금제",
            { x: 0, y: 0, w: 320, h: 96, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const planBasic = makeFrameNode(
            "베이직",
            { x: 0, y: 0, w: 150, h: 96, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 10,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 6,
                padding: { t: 12, r: 12, b: 12, l: 12 },
                align: "start",
                wrap: false,
              },
            },
          );
          const planBasicTitle = makeTextNode(
            "플랜 이름",
            "Basic",
            { x: 0, y: 0, w: 80, h: 20, rotation: 0 },
            { size: 14, weight: 600 },
          );
          const planBasicPrice = makeTextNode(
            "가격",
            "무료",
            { x: 0, y: 0, w: 120, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          planBasic.children = [planBasicTitle.id, planBasicPrice.id];
          planBasicTitle.parentId = planBasic.id;
          planBasicPrice.parentId = planBasic.id;
          const planPro = makeFrameNode(
            "프로",
            { x: 0, y: 0, w: 150, h: 96, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 6,
                padding: { t: 12, r: 12, b: 12, l: 12 },
                align: "start",
                wrap: false,
              },
            },
          );
          const planProTitle = makeTextNode(
            "플랜 이름",
            "Pro",
            { x: 0, y: 0, w: 80, h: 20, rotation: 0 },
            { size: 14, weight: 600, color: "#FFFFFF" },
          );
          const planProPrice = makeTextNode(
            "가격",
            "월 29,000원",
            { x: 0, y: 0, w: 140, h: 18, rotation: 0 },
            { size: 12, color: "#D1D5DB" },
          );
          planPro.children = [planProTitle.id, planProPrice.id];
          planProTitle.parentId = planPro.id;
          planProPrice.parentId = planPro.id;
          planRow.children = [planBasic.id, planPro.id];
          planBasic.parentId = planRow.id;
          planPro.parentId = planRow.id;
          const planSelect = makeFrameNode(
            "요금제 선택",
            { x: 0, y: 0, w: 320, h: 120, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 8,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "start",
                wrap: false,
              },
            },
          );
          const planStandard = makeFrameNode(
            "스탠다드 플랜",
            { x: 0, y: 0, w: 220, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const standardBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const standardLabel = makeTextNode("라벨", "스탠다드 플랜", { x: 0, y: 0, w: 140, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
          planStandard.children = [standardBox.id, standardLabel.id];
          standardBox.parentId = planStandard.id;
          standardLabel.parentId = planStandard.id;
          const planProSelect = makeFrameNode(
            "프로 플랜",
            { x: 0, y: 0, w: 220, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const proBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const proLabel = makeTextNode("라벨", "프로 플랜", { x: 0, y: 0, w: 120, h: 18, rotation: 0 }, { size: 12, color: "#111827" });
          planProSelect.children = [proBox.id, proLabel.id];
          proBox.parentId = planProSelect.id;
          proLabel.parentId = planProSelect.id;
          const planEnterprise = makeFrameNode(
            "엔터프라이즈 플랜",
            { x: 0, y: 0, w: 240, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const entBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const entLabel = makeTextNode("라벨", "엔터프라이즈 플랜", { x: 0, y: 0, w: 160, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
          planEnterprise.children = [entBox.id, entLabel.id];
          entBox.parentId = planEnterprise.id;
          entLabel.parentId = planEnterprise.id;
          planSelect.children = [planStandard.id, planProSelect.id, planEnterprise.id];
          planStandard.parentId = planSelect.id;
          planProSelect.parentId = planSelect.id;
          planEnterprise.parentId = planSelect.id;
          const cardNumber = makeFrameNode(
            "카드 번호 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const cardNumberPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("cardNumber", "카드 번호"),
            { x: 0, y: 0, w: 200, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          cardNumber.children = [cardNumberPlaceholder.id];
          cardNumberPlaceholder.parentId = cardNumber.id;
          const cardName = makeFrameNode(
            "카드 명의 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const cardNamePlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("cardName", "카드 명의"),
            { x: 0, y: 0, w: 200, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          cardName.children = [cardNamePlaceholder.id];
          cardNamePlaceholder.parentId = cardName.id;
          const cardRow = makeFrameNode(
            "결제 상세 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const expiry = makeFrameNode(
            "만료일 입력",
            { x: 0, y: 0, w: 150, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const expiryPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("cardExpiry", "MM/YY"),
            { x: 0, y: 0, w: 120, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          expiry.children = [expiryPlaceholder.id];
          expiryPlaceholder.parentId = expiry.id;
          const cvc = makeFrameNode(
            "CVC 입력",
            { x: 0, y: 0, w: 120, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const cvcPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("cardCvc", "CVC"),
            { x: 0, y: 0, w: 120, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          cvc.children = [cvcPlaceholder.id];
          cvcPlaceholder.parentId = cvc.id;
          cardRow.children = [expiry.id, cvc.id];
          expiry.parentId = cardRow.id;
          cvc.parentId = cardRow.id;
          const agree = makeFrameNode(
            "결제 약관 체크박스",
            { x: 0, y: 0, w: 200, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const agreeBox = makeRectNode(
            "체크",
            { x: 0, y: 0, w: 16, h: 16, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 },
          );
          const agreeLabel = makeTextNode(
            "라벨",
            fieldPlaceholder("terms", "결제 약관 동의"),
            { x: 0, y: 0, w: 220, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          agree.children = [agreeBox.id, agreeLabel.id];
          agreeBox.parentId = agree.id;
          agreeLabel.parentId = agree.id;
          const button = makeFrameNode(
            "결제 버튼",
            { x: 0, y: 0, w: 160, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode(
            "버튼 텍스트",
            "결제하기",
            { x: 0, y: 0, w: 80, h: 20, rotation: 0 },
            { color: "#FFFFFF", size: 14, weight: 600, align: "center" },
          );
          button.children = [buttonLabel.id];
          buttonLabel.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "submit", url: "/api/billing/upgrade", method: "POST" },
              },
            ],
          };
          const helper = makeTextNode(
            "안내",
            "결제는 안전하게 처리됩니다.",
            { x: 0, y: 0, w: 260, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          frame.children = [title.id, planRow.id, planSelect.id, cardNumber.id, cardName.id, cardRow.id, agree.id, button.id, helper.id];
          title.parentId = frame.id;
          planRow.parentId = frame.id;
          planSelect.parentId = frame.id;
          cardNumber.parentId = frame.id;
          cardName.parentId = frame.id;
          cardRow.parentId = frame.id;
          agree.parentId = frame.id;
          button.parentId = frame.id;
          helper.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [title.id]: title,
              [planRow.id]: planRow,
              [planBasic.id]: planBasic,
              [planBasicTitle.id]: planBasicTitle,
              [planBasicPrice.id]: planBasicPrice,
              [planPro.id]: planPro,
              [planProTitle.id]: planProTitle,
              [planProPrice.id]: planProPrice,
              [planSelect.id]: planSelect,
              [planStandard.id]: planStandard,
              [standardBox.id]: standardBox,
              [standardLabel.id]: standardLabel,
              [planProSelect.id]: planProSelect,
              [proBox.id]: proBox,
              [proLabel.id]: proLabel,
              [planEnterprise.id]: planEnterprise,
              [entBox.id]: entBox,
              [entLabel.id]: entLabel,
              [cardNumber.id]: cardNumber,
              [cardNumberPlaceholder.id]: cardNumberPlaceholder,
              [cardName.id]: cardName,
              [cardNamePlaceholder.id]: cardNamePlaceholder,
              [cardRow.id]: cardRow,
              [expiry.id]: expiry,
              [expiryPlaceholder.id]: expiryPlaceholder,
              [cvc.id]: cvc,
              [cvcPlaceholder.id]: cvcPlaceholder,
              [agree.id]: agree,
              [agreeBox.id]: agreeBox,
              [agreeLabel.id]: agreeLabel,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
              [helper.id]: helper,
            },
          };
        },
      },
      {
        id: "admin-panel",
        label: "관리자 패널",
        size: { w: 960, h: 600 },
        build: (origin) => {
          const frame = makeFrameNode(
            "관리자 패널",
            { x: origin.x, y: origin.y, w: 960, h: 600, rotation: 0 },
            {
              fill: "#F3F4F6",
              stroke: { color: "#E5E7EB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 0,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const sidebar = makeFrameNode(
            "사이드바",
            { x: 0, y: 0, w: 220, h: 600, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 20, r: 16, b: 20, l: 16 },
                align: "start",
                wrap: false,
              },
            },
          );
          const brand = makeTextNode("브랜드", "관리자", { x: 0, y: 0, w: 120, h: 24, rotation: 0 }, { color: "#FFFFFF", size: 18, weight: 700 });
          const menuDash = makeTextNode("메뉴", "대시보드", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600 });
          const menuUsers = makeTextNode("메뉴", "사용자", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#D1D5DB", size: 14 });
          const menuPayments = makeTextNode("메뉴", "결제", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#D1D5DB", size: 14 });
          const menuSettings = makeTextNode("메뉴", "설정", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#D1D5DB", size: 14 });
          sidebar.children = [brand.id, menuDash.id, menuUsers.id, menuPayments.id, menuSettings.id];
          brand.parentId = sidebar.id;
          menuDash.parentId = sidebar.id;
          menuUsers.parentId = sidebar.id;
          menuPayments.parentId = sidebar.id;
          menuSettings.parentId = sidebar.id;
          const content = makeFrameNode(
            "콘텐츠",
            { x: 0, y: 0, w: 740, h: 600, rotation: 0 },
            {
              fill: "#F9FAFB",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 16,
                padding: { t: 24, r: 24, b: 24, l: 24 },
                align: "start",
                wrap: false,
              },
            },
          );
          const header = makeFrameNode(
            "헤더",
            { x: 0, y: 0, w: 680, h: 40, rotation: 0 },
            {
              fill: "#F9FAFB",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const headerTitle = makeTextNode("타이틀", "대시보드", { x: 0, y: 0, w: 160, h: 24, rotation: 0 }, { size: 20, weight: 700 });
          const headerSpacer = makeFrameNode(
            "스페이서",
            { x: 0, y: 0, w: 40, h: 1, rotation: 0 },
            { fill: "#F9FAFB", stroke: null, layoutSizing: { width: "fill", height: "fixed" } },
          );
          const headerButton = makeFrameNode(
            "새 사용자",
            { x: 0, y: 0, w: 110, h: 32, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 6,
                padding: { t: 6, r: 12, b: 6, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const headerButtonLabel = makeTextNode(
            "버튼 텍스트",
            "새 사용자",
            { x: 0, y: 0, w: 80, h: 18, rotation: 0 },
            { color: "#FFFFFF", size: 12, weight: 600, align: "center" },
          );
          headerButton.children = [headerButtonLabel.id];
          headerButtonLabel.parentId = headerButton.id;
          header.children = [headerTitle.id, headerSpacer.id, headerButton.id];
          headerTitle.parentId = header.id;
          headerSpacer.parentId = header.id;
          headerButton.parentId = header.id;
          const stats = makeFrameNode(
            "통계",
            { x: 0, y: 0, w: 680, h: 90, rotation: 0 },
            {
              fill: "#F9FAFB",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 0, r: 0, b: 0, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const statUsers = makeFrameNode(
            "사용자 카드",
            { x: 0, y: 0, w: 200, h: 80, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 6,
                padding: { t: 12, r: 12, b: 12, l: 12 },
                align: "start",
                wrap: false,
              },
            },
          );
          const statUsersLabel = makeTextNode("라벨", "총 사용자", { x: 0, y: 0, w: 120, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
          const statUsersValue = makeTextNode("값", "1,240", { x: 0, y: 0, w: 80, h: 22, rotation: 0 }, { size: 18, weight: 700 });
          statUsers.children = [statUsersLabel.id, statUsersValue.id];
          statUsersLabel.parentId = statUsers.id;
          statUsersValue.parentId = statUsers.id;
          const statRevenue = makeFrameNode(
            "매출 카드",
            { x: 0, y: 0, w: 200, h: 80, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 6,
                padding: { t: 12, r: 12, b: 12, l: 12 },
                align: "start",
                wrap: false,
              },
            },
          );
          const statRevenueLabel = makeTextNode(
            "라벨",
            "이번 달 매출",
            { x: 0, y: 0, w: 120, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          const statRevenueValue = makeTextNode("값", "12.4M KRW", { x: 0, y: 0, w: 100, h: 22, rotation: 0 }, { size: 18, weight: 700 });
          statRevenue.children = [statRevenueLabel.id, statRevenueValue.id];
          statRevenueLabel.parentId = statRevenue.id;
          statRevenueValue.parentId = statRevenue.id;
          const statActive = makeFrameNode(
            "활성 카드",
            { x: 0, y: 0, w: 200, h: 80, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 6,
                padding: { t: 12, r: 12, b: 12, l: 12 },
                align: "start",
                wrap: false,
              },
            },
          );
          const statActiveLabel = makeTextNode(
            "라벨",
            "활성 사용자",
            { x: 0, y: 0, w: 120, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          const statActiveValue = makeTextNode("값", "68%", { x: 0, y: 0, w: 80, h: 22, rotation: 0 }, { size: 18, weight: 700 });
          statActive.children = [statActiveLabel.id, statActiveValue.id];
          statActiveLabel.parentId = statActive.id;
          statActiveValue.parentId = statActive.id;
          stats.children = [statUsers.id, statRevenue.id, statActive.id];
          statUsers.parentId = stats.id;
          statRevenue.parentId = stats.id;
          statActive.parentId = stats.id;
          const table = makeFrameNode(
            "데이터 테이블",
            { x: 0, y: 0, w: 680, h: 240, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
            },
          );
          table.data = {
            type: "collection",
            collectionId: "",
            mode: "table",
            limit: 30,
            editable: true,
            allowDelete: true,
          };
          content.children = [header.id, stats.id, table.id];
          header.parentId = content.id;
          stats.parentId = content.id;
          table.parentId = content.id;
          frame.children = [sidebar.id, content.id];
          sidebar.parentId = frame.id;
          content.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [sidebar.id]: sidebar,
              [brand.id]: brand,
              [menuDash.id]: menuDash,
              [menuUsers.id]: menuUsers,
              [menuPayments.id]: menuPayments,
              [menuSettings.id]: menuSettings,
              [content.id]: content,
              [header.id]: header,
              [headerTitle.id]: headerTitle,
              [headerSpacer.id]: headerSpacer,
              [headerButton.id]: headerButton,
              [headerButtonLabel.id]: headerButtonLabel,
              [stats.id]: stats,
              [statUsers.id]: statUsers,
              [statUsersLabel.id]: statUsersLabel,
              [statUsersValue.id]: statUsersValue,
              [statRevenue.id]: statRevenue,
              [statRevenueLabel.id]: statRevenueLabel,
              [statRevenueValue.id]: statRevenueValue,
              [statActive.id]: statActive,
              [statActiveLabel.id]: statActiveLabel,
              [statActiveValue.id]: statActiveValue,
              [table.id]: table,
            },
          };
        },
      },
    ],
  },
  {
    title: "검증/테스트",
    items: [
      {
        id: "test-stage",
        label: "전체 테스트 스테이지",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("테스트 스테이지", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "form-flow-3",
        label: "폼 플로우(3단계)",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("폼 플로우", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "page-nav-demo",
        label: "페이지 네비 데모",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("페이지 네비 데모", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "hover-overlay-demo",
        label: "호버 오버레이 데모",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("호버 오버레이 데모", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "test-link-account",
        label: "링크 버튼 (계정)",
        size: { w: 200, h: 44 },
        build: (origin) => {
          const button = makeFrameNode(
            "계정 링크 버튼",
            { x: origin.x, y: origin.y, w: 200, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const label = makeTextNode("버튼 텍스트", "계정 보기", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          button.children = [label.id];
          label.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "url", url: "/account", openInNewTab: false },
              },
            ],
          };
          return { rootId: button.id, nodes: { [button.id]: button, [label.id]: label } };
        },
      },
      {
        id: "test-link-upgrade",
        label: "링크 버튼 (업그레이드)",
        size: { w: 220, h: 44 },
        build: (origin) => {
          const button = makeFrameNode(
            "업그레이드 링크 버튼",
            { x: origin.x, y: origin.y, w: 220, h: 44, rotation: 0 },
            {
              fill: "#2563EB",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const label = makeTextNode("버튼 텍스트", "업그레이드 보기", { x: 0, y: 0, w: 140, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          button.children = [label.id];
          label.parentId = button.id;
          button.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "url", url: "/upgrade", openInNewTab: false },
              },
            ],
          };
          return { rootId: button.id, nodes: { [button.id]: button, [label.id]: label } };
        },
      },
      {
        id: "test-interaction-panel",
        label: "상호작용 테스트 패널",
        size: { w: 420, h: 520 },
        build: (origin) => {
          const panel = makeFrameNode(
            "상호작용 테스트 패널",
            { x: origin.x, y: origin.y, w: 420, h: 520, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "column",
                gap: 12,
                padding: { t: 20, r: 20, b: 20, l: 20 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const title = makeTextNode("타이틀", "상호작용 테스트", { x: 0, y: 0, w: 240, h: 24, rotation: 0 }, { size: 18, weight: 700 });

          const email = makeFrameNode(
            "이메일 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const emailPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("email", "이메일"),
            { x: 0, y: 0, w: 200, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          email.children = [emailPlaceholder.id];
          emailPlaceholder.parentId = email.id;

          const password = makeFrameNode(
            "비밀번호 입력",
            { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
            {
              fill: "#FFFFFF",
              radius: 10,
              stroke: { color: "#D1D5DB", width: 1 },
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 12, b: 10, l: 12 },
                align: "center",
                wrap: false,
              },
            },
          );
          const passwordPlaceholder = makeTextNode(
            "플레이스홀더",
            fieldPlaceholder("password", "비밀번호"),
            { x: 0, y: 0, w: 200, h: 20, rotation: 0 },
            { color: "#9CA3AF", size: 14 },
          );
          password.children = [passwordPlaceholder.id];
          passwordPlaceholder.parentId = password.id;

          const checkbox = makeFrameNode(
            "체크박스 테스트",
            { x: 0, y: 0, w: 200, h: 28, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 4, r: 0, b: 4, l: 0 },
                align: "center",
                wrap: false,
              },
            },
          );
          const checkboxBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
          const checkboxLabel = makeTextNode(
            "라벨",
            fieldPlaceholder("terms", "체크박스"),
            { x: 0, y: 0, w: 180, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          checkbox.children = [checkboxBox.id, checkboxLabel.id];
          checkboxBox.parentId = checkbox.id;
          checkboxLabel.parentId = checkbox.id;

          const toggle = makeFrameNode(
            "토글 테스트",
            { x: 0, y: 0, w: 200, h: 32, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: null,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 10,
                padding: { t: 6, r: 8, b: 6, l: 8 },
                align: "center",
                wrap: false,
              },
            },
          );
          const toggleGroup = makeGroupNode("토글 스위치", { x: 0, y: 0, w: 36, h: 20, rotation: 0 });
          const toggleTrack = makeRectNode("트랙", { x: 0, y: 0, w: 36, h: 20, rotation: 0 }, { fill: "#E5E7EB", radius: 10 });
          const toggleKnob = makeEllipseNode("노브", { x: 2, y: 2, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#D1D5DB", width: 1 } });
          toggleGroup.children = [toggleTrack.id, toggleKnob.id];
          toggleTrack.parentId = toggleGroup.id;
          toggleKnob.parentId = toggleGroup.id;
          const toggleLabel = makeTextNode(
            "라벨",
            fieldPlaceholder("toggle", "토글"),
            { x: 0, y: 0, w: 140, h: 18, rotation: 0 },
            { size: 12, color: "#6B7280" },
          );
          toggle.children = [toggleGroup.id, toggleLabel.id];
          toggleGroup.parentId = toggle.id;
          toggleLabel.parentId = toggle.id;

          const loginButton = makeFrameNode(
            "로그인 테스트 버튼",
            { x: 0, y: 0, w: 180, h: 44, rotation: 0 },
            {
              fill: "#111827",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 10, r: 18, b: 10, l: 18 },
                align: "center",
                wrap: false,
              },
            },
          );
          const loginLabel = makeTextNode("버튼 텍스트", "로그인 테스트", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
          loginButton.children = [loginLabel.id];
          loginLabel.parentId = loginButton.id;
          loginButton.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "submit", url: "/api/auth/login", method: "POST" },
              },
            ],
          };

          const accountButton = makeFrameNode(
            "계정 이동 버튼",
            { x: 0, y: 0, w: 180, h: 40, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#111827", width: 1 },
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 8, r: 14, b: 8, l: 14 },
                align: "center",
                wrap: false,
              },
            },
          );
          const accountLabel = makeTextNode("버튼 텍스트", "계정으로 이동", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { size: 13, weight: 600, align: "center" });
          accountButton.children = [accountLabel.id];
          accountLabel.parentId = accountButton.id;
          accountButton.prototype = {
            interactions: [
              {
                id: makeRuntimeId("proto"),
                trigger: "click",
                action: { type: "url", url: "/account", openInNewTab: false },
              },
            ],
          };

          panel.children = [
            title.id,
            email.id,
            password.id,
            checkbox.id,
            toggle.id,
            loginButton.id,
            accountButton.id,
          ];
          title.parentId = panel.id;
          email.parentId = panel.id;
          password.parentId = panel.id;
          checkbox.parentId = panel.id;
          toggle.parentId = panel.id;
          loginButton.parentId = panel.id;
          accountButton.parentId = panel.id;

          return {
            rootId: panel.id,
            nodes: {
              [panel.id]: panel,
              [title.id]: title,
              [email.id]: email,
              [emailPlaceholder.id]: emailPlaceholder,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [checkbox.id]: checkbox,
              [checkboxBox.id]: checkboxBox,
              [checkboxLabel.id]: checkboxLabel,
              [toggle.id]: toggle,
              [toggleGroup.id]: toggleGroup,
              [toggleTrack.id]: toggleTrack,
              [toggleKnob.id]: toggleKnob,
              [toggleLabel.id]: toggleLabel,
              [loginButton.id]: loginButton,
              [loginLabel.id]: loginLabel,
              [accountButton.id]: accountButton,
              [accountLabel.id]: accountLabel,
            },
          };
        },
      },
      {
        id: "test-responsive-stack",
        label: "반응형 카드 스택",
        size: { w: 520, h: 220 },
        build: (origin) => {
          const frame = makeFrameNode(
            "반응형 카드 스택",
            { x: origin.x, y: origin.y, w: 520, h: 220, rotation: 0 },
            {
              fill: "#FFFFFF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 12,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 12,
                padding: { t: 16, r: 16, b: 16, l: 16 },
                align: "stretch",
                wrap: false,
              },
            },
          );
          const cardA = makeFrameNode(
            "카드 A",
            { x: 0, y: 0, w: 160, h: 140, rotation: 0 },
            {
              fill: "#F3F4F6",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 10,
              layout: { mode: "auto", dir: "column", gap: 6, padding: { t: 12, r: 12, b: 12, l: 12 }, align: "start", wrap: false },
              layoutSizing: { width: "fill", height: "fill" },
            },
          );
          const cardB = makeFrameNode(
            "카드 B",
            { x: 0, y: 0, w: 160, h: 140, rotation: 0 },
            {
              fill: "#EEF2FF",
              stroke: { color: "#E5E7EB", width: 1 },
              radius: 10,
              layout: { mode: "auto", dir: "column", gap: 6, padding: { t: 12, r: 12, b: 12, l: 12 }, align: "start", wrap: false },
              layoutSizing: { width: "fill", height: "fill" },
            },
          );
          const titleA = makeTextNode("타이틀", "반응형 카드 A", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { size: 12, weight: 600 });
          const descA = makeTextNode("설명", "자동 레이아웃 + fill", { x: 0, y: 0, w: 120, h: 18, rotation: 0 }, { size: 11, color: "#6B7280" });
          const titleB = makeTextNode("타이틀", "반응형 카드 B", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { size: 12, weight: 600 });
          const descB = makeTextNode("설명", "창 크기에 맞춰 확장", { x: 0, y: 0, w: 140, h: 18, rotation: 0 }, { size: 11, color: "#6B7280" });
          cardA.children = [titleA.id, descA.id];
          cardB.children = [titleB.id, descB.id];
          titleA.parentId = cardA.id;
          descA.parentId = cardA.id;
          titleB.parentId = cardB.id;
          descB.parentId = cardB.id;
          frame.children = [cardA.id, cardB.id];
          cardA.parentId = frame.id;
          cardB.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [cardA.id]: cardA,
              [cardB.id]: cardB,
              [titleA.id]: titleA,
              [descA.id]: descA,
              [titleB.id]: titleB,
              [descB.id]: descB,
            },
          };
        },
      },
    ],
  },
];