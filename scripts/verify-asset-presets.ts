import { ASSET_LIBRARY_PRESET_GROUPS } from "../src/advanced/ui/AdvancedEditor.assetLibraryPresets";
import { PRESET_GROUPS } from "../src/advanced/ui/AdvancedEditor.presets";

type PresetDefinition = (typeof PRESET_GROUPS)[number]["items"][number];

const groups = [...PRESET_GROUPS, ...ASSET_LIBRARY_PRESET_GROUPS];
const presetMap = new Map<string, PresetDefinition>();

groups.forEach((group) => {
  group.items.forEach((item) => {
    if (!presetMap.has(item.id)) presetMap.set(item.id, item);
  });
});

const presets = Array.from(presetMap.values());

const failures: Array<{ id: string; reason: string }> = [];

presets.forEach((preset) => {
  try {
    const built = preset.build({ x: 0, y: 0 });
    const nodeCount = Object.keys(built.nodes ?? {}).length;
    if (!built.rootId) {
      failures.push({ id: preset.id, reason: "rootId missing" });
      return;
    }
    if (nodeCount === 0) {
      failures.push({ id: preset.id, reason: "nodes empty" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ id: preset.id, reason: message });
  }
});

const total = presets.length;
const failed = failures.length;
const passed = total - failed;

console.log(`Preset build verification: ${passed}/${total} passed.`);
if (failed > 0) {
  console.log("Failures:");
  failures.forEach((item) => {
    console.log(`- ${item.id}: ${item.reason}`);
  });
  process.exitCode = 1;
}
