import type { PresetDefinition } from "./AdvancedEditor.types";
import type { Node } from "../doc/scene";
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
    title: "테스트",
    items: [
      {
        id: "kream-flow",
        label: "KREAM 전체 플로우",
        size: { w: 0, h: 0 },
        build: (origin) => {
          const placeholder = makeFrameNode("kream-flow", { x: origin.x, y: origin.y, w: 10, h: 10, rotation: 0 }, { fill: "#FFFFFF" });
          return { rootId: placeholder.id, nodes: { [placeholder.id]: placeholder } };
        },
      },
      {
        id: "kream-onboarding",
        label: "KREAM 온보딩",
        size: { w: 390, h: 844 },
        build: (origin) => {
          const frame = makeFrameNode(
            "KREAM 온보딩",
            { x: origin.x, y: origin.y, w: 390, h: 844, rotation: 0 },
            { fill: "#111111", stroke: null },
          );
          const logo = makeTextNode(
            "KREAM 로고",
            "KREAM",
            { x: 95, y: 382, w: 200, h: 36, rotation: 0 },
            { color: "#FFFFFF", size: 36, weight: 800, align: "center" },
          );
          if (logo.text) logo.text.style.letterSpacing = 1.4;
          const tagline = makeTextNode(
            "슬로건",
            "KICKS RULE EVERYTHING AROUND ME",
            { x: 75, y: 424, w: 240, h: 12, rotation: 0 },
            { color: "#FFFFFF", size: 8, weight: 600, align: "center" },
          );
          if (tagline.text) tagline.text.style.letterSpacing = 1.2;
          frame.children = [logo.id, tagline.id];
          logo.parentId = frame.id;
          tagline.parentId = frame.id;
          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [logo.id]: logo,
              [tagline.id]: tagline,
            },
          };
        },
      },
      {
        id: "kream-login",
        label: "KREAM 로그인",
        size: { w: 390, h: 844 },
        build: (origin) => {
          const frameW = 390;
          const frameH = 844;
          const marginX = 24;
          const contentW = frameW - marginX * 2;
          const lineColor = "#E5E5E5";
          const placeholderColor = "#B9B9B9";

          const frame = makeFrameNode(
            "KREAM 로그인",
            { x: origin.x, y: origin.y, w: frameW, h: frameH, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );

          const close = makeTextNode("닫기", "×", { x: 350, y: 20, w: 20, h: 20, rotation: 0 }, { size: 16, weight: 600, align: "center" });
          const logo = makeTextNode("KREAM 로고", "KREAM", { x: 95, y: 96, w: 200, h: 32, rotation: 0 }, { size: 28, weight: 800, align: "center" });
          if (logo.text) logo.text.style.letterSpacing = 1.2;
          const tagline = makeTextNode(
            "슬로건",
            "KICKS RULE EVERYTHING AROUND ME",
            { x: 70, y: 128, w: 250, h: 12, rotation: 0 },
            { size: 8, weight: 600, align: "center", color: "#111111" },
          );
          if (tagline.text) tagline.text.style.letterSpacing = 1.1;
          close.constraints = { right: true, top: true };
          logo.constraints = { hCenter: true, top: true };
          tagline.constraints = { hCenter: true, top: true };

          const emailLabel = makeTextNode("라벨", "이메일 주소", { x: marginX, y: 190, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const email = makeFrameNode(
            "이메일 입력",
            { x: marginX, y: 210, w: contentW, h: 34, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          emailLabel.constraints = { left: true, right: true, top: true };
          email.constraints = { left: true, right: true, top: true };
          const emailPlaceholder = makeTextNode(
            "플레이스홀더",
            "예) kream@kream.co.kr",
            { x: 0, y: 8, w: 220, h: 16, rotation: 0 },
            { size: 12, color: placeholderColor },
          );
          const emailLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          email.children = [emailPlaceholder.id, emailLine.id];
          emailPlaceholder.parentId = email.id;
          emailLine.parentId = email.id;

          const passwordLabel = makeTextNode("라벨", "비밀번호", { x: marginX, y: 260, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const password = makeFrameNode(
            "비밀번호 입력",
            { x: marginX, y: 280, w: contentW, h: 34, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          passwordLabel.constraints = { left: true, right: true, top: true };
          password.constraints = { left: true, right: true, top: true };
          const passwordPlaceholder = makeTextNode(
            "플레이스홀더",
            "비밀번호",
            { x: 0, y: 8, w: 120, h: 16, rotation: 0 },
            { size: 12, color: placeholderColor },
          );
          const passwordLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          const eye = makeGroupNode("보기 아이콘", { x: contentW - 20, y: 9, w: 16, h: 10, rotation: 0 });
          const eyeOuter = makeEllipseNode("눈", { x: 0, y: 0, w: 16, h: 10, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#B9B9B9", width: 1 } });
          const eyeDot = makeEllipseNode("동공", { x: 6, y: 3, w: 4, h: 4, rotation: 0 }, { fill: "#B9B9B9" });
          eye.children = [eyeOuter.id, eyeDot.id];
          eyeOuter.parentId = eye.id;
          eyeDot.parentId = eye.id;
          password.children = [passwordPlaceholder.id, passwordLine.id, eye.id];
          passwordPlaceholder.parentId = password.id;
          passwordLine.parentId = password.id;
          eye.parentId = password.id;

          const button = makeFrameNode(
            "로그인 버튼",
            { x: marginX, y: 344, w: contentW, h: 48, rotation: 0 },
            {
              fill: "#E0E0E0",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 12, r: 16, b: 12, l: 16 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "로그인", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { size: 14, weight: 600, color: "#B9B9B9", align: "center" });
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
          button.constraints = { left: true, right: true, top: true };

          const linkRow = makeFrameNode(
            "링크 행",
            { x: marginX, y: 408, w: contentW, h: 18, rotation: 0 },
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
          const link1 = makeTextNode("링크", "이메일 가입", { x: 0, y: 0, w: 60, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const sep1 = makeRectNode("구분선", { x: 0, y: 2, w: 1, h: 12, rotation: 0 }, { fill: "#D1D5DB" });
          const link2 = makeTextNode("링크", "이메일 찾기", { x: 0, y: 0, w: 60, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const sep2 = makeRectNode("구분선", { x: 0, y: 2, w: 1, h: 12, rotation: 0 }, { fill: "#D1D5DB" });
          const link3 = makeTextNode("링크", "비밀번호 찾기", { x: 0, y: 0, w: 72, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          linkRow.children = [link1.id, sep1.id, link2.id, sep2.id, link3.id];
          link1.parentId = linkRow.id;
          sep1.parentId = linkRow.id;
          link2.parentId = linkRow.id;
          sep2.parentId = linkRow.id;
          link3.parentId = linkRow.id;
          linkRow.constraints = { left: true, right: true, top: true };

          frame.children = [
            close.id,
            logo.id,
            tagline.id,
            emailLabel.id,
            email.id,
            passwordLabel.id,
            password.id,
            button.id,
            linkRow.id,
          ];
          close.parentId = frame.id;
          logo.parentId = frame.id;
          tagline.parentId = frame.id;
          emailLabel.parentId = frame.id;
          email.parentId = frame.id;
          passwordLabel.parentId = frame.id;
          password.parentId = frame.id;
          button.parentId = frame.id;
          linkRow.parentId = frame.id;

          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [close.id]: close,
              [logo.id]: logo,
              [tagline.id]: tagline,
              [emailLabel.id]: emailLabel,
              [email.id]: email,
              [emailPlaceholder.id]: emailPlaceholder,
              [emailLine.id]: emailLine,
              [passwordLabel.id]: passwordLabel,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [passwordLine.id]: passwordLine,
              [eye.id]: eye,
              [eyeOuter.id]: eyeOuter,
              [eyeDot.id]: eyeDot,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
              [linkRow.id]: linkRow,
              [link1.id]: link1,
              [sep1.id]: sep1,
              [link2.id]: link2,
              [sep2.id]: sep2,
              [link3.id]: link3,
            },
          };
        },
      },
      {
        id: "kream-signup",
        label: "KREAM 회원가입",
        size: { w: 390, h: 844 },
        build: (origin) => {
          const frameW = 390;
          const frameH = 844;
          const marginX = 24;
          const contentW = frameW - marginX * 2;
          const lineColor = "#E5E5E5";
          const placeholderColor = "#B9B9B9";

          const frame = makeFrameNode(
            "KREAM 회원가입",
            { x: origin.x, y: origin.y, w: frameW, h: frameH, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          const back = makeTextNode("뒤로", "←", { x: 18, y: 24, w: 20, h: 20, rotation: 0 }, { size: 16, weight: 600, align: "center" });
          const title = makeTextNode("타이틀", "회원가입", { x: marginX, y: 56, w: 120, h: 24, rotation: 0 }, { size: 20, weight: 700, color: "#111111" });
          back.constraints = { left: true, top: true };
          title.constraints = { left: true, top: true };

          const emailLabel = makeTextNode("라벨", "이메일 주소", { x: marginX, y: 116, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const email = makeFrameNode("이메일 입력", { x: marginX, y: 136, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          emailLabel.constraints = { left: true, right: true, top: true };
          email.constraints = { left: true, right: true, top: true };
          const emailPlaceholder = makeTextNode("플레이스홀더", "이메일 주소", { x: 0, y: 8, w: 140, h: 16, rotation: 0 }, { size: 12, color: placeholderColor });
          const emailLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          email.children = [emailPlaceholder.id, emailLine.id];
          emailPlaceholder.parentId = email.id;
          emailLine.parentId = email.id;

          const passwordLabel = makeTextNode("라벨", "비밀번호", { x: marginX, y: 186, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const password = makeFrameNode("비밀번호 입력", { x: marginX, y: 206, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          passwordLabel.constraints = { left: true, right: true, top: true };
          password.constraints = { left: true, right: true, top: true };
          const passwordPlaceholder = makeTextNode("플레이스홀더", "비밀번호", { x: 0, y: 8, w: 120, h: 16, rotation: 0 }, { size: 12, color: placeholderColor });
          const passwordLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          const eye = makeGroupNode("보기 아이콘", { x: contentW - 20, y: 9, w: 16, h: 10, rotation: 0 });
          const eyeOuter = makeEllipseNode("눈", { x: 0, y: 0, w: 16, h: 10, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#B9B9B9", width: 1 } });
          const eyeDot = makeEllipseNode("동공", { x: 6, y: 3, w: 4, h: 4, rotation: 0 }, { fill: "#B9B9B9" });
          eye.children = [eyeOuter.id, eyeDot.id];
          eyeOuter.parentId = eye.id;
          eyeDot.parentId = eye.id;
          password.children = [passwordPlaceholder.id, passwordLine.id, eye.id];
          passwordPlaceholder.parentId = password.id;
          passwordLine.parentId = password.id;
          eye.parentId = password.id;

          const sizeLabel = makeTextNode("라벨", "스니커즈 사이즈", { x: marginX, y: 256, w: 140, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const sizeInput = makeFrameNode("사이즈 입력", { x: marginX, y: 276, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          sizeLabel.constraints = { left: true, right: true, top: true };
          sizeInput.constraints = { left: true, right: true, top: true };
          const sizePlaceholder = makeTextNode("플레이스홀더", "선택하세요", { x: 0, y: 8, w: 140, h: 16, rotation: 0 }, { size: 12, color: placeholderColor });
          const sizeLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          const sizeArrow = makeTextNode("화살표", "▾", { x: contentW - 14, y: 8, w: 12, h: 16, rotation: 0 }, { size: 12, color: "#111111", align: "center" });
          sizeInput.children = [sizePlaceholder.id, sizeLine.id, sizeArrow.id];
          sizePlaceholder.parentId = sizeInput.id;
          sizeLine.parentId = sizeInput.id;
          sizeArrow.parentId = sizeInput.id;

          const checkbox1 = makeFrameNode("체크박스 필수", { x: marginX, y: 330, w: contentW, h: 20, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          const checkbox1Box = makeRectNode("체크박스", { x: 0, y: 2, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#C7C7C7", width: 1 }, radius: 2 });
          const checkbox1Label = makeTextNode("라벨", "[필수] 만 14세 이상이며 모두 동의합니다.", { x: 24, y: 1, w: 280, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const checkbox1Plus = makeTextNode("더보기", "+", { x: contentW - 12, y: 1, w: 12, h: 18, rotation: 0 }, { size: 14, color: "#111111", align: "center" });
          checkbox1.children = [checkbox1Box.id, checkbox1Label.id, checkbox1Plus.id];
          checkbox1Box.parentId = checkbox1.id;
          checkbox1Label.parentId = checkbox1.id;
          checkbox1Plus.parentId = checkbox1.id;

          const checkbox2 = makeFrameNode("체크박스 선택", { x: marginX, y: 362, w: contentW, h: 20, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          const checkbox2Box = makeRectNode("체크박스", { x: 0, y: 2, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#C7C7C7", width: 1 }, radius: 2 });
          const checkbox2Label = makeTextNode("라벨", "[선택] 광고성 정보 수신에 모두 동의합니다.", { x: 24, y: 1, w: 290, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const checkbox2Plus = makeTextNode("더보기", "+", { x: contentW - 12, y: 1, w: 12, h: 18, rotation: 0 }, { size: 14, color: "#111111", align: "center" });
          checkbox2.children = [checkbox2Box.id, checkbox2Label.id, checkbox2Plus.id];
          checkbox2Box.parentId = checkbox2.id;
          checkbox2Label.parentId = checkbox2.id;
          checkbox2Plus.parentId = checkbox2.id;

          const button = makeFrameNode(
            "가입하기 버튼",
            { x: marginX, y: 760, w: contentW, h: 48, rotation: 0 },
            {
              fill: "#E0E0E0",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 12, r: 16, b: 12, l: 16 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "가입하기", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { size: 14, weight: 600, color: "#B9B9B9", align: "center" });
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
          checkbox1.constraints = { left: true, right: true, top: true };
          checkbox2.constraints = { left: true, right: true, top: true };
          button.constraints = { left: true, right: true, bottom: true };

          frame.children = [
            back.id,
            title.id,
            emailLabel.id,
            email.id,
            passwordLabel.id,
            password.id,
            sizeLabel.id,
            sizeInput.id,
            checkbox1.id,
            checkbox2.id,
            button.id,
          ];
          back.parentId = frame.id;
          title.parentId = frame.id;
          emailLabel.parentId = frame.id;
          email.parentId = frame.id;
          passwordLabel.parentId = frame.id;
          password.parentId = frame.id;
          sizeLabel.parentId = frame.id;
          sizeInput.parentId = frame.id;
          checkbox1.parentId = frame.id;
          checkbox2.parentId = frame.id;
          button.parentId = frame.id;

          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [back.id]: back,
              [title.id]: title,
              [emailLabel.id]: emailLabel,
              [email.id]: email,
              [emailPlaceholder.id]: emailPlaceholder,
              [emailLine.id]: emailLine,
              [passwordLabel.id]: passwordLabel,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [passwordLine.id]: passwordLine,
              [eye.id]: eye,
              [eyeOuter.id]: eyeOuter,
              [eyeDot.id]: eyeDot,
              [sizeLabel.id]: sizeLabel,
              [sizeInput.id]: sizeInput,
              [sizePlaceholder.id]: sizePlaceholder,
              [sizeLine.id]: sizeLine,
              [sizeArrow.id]: sizeArrow,
              [checkbox1.id]: checkbox1,
              [checkbox1Box.id]: checkbox1Box,
              [checkbox1Label.id]: checkbox1Label,
              [checkbox1Plus.id]: checkbox1Plus,
              [checkbox2.id]: checkbox2,
              [checkbox2Box.id]: checkbox2Box,
              [checkbox2Label.id]: checkbox2Label,
              [checkbox2Plus.id]: checkbox2Plus,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
            },
          };
        },
      },
      {
        id: "kream-signup-filled",
        label: "KREAM 회원가입(완료)",
        size: { w: 390, h: 844 },
        build: (origin) => {
          const frameW = 390;
          const frameH = 844;
          const marginX = 24;
          const contentW = frameW - marginX * 2;
          const lineColor = "#E5E5E5";

          const frame = makeFrameNode(
            "KREAM 회원가입(완료)",
            { x: origin.x, y: origin.y, w: frameW, h: frameH, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          const back = makeTextNode("뒤로", "←", { x: 18, y: 24, w: 20, h: 20, rotation: 0 }, { size: 16, weight: 600, align: "center" });
          const title = makeTextNode("타이틀", "회원가입", { x: marginX, y: 56, w: 120, h: 24, rotation: 0 }, { size: 20, weight: 700, color: "#111111" });

          const emailLabel = makeTextNode("라벨", "이메일 주소", { x: marginX, y: 116, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const email = makeFrameNode("이메일 입력", { x: marginX, y: 136, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          const emailValue = makeTextNode("값", "witi.design@gmail.com", { x: 0, y: 8, w: 220, h: 16, rotation: 0 }, { size: 12, color: "#111111" });
          const emailLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          email.children = [emailValue.id, emailLine.id];
          emailValue.parentId = email.id;
          emailLine.parentId = email.id;

          const passwordLabel = makeTextNode("라벨", "비밀번호", { x: marginX, y: 186, w: 120, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const password = makeFrameNode("비밀번호 입력", { x: marginX, y: 206, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          const passwordPlaceholder = makeTextNode("플레이스홀더", "비밀번호", { x: 0, y: 8, w: 120, h: 16, rotation: 0 }, { size: 12, color: "#B9B9B9" });
          const passwordLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          const eye = makeGroupNode("보기 아이콘", { x: contentW - 20, y: 9, w: 16, h: 10, rotation: 0 });
          const eyeOuter = makeEllipseNode("눈", { x: 0, y: 0, w: 16, h: 10, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#B9B9B9", width: 1 } });
          const eyeDot = makeEllipseNode("동공", { x: 6, y: 3, w: 4, h: 4, rotation: 0 }, { fill: "#B9B9B9" });
          eye.children = [eyeOuter.id, eyeDot.id];
          eyeOuter.parentId = eye.id;
          eyeDot.parentId = eye.id;
          password.children = [passwordPlaceholder.id, passwordLine.id, eye.id];
          passwordPlaceholder.parentId = password.id;
          passwordLine.parentId = password.id;
          eye.parentId = password.id;

          const sizeLabel = makeTextNode("라벨", "스니커즈 사이즈", { x: marginX, y: 256, w: 140, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#111111" });
          const sizeInput = makeFrameNode("사이즈 입력", { x: marginX, y: 276, w: contentW, h: 34, rotation: 0 }, { fill: "#FFFFFF", stroke: null });
          const sizeValue = makeTextNode("값", "240", { x: 0, y: 8, w: 40, h: 16, rotation: 0 }, { size: 12, color: "#111111" });
          const sizeLine = makeRectNode("밑줄", { x: 0, y: 33, w: contentW, h: 1, rotation: 0 }, { fill: lineColor });
          const sizeArrow = makeTextNode("화살표", "▾", { x: contentW - 14, y: 8, w: 12, h: 16, rotation: 0 }, { size: 12, color: "#111111", align: "center" });
          sizeInput.children = [sizeValue.id, sizeLine.id, sizeArrow.id];
          sizeValue.parentId = sizeInput.id;
          sizeLine.parentId = sizeInput.id;
          sizeArrow.parentId = sizeInput.id;

          const checkbox1Box = makeRectNode("체크박스", { x: marginX, y: 332, w: 16, h: 16, rotation: 0 }, { fill: "#111111", stroke: { color: "#111111", width: 1 }, radius: 2 });
          const checkbox1Mark = makeTextNode("체크", "✓", { x: marginX + 2, y: 330, w: 16, h: 16, rotation: 0 }, { size: 12, color: "#FFFFFF", align: "center" });
          const checkbox1Label = makeTextNode("라벨", "[필수] 만 14세 이상이며 모두 동의합니다.", { x: marginX + 24, y: 330, w: 280, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const checkbox1Plus = makeTextNode("더보기", "+", { x: marginX + contentW - 8, y: 330, w: 12, h: 18, rotation: 0 }, { size: 14, color: "#111111", align: "center" });

          const checkbox2Box = makeRectNode("체크박스", { x: marginX, y: 364, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#C7C7C7", width: 1 }, radius: 2 });
          const checkbox2Label = makeTextNode("라벨", "[선택] 광고성 정보 수신에 모두 동의합니다.", { x: marginX + 24, y: 362, w: 290, h: 18, rotation: 0 }, { size: 12, color: "#111111" });
          const checkbox2Plus = makeTextNode("더보기", "+", { x: marginX + contentW - 8, y: 362, w: 12, h: 18, rotation: 0 }, { size: 14, color: "#111111", align: "center" });

          const button = makeFrameNode(
            "가입하기 버튼",
            { x: marginX, y: 760, w: contentW, h: 48, rotation: 0 },
            {
              fill: "#111111",
              stroke: null,
              radius: 10,
              layout: {
                mode: "auto",
                dir: "row",
                gap: 8,
                padding: { t: 12, r: 16, b: 12, l: 16 },
                align: "center",
                wrap: false,
              },
            },
          );
          const buttonLabel = makeTextNode("버튼 텍스트", "가입하기", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { size: 14, weight: 600, color: "#FFFFFF", align: "center" });
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

          frame.children = [
            back.id,
            title.id,
            emailLabel.id,
            email.id,
            passwordLabel.id,
            password.id,
            sizeLabel.id,
            sizeInput.id,
            checkbox1Box.id,
            checkbox1Mark.id,
            checkbox1Label.id,
            checkbox1Plus.id,
            checkbox2Box.id,
            checkbox2Label.id,
            checkbox2Plus.id,
            button.id,
          ];
          back.parentId = frame.id;
          title.parentId = frame.id;
          emailLabel.parentId = frame.id;
          email.parentId = frame.id;
          passwordLabel.parentId = frame.id;
          password.parentId = frame.id;
          sizeLabel.parentId = frame.id;
          sizeInput.parentId = frame.id;
          checkbox1Box.parentId = frame.id;
          checkbox1Mark.parentId = frame.id;
          checkbox1Label.parentId = frame.id;
          checkbox1Plus.parentId = frame.id;
          checkbox2Box.parentId = frame.id;
          checkbox2Label.parentId = frame.id;
          checkbox2Plus.parentId = frame.id;
          button.parentId = frame.id;

          return {
            rootId: frame.id,
            nodes: {
              [frame.id]: frame,
              [back.id]: back,
              [title.id]: title,
              [emailLabel.id]: emailLabel,
              [email.id]: email,
              [emailValue.id]: emailValue,
              [emailLine.id]: emailLine,
              [passwordLabel.id]: passwordLabel,
              [password.id]: password,
              [passwordPlaceholder.id]: passwordPlaceholder,
              [passwordLine.id]: passwordLine,
              [eye.id]: eye,
              [eyeOuter.id]: eyeOuter,
              [eyeDot.id]: eyeDot,
              [sizeLabel.id]: sizeLabel,
              [sizeInput.id]: sizeInput,
              [sizeValue.id]: sizeValue,
              [sizeLine.id]: sizeLine,
              [sizeArrow.id]: sizeArrow,
              [checkbox1Box.id]: checkbox1Box,
              [checkbox1Mark.id]: checkbox1Mark,
              [checkbox1Label.id]: checkbox1Label,
              [checkbox1Plus.id]: checkbox1Plus,
              [checkbox2Box.id]: checkbox2Box,
              [checkbox2Label.id]: checkbox2Label,
              [checkbox2Plus.id]: checkbox2Plus,
              [button.id]: button,
              [buttonLabel.id]: buttonLabel,
            },
          };
        },
      },
      {
        id: "kream-main",
        label: "KREAM 메인",
        size: { w: 390, h: 844 },
        build: (origin) => {
          const frameW = 390;
          const frameH = 844;
          const navH = 84;
          const marginX = 16;
          const contentW = frameW - marginX * 2;
          const placeholderFill = "#EDEDED";
          const placeholderStroke = "#D6D6D6";

          const frame = makeFrameNode(
            "KREAM 메인",
            { x: origin.x, y: origin.y, w: frameW, h: frameH, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );

          const content = makeFrameNode(
            "메인 스크롤",
            { x: 0, y: 0, w: frameW, h: frameH - navH, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          content.overflowScrolling = "vertical";
          content.clipContent = true;
          content.constraints = { left: true, right: true, top: true, bottom: true };

          const nav = makeFrameNode(
            "하단 네비",
            { x: 0, y: frameH - navH, w: frameW, h: navH, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#E5E5E5", width: 1 } },
          );
          nav.constraints = { left: true, right: true, bottom: true };

          frame.children = [content.id, nav.id];
          content.parentId = frame.id;
          nav.parentId = frame.id;

          const nodes: Record<string, Node> = {
            [frame.id]: frame,
            [content.id]: content,
            [nav.id]: nav,
          };

          const addContent = (node: Node) => {
            nodes[node.id] = node;
            content.children = [...content.children, node.id];
            node.parentId = content.id;
            return node;
          };
          const addNav = (node: Node) => {
            nodes[node.id] = node;
            nav.children = [...nav.children, node.id];
            node.parentId = nav.id;
            return node;
          };
          const addChild = (parent: Node, node: Node) => {
            nodes[node.id] = node;
            parent.children = [...parent.children, node.id];
            node.parentId = parent.id;
            return node;
          };
          const makePlaceholder = (
            name: string,
            frame: { x: number; y: number; w: number; h: number; rotation?: number },
            radius = 12,
          ) =>
            makeRectNode(name, { ...frame, rotation: frame.rotation ?? 0 }, { fill: placeholderFill, stroke: { color: placeholderStroke, width: 1 }, radius });

          let cursorY = 16;

          const iconSize = 24;
          const iconGap = 12;
          const iconAreaW = iconSize * 2 + iconGap;
          const searchBarW = contentW - iconAreaW - 8;

          const searchBar = makeFrameNode(
            "검색 바",
            { x: marginX, y: cursorY, w: searchBarW, h: 40, rotation: 0 },
            { fill: "#F2F2F2", stroke: null, radius: 20 },
          );
          searchBar.constraints = { left: true, right: true, top: true };
          addContent(searchBar);

          const searchText = makeTextNode(
            "검색 안내",
            "브랜드, 상품, 프로필, 태그 등",
            { x: 16, y: 12, w: searchBarW - 60, h: 16, rotation: 0 },
            { size: 12, color: "#B9B9B9" },
          );
          addChild(searchBar, searchText);

          const target = makeGroupNode("검색 타겟", { x: searchBarW - 28, y: 8, w: 24, h: 24, rotation: 0 });
          const targetOuter = makeEllipseNode("타겟 외곽", { x: 2, y: 2, w: 20, h: 20, rotation: 0 }, { fill: "#F2F2F2", stroke: { color: "#111111", width: 1 } });
          const targetDot = makeEllipseNode("타겟 점", { x: 11, y: 11, w: 2, h: 2, rotation: 0 }, { fill: "#111111" });
          addChild(searchBar, target);
          addChild(target, targetOuter);
          addChild(target, targetDot);

          const bell = makeRectNode(
            "알림 아이콘",
            { x: marginX + searchBarW + 8, y: cursorY + 8, w: iconSize, h: iconSize, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111111", width: 1 }, radius: 6 },
          );
          bell.constraints = { right: true, top: true };
          addContent(bell);

          const bag = makeRectNode(
            "장바구니 아이콘",
            { x: marginX + searchBarW + 8 + iconSize + iconGap, y: cursorY + 8, w: iconSize, h: iconSize, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111111", width: 1 }, radius: 6 },
          );
          bag.constraints = { right: true, top: true };
          addContent(bag);

          cursorY += 56;

          const tabFontSize = 16;
          const approxTextWidth = (text: string, size: number) => Math.max(18, Math.round(text.length * size * 0.6));
          const tabs = [
            { label: "추천", dot: false, active: true },
            { label: "💝선물", dot: true, active: false },
            { label: "세일", dot: true, active: false },
            { label: "럭셔리", dot: false, active: false },
            { label: "랭킹", dot: true, active: false },
            { label: "발매정보", dot: false, active: false },
            { label: "중고", dot: true, active: false },
          ];
          let tabX = marginX;
          const tabY = cursorY;
          tabs.forEach((tab) => {
            const w = approxTextWidth(tab.label, tabFontSize);
            const tabText = makeTextNode(
              "탭",
              tab.label,
              { x: tabX, y: tabY, w, h: 20, rotation: 0 },
              { size: tabFontSize, weight: tab.active ? 700 : 500, color: "#111111" },
            );
            addContent(tabText);
            if (tab.dot) {
              const dot = makeEllipseNode("탭 점", { x: tabX + w + 4, y: tabY - 4, w: 6, h: 6, rotation: 0 }, { fill: "#EF4444" });
              addContent(dot);
            }
            if (tab.active) {
              const underline = makeRectNode("탭 밑줄", { x: tabX, y: tabY + 24, w: Math.max(24, w), h: 2, rotation: 0 }, { fill: "#111111" });
              addContent(underline);
            }
            tabX += w + 18;
          });

          cursorY = tabY + 32;

          const bannerY = cursorY + 8;
          const bannerH = 220;
          const banner = makeFrameNode(
            "메인 배너",
            { x: marginX, y: bannerY, w: contentW, h: bannerH, rotation: 0 },
            { fill: "#BEBEBE", stroke: null, radius: 20 },
          );
          banner.constraints = { left: true, right: true, top: true };
          addContent(banner);

          const bannerTag = makeTextNode("배너 태그", "크림위키", { x: contentW - 72, y: 16, w: 56, h: 16, rotation: 0 }, { size: 12, weight: 600, color: "#FFFFFF", align: "right" });
          addChild(banner, bannerTag);
          const bannerTitle = makeTextNode(
            "배너 타이틀",
            "총상금 1천만 포인트",
            { x: 20, y: bannerH - 64, w: 220, h: 24, rotation: 0 },
            { size: 20, weight: 700, color: "#FFFFFF" },
          );
          addChild(banner, bannerTitle);
          const bannerSub = makeTextNode(
            "배너 서브",
            "매주 퀴즈 풀고, 경품 추첨까지!",
            { x: 20, y: bannerH - 36, w: 240, h: 16, rotation: 0 },
            { size: 12, color: "#F2F2F2" },
          );
          addChild(banner, bannerSub);
          const bannerPager = makeFrameNode(
            "배너 페이저",
            { x: contentW - 78, y: bannerH - 44, w: 64, h: 28, rotation: 0 },
            { fill: "#D9D9D9", stroke: null, radius: 14 },
          );
          addChild(banner, bannerPager);
          const pagerText = makeTextNode("페이저 텍스트", "1 / 49 >", { x: 0, y: 6, w: 64, h: 16, rotation: 0 }, { size: 12, color: "#111111", align: "center" });
          addChild(bannerPager, pagerText);

          cursorY = bannerY + bannerH + 24;

          const categoryRows = [
            ["지금 인기", "부츠", "후드", "헤비 아우터", "가죽"],
            ["금/은 오픈", "인기 패딩", "숏 패딩", "인기 뷰티", "머플러"],
          ];
          const catSize = 52;
          const catGap = (contentW - catSize * 5) / 4;
          const catLabelGap = 8;
          const catRowGap = catSize + 32;
          categoryRows.forEach((row, rowIndex) => {
            const rowY = cursorY + rowIndex * catRowGap;
            row.forEach((label, colIndex) => {
              const x = marginX + colIndex * (catSize + catGap);
              const img = makePlaceholder("카테고리 이미지", { x, y: rowY, w: catSize, h: catSize, rotation: 0 }, 14);
              addContent(img);
              const text = makeTextNode("카테고리 라벨", label, { x: x - 4, y: rowY + catSize + catLabelGap, w: catSize + 8, h: 16, rotation: 0 }, { size: 12, color: "#111111", align: "center" });
              addContent(text);
            });
          });
          cursorY += categoryRows.length * catRowGap + 12;

          const newTitle = makeTextNode("섹션 타이틀", "지금 가장 주목받는 신상", { x: marginX, y: cursorY, w: 240, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(newTitle);
          cursorY += 32;

          const newLabels = [
            "Adidas",
            "AEAE",
            "Jordan",
            "Montbell",
            "IAB Studio",
            "Nike",
            "Asics",
            "Nagano",
            "Toys & Goods",
            "Bang & Olufsen",
            "Nike",
            "Nike",
          ];
          const newItemW = 70;
          const newItemH = 70;
          const newGapX = (contentW - newItemW * 4) / 3;
          const newRowGap = newItemH + 34;
          newLabels.forEach((label, index) => {
            const row = Math.floor(index / 4);
            const col = index % 4;
            const x = marginX + col * (newItemW + newGapX);
            const y = cursorY + row * newRowGap;
            const img = makePlaceholder("신상 이미지", { x, y, w: newItemW, h: newItemH, rotation: 0 }, 10);
            addContent(img);
            const text = makeTextNode("신상 라벨", label, { x: x - 8, y: y + newItemH + 8, w: newItemW + 16, h: 16, rotation: 0 }, { size: 12, color: "#111111", align: "center" });
            addContent(text);
          });
          cursorY += newRowGap * 3 + 12;

          const trendTitle = makeTextNode("섹션 타이틀", "요즘 트렌드? 이걸로 끝", { x: marginX, y: cursorY, w: 220, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(trendTitle);
          const trendMore = makeTextNode("더보기", "더보기", { x: frameW - marginX - 60, y: cursorY, w: 60, h: 20, rotation: 0 }, { size: 14, color: "#6B6B6B", align: "right" });
          addContent(trendMore);
          cursorY += 28;

          const trendRow = makeFrameNode(
            "트렌드 리스트",
            { x: marginX, y: cursorY, w: contentW, h: 200, rotation: 0 },
            { fill: "#FFFFFF", stroke: null },
          );
          trendRow.overflowScrolling = "horizontal";
          trendRow.clipContent = true;
          addContent(trendRow);
          const trendCardW = 180;
          const trendCardH = 200;
          const trendCardGap = 12;
          for (let i = 0; i < 3; i++) {
            const card = makeFrameNode(
              "트렌드 카드",
              { x: i * (trendCardW + trendCardGap), y: 0, w: trendCardW, h: trendCardH, rotation: 0 },
              { fill: "#E5E5E5", stroke: null, radius: 16 },
            );
            addChild(trendRow, card);
            const label = makeTextNode(
              "트렌드 텍스트",
              i === 0 ? "셀피는 이렇게 성현처럼" : i === 1 ? "WISH LIST for Valentine" : "트렌드 카드",
              { x: 16, y: 140, w: trendCardW - 32, h: 40, rotation: 0 },
              { size: 14, weight: 700, color: "#FFFFFF" },
            );
            addChild(card, label);
          }
          cursorY += trendCardH + 24;

          const discount = makeFrameNode(
            "할인 카드",
            { x: marginX, y: cursorY, w: contentW, h: 96, rotation: 0 },
            { fill: "#F5F5F5", stroke: null, radius: 16 },
          );
          addContent(discount);
          const discountTitle = makeTextNode("할인 타이틀", "4% 즉시할인", { x: 16, y: 20, w: 120, h: 20, rotation: 0 }, { size: 16, weight: 700, color: "#111111" });
          const discountSub = makeTextNode("할인 서브", "카카오페이x우리카드", { x: 16, y: 44, w: 160, h: 16, rotation: 0 }, { size: 12, color: "#6B6B6B" });
          addChild(discount, discountTitle);
          addChild(discount, discountSub);
          const discountImg = makePlaceholder("할인 이미지", { x: contentW - 120, y: 16, w: 104, h: 64, rotation: 0 }, 12);
          addChild(discount, discountImg);
          cursorY += 96 + 28;

          const hotTitle = makeTextNode("섹션 타이틀", "가장 핫한 트렌드", { x: marginX, y: cursorY, w: 200, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(hotTitle);
          cursorY += 32;

          const hotLabels = ["TOP 100", "25FW 드랍 리캡", "이번주 도산 매장", "급상승 브랜드", "실시간 인기 랭킹"];
          const hotSize = 52;
          const hotGap = (contentW - hotSize * 5) / 4;
          hotLabels.forEach((label, index) => {
            const x = marginX + index * (hotSize + hotGap);
            const img = makePlaceholder("핫 트렌드", { x, y: cursorY, w: hotSize, h: hotSize, rotation: 0 }, 12);
            addContent(img);
            const text = makeTextNode("핫 라벨", label, { x: x - 6, y: cursorY + hotSize + 8, w: hotSize + 12, h: 30, rotation: 0 }, { size: 11, color: "#111111", align: "center" });
            addContent(text);
          });
          cursorY += hotSize + 48;

          const nowLabels = ["지금 뜨는 신상", "세뱃돈 담을 지갑", "드롭 리스트", "급상승 검색어", "지금 뜨는 트렌드"];
          const nowSize = 52;
          const nowGap = (contentW - nowSize * 5) / 4;
          nowLabels.forEach((label, index) => {
            const x = marginX + index * (nowSize + nowGap);
            const img = makePlaceholder("지금 뜨는", { x, y: cursorY, w: nowSize, h: nowSize, rotation: 0 }, 12);
            addContent(img);
            const text = makeTextNode("지금 라벨", label, { x: x - 6, y: cursorY + nowSize + 8, w: nowSize + 12, h: 30, rotation: 0 }, { size: 11, color: "#111111", align: "center" });
            addContent(text);
          });
          cursorY += nowSize + 60;

          const popularTitle = makeTextNode("섹션 타이틀", "Most Popular", { x: marginX, y: cursorY, w: 180, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(popularTitle);
          cursorY += 32;

          const popularItems = [
            { name: "플레이스테이션5", price: "1,047,900원" },
            { name: "나이키 에어포스 1", price: "104,000원" },
            { name: "아크테릭스 스쿼미", price: "282,000원" },
            { name: "(W) 나이키", price: "127,000원" },
            { name: "뉴발란스 992", price: "285,000원" },
            { name: "노스페이스 화이트", price: "257,000원" },
            { name: "나이키 에어포스 1", price: "109,000원" },
            { name: "살로몬", price: "399,000원" },
          ];
          const popW = 78;
          const popH = 78;
          const popGapX = (contentW - popW * 4) / 3;
          const popRowGap = popH + 70;
          popularItems.forEach((item, index) => {
            const row = Math.floor(index / 4);
            const col = index % 4;
            const x = marginX + col * (popW + popGapX);
            const y = cursorY + row * popRowGap;
            const img = makePlaceholder("인기 상품", { x, y, w: popW, h: popH, rotation: 0 }, 10);
            addContent(img);
            const name = makeTextNode("상품명", item.name, { x: x - 6, y: y + popH + 8, w: popW + 12, h: 28, rotation: 0 }, { size: 11, color: "#111111" });
            const price = makeTextNode("가격", item.price, { x: x - 6, y: y + popH + 32, w: popW + 12, h: 16, rotation: 0 }, { size: 11, weight: 700, color: "#111111" });
            const meta = makeTextNode("메타", "관심 0", { x: x - 6, y: y + popH + 50, w: popW + 12, h: 14, rotation: 0 }, { size: 10, color: "#9B9B9B" });
            addContent(name);
            addContent(price);
            addContent(meta);
          });
          cursorY += popRowGap * 2 + 12;

          const winterTitle = makeTextNode("섹션 타이틀", "겨울 코디 추천", { x: marginX, y: cursorY, w: 200, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(winterTitle);
          cursorY += 32;

          const winterSize = 52;
          const winterGap = (contentW - winterSize * 5) / 4;
          const winterRows = 3;
          for (let row = 0; row < winterRows; row++) {
            for (let col = 0; col < 5; col++) {
              const x = marginX + col * (winterSize + winterGap);
              const y = cursorY + row * (winterSize + 24);
              const img = makePlaceholder("겨울 코디", { x, y, w: winterSize, h: winterSize, rotation: 0 }, 10);
              addContent(img);
            }
          }
          cursorY += winterRows * (winterSize + 24) + 16;

          const valTitle = makeTextNode("섹션 타이틀", "달콤한 발렌타인 코디.zip", { x: marginX, y: cursorY, w: 240, h: 22, rotation: 0 }, { size: 18, weight: 700, color: "#111111" });
          addContent(valTitle);
          cursorY += 36;

          const cardW = 170;
          const cardH = 220;
          const cardGap = 12;
          for (let i = 0; i < 2; i++) {
            const x = marginX + i * (cardW + cardGap);
            const card = makeFrameNode(
              "코디 카드",
              { x, y: cursorY, w: cardW, h: cardH, rotation: 0 },
              { fill: "#E5E5E5", stroke: null, radius: 16 },
            );
            addContent(card);
          }

          const navItemW = frameW / 5;
          const navItems = [
            { label: "HOME", active: true },
            { label: "STYLE", active: false },
            { label: "SHOP", active: false },
            { label: "SAVED", active: false },
            { label: "MY", active: false },
          ];
          navItems.forEach((item, index) => {
            const navItem = makeFrameNode(
              item.label === "MY" ? "탭 MY" : "탭",
              { x: navItemW * index, y: 0, w: navItemW, h: navH, rotation: 0 },
              { fill: "#FFFFFF", stroke: null },
            );
            addNav(navItem);
            const icon = makeRectNode(
              "네비 아이콘",
              { x: (navItemW - 24) / 2, y: 16, w: 24, h: 24, rotation: 0 },
              { fill: "#FFFFFF", stroke: { color: item.active ? "#111111" : "#9B9B9B", width: 1 }, radius: 6 },
            );
            const label = makeTextNode(
              "네비 라벨",
              item.label,
              { x: 0, y: 46, w: navItemW, h: 16, rotation: 0 },
              { size: 10, weight: item.active ? 700 : 500, color: item.active ? "#111111" : "#9B9B9B", align: "center" },
            );
            addChild(navItem, icon);
            addChild(navItem, label);
          });

          return { rootId: frame.id, nodes };
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
