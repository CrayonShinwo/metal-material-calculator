// 材料与型材数据定义（纯数据，无 UI 逻辑）
import { CHANNEL_TABLE, IBEAM_TABLE } from "./tables.js";

export const CUSTOM_MATERIAL_ID = "custom";

export const MATERIALS = Object.freeze([
  { id: "steel", name: "碳钢 / 普通钢", density: 7.85 },
  { id: "s304", name: "不锈钢 304", density: 7.93 },
  { id: "s316", name: "不锈钢 316", density: 7.98 },
  { id: "cast-iron", name: "铸铁", density: 7.2 },
  { id: "aluminum", name: "铝", density: 2.71 },
  { id: "al6061", name: "铝合金 6061", density: 2.7 },
  { id: "copper", name: "紫铜", density: 8.96 },
  { id: "brass", name: "黄铜", density: 8.5 },
  { id: "bronze", name: "青铜", density: 8.8 },
  { id: "titanium", name: "钛", density: 4.51 },
  { id: "zinc", name: "锌", density: 7.14 },
  { id: "lead", name: "铅", density: 11.34 },
  { id: "nickel", name: "镍", density: 8.9 },
  { id: "magnesium", name: "镁", density: 1.74 },
  { id: "tin", name: "锡", density: 7.3 },
  { id: "tungsten", name: "钨", density: 19.25 }
]);

function validateWall(outerKey, wallKey, outerLabel, wallLabel) {
  return (d) => (d[outerKey] > 2 * d[wallKey] ? null : `${wallLabel}需小于 ${outerLabel} 的一半`);
}

export const SHAPES = Object.freeze([
  {
    id: "plate",
    name: "板材",
    icon: "▭",
    formula: "V = t × w × l",
    dims: ["t", "w", "l"],
    defaults: { t: 10, w: 100, l: 1000 },
    params: [
      { key: "t", label: "厚度" },
      { key: "w", label: "宽度" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => d.t * d.w * d.l
  },
  {
    id: "round-bar",
    name: "圆棒",
    icon: "●",
    formula: "V = π/4 × d² × l",
    dims: ["d", "l"],
    defaults: { d: 50, l: 1000 },
    params: [
      { key: "d", label: "直径" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => (Math.PI / 4) * d.d ** 2 * d.l
  },
  {
    id: "square-bar",
    name: "方棒",
    icon: "■",
    formula: "V = a² × l",
    dims: ["a", "l"],
    defaults: { a: 50, l: 1000 },
    params: [
      { key: "a", label: "边长" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => d.a ** 2 * d.l
  },
  {
    id: "hex-bar",
    name: "六角棒",
    icon: "⬢",
    formula: "V = (√3/2) × s² × l",
    dims: ["s", "l"],
    defaults: { s: 30, l: 1000 },
    params: [
      { key: "s", label: "对边距" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => (Math.sqrt(3) / 2) * d.s ** 2 * d.l
  },
  {
    id: "round-tube",
    name: "圆管",
    icon: "◎",
    formula: "V = π/4 × (D² − (D−2t)²) × l",
    dims: ["D", "t", "l"],
    defaults: { D: 50, t: 3, l: 1000 },
    params: [
      { key: "D", label: "外径" },
      { key: "t", label: "壁厚" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => (Math.PI / 4) * (d.D ** 2 - (d.D - 2 * d.t) ** 2) * d.l,
    validate: validateWall("D", "t", "外径", "壁厚")
  },
  {
    id: "square-tube",
    name: "方管",
    icon: "▣",
    formula: "V = (a² − (a−2t)²) × l",
    dims: ["a", "t", "l"],
    defaults: { a: 50, t: 3, l: 1000 },
    params: [
      { key: "a", label: "外边长" },
      { key: "t", label: "壁厚" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => (d.a ** 2 - (d.a - 2 * d.t) ** 2) * d.l,
    validate: validateWall("a", "t", "外边长", "壁厚")
  },
  {
    id: "angle",
    name: "角钢",
    icon: "∠",
    formula: "V ≈ (A+B−t) × t × l",
    dims: ["A", "B", "t", "l"],
    defaults: { A: 50, B: 50, t: 5, l: 1000 },
    params: [
      { key: "A", label: "长边" },
      { key: "B", label: "短边" },
      { key: "t", label: "壁厚" },
      { key: "l", label: "长度" }
    ],
    volume: (d) => (d.A + d.B - d.t) * d.t * d.l,
    validate: (d) => (d.t < d.A && d.t < d.B ? null : "壁厚需小于角钢的边长")
  },
  {
    id: "channel",
    name: "槽钢",
    icon: "C",
    formula: "查表重量 = 国标理论重量 × 长度（GB/T 706）",
    table: CHANNEL_TABLE,
    dims: ["spec", "l"],
    defaults: { spec: "10#", l: 1000 },
    params: [
      { key: "spec", label: "型号", type: "select" },
      { key: "l", label: "长度" }
    ]
  },
  {
    id: "ibeam",
    name: "工字钢",
    icon: "I",
    formula: "查表重量 = 国标理论重量 × 长度（GB/T 706）",
    table: IBEAM_TABLE,
    dims: ["spec", "l"],
    defaults: { spec: "16#", l: 1000 },
    params: [
      { key: "spec", label: "型号", type: "select" },
      { key: "l", label: "长度" }
    ]
  }
]);
