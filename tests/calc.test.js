// 计算逻辑单元测试：node tests/calc.test.js
import assert from "node:assert/strict";
import { calcAll, convertDims, convertResult, formatNumber, toCm } from "../js/calc.js";

const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} 应接近 ${expected}`);

const steelPlate = (extra) =>
  calcAll({
    shapeId: "plate",
    materialId: "steel",
    dims: { t: 10, w: 100, l: 1000 },
    unit: "mm",
    ...extra
  });

// 单位换算
close(toCm(10, "mm"), 1);
close(toCm(1, "m"), 100);

// 尺寸单位换算（mm → m → mm）
{
  const d = convertDims({ t: 10, w: 100, l: 1000 }, "mm", "m");
  close(d.t, 0.01);
  close(d.w, 0.1);
  close(d.l, 1);
  const back = convertDims(d, "m", "mm");
  close(back.t, 10);
  close(back.w, 100);
  close(back.l, 1000);
}

// 板材 10mm×100mm×1000mm 碳钢 → 1000 cm³ → 7.85 kg
{
  const r = steelPlate({ quantity: 1 });
  assert.equal(r.ok, true);
  close(r.volumeCm3, 1000);
  close(r.weightKg, 7.85);
  close(r.perMeterKg, 7.85);
  close(r.totalKg, 7.85);
}

// 圆棒 d=50mm l=1000mm 碳钢 → π/4 × 25 × 100 cm³ = 1963.495 cm³
{
  const r = calcAll({
    shapeId: "round-bar",
    materialId: "steel",
    dims: { d: 50, l: 1000 },
    unit: "mm"
  });
  close(r.volumeCm3, (Math.PI / 4) * 25 * 100);
  close(r.weightKg, ((Math.PI / 4) * 25 * 100 * 7.85) / 1000);
}

// 米制单位：板材 1m×1m×0.01m 碳钢 = 10000 cm³ → 78.5 kg
{
  const r = calcAll({
    shapeId: "plate",
    materialId: "steel",
    dims: { t: 0.01, w: 1, l: 1 },
    unit: "m"
  });
  close(r.volumeCm3, 10000);
  close(r.weightKg, 78.5);
}

// 六角棒 s=10mm l=1000mm 铝 2.71 → (√3/2) × 1 × 100 cm³
{
  const r = calcAll({
    shapeId: "hex-bar",
    materialId: "aluminum",
    dims: { s: 10, l: 1000 },
    unit: "mm"
  });
  close(r.volumeCm3, (Math.sqrt(3) / 2) * 100);
  close(r.weightKg, ((Math.sqrt(3) / 2) * 100 * 2.71) / 1000);
}

// 圆管 D=20mm t=2mm l=1000mm 碳钢
{
  const r = calcAll({
    shapeId: "round-tube",
    materialId: "steel",
    dims: { D: 20, t: 2, l: 1000 },
    unit: "mm"
  });
  close(r.volumeCm3, (Math.PI / 4) * (4 - (2 - 0.4) ** 2) * 100);
  close(r.weightKg, ((Math.PI / 4) * (4 - 2.56) * 100 * 7.85) / 1000);
}

// 角钢 50×50×5 碳钢 → 每米约 3.77 kg
{
  const r = calcAll({
    shapeId: "angle",
    materialId: "steel",
    dims: { A: 50, B: 50, t: 5, l: 1000 },
    unit: "mm"
  });
  close(r.volumeCm3, (5 + 5 - 0.5) * 0.5 * 100);
  close(r.perMeterKg, (((5 + 5 - 0.5) * 0.5 * 100 * 7.85) / 1000) / 1);
  assert.ok(Math.abs(r.perMeterKg - 3.72875) < 1e-9);
}

// 数量与单价
{
  const r = steelPlate({ quantity: 5, pricePerKg: 6.5 });
  close(r.totalKg, 7.85 * 5);
  close(r.price, 7.85 * 5 * 6.5);
}

// 非法输入
{
  const r = steelPlate({ dims: { t: -1, w: 100, l: 1000 } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
}

// 壁厚超限
{
  const r = calcAll({
    shapeId: "round-tube",
    materialId: "steel",
    dims: { D: 20, t: 12, l: 1000 },
    unit: "mm"
  });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /壁厚/);
}

// 单位换算
close(convertResult(7.85, "g"), 7850);
close(convertResult(7850, "t"), 7.85);

// 格式化
assert.equal(formatNumber(7.85), "7.85");
assert.equal(formatNumber(0.8878), "0.8878");

// 自定义密度（2.71 = 铝）
{
  const r = steelPlate({ materialId: "custom", customDensity: 2.71 });
  assert.equal(r.ok, true);
  close(r.weightKg, 2.71);
}

// 自定义密度为空 → 报错
{
  const r = steelPlate({ materialId: "custom", customDensity: "" });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /密度/);
}

// 槽钢查表：10# 1000mm → 10.007 kg
{
  const r = calcAll({
    shapeId: "channel",
    materialId: "steel",
    dims: { spec: "10#", l: 1000 },
    unit: "mm"
  });
  assert.equal(r.ok, true);
  close(r.weightKg, 10.007);
  close(r.perMeterKg, 10.007);
}

// 工字钢查表：16# 2000mm → 41.026 kg
{
  const r = calcAll({
    shapeId: "ibeam",
    materialId: "steel",
    dims: { spec: "16#", l: 2000 },
    unit: "mm"
  });
  close(r.weightKg, 20.513 * 2);
}

// 型号缺失 → 报错
{
  const r = calcAll({
    shapeId: "channel",
    materialId: "steel",
    dims: { l: 1000 },
    unit: "mm"
  });
  assert.equal(r.ok, false);
}

// 单位换算时保留型号字符串
{
  const d = convertDims({ spec: "10#", l: 1000 }, "mm", "m");
  assert.equal(d.spec, "10#");
  close(d.l, 1);
}

console.log("✅ 全部计算测试通过");
