// 纯计算逻辑：单位换算、体积、重量、金额。不依赖 DOM，可单测。
import { CUSTOM_MATERIAL_ID, MATERIALS, SHAPES } from "./materials.js";

const CM_PER_UNIT = Object.freeze({ mm: 0.1, cm: 1, m: 100 });
const GRAMS_PER_KG = 1000;
const RESULT_FACTOR = Object.freeze({ g: 1000, kg: 1, t: 1 / 1000 });

export function toCm(value, unit) {
  const factor = CM_PER_UNIT[unit];
  return factor === undefined ? value : value * factor;
}

export function convertDims(dims, fromUnit, toUnit) {
  const factor = CM_PER_UNIT[fromUnit] / CM_PER_UNIT[toUnit];
  const out = {};
  for (const key of Object.keys(dims)) {
    const value = Number(dims[key]);
    out[key] = Number.isFinite(value) ? value * factor : dims[key];
  }
  return out;
}

export function materialById(id) {
  return MATERIALS.find((m) => m.id === id) || null;
}

export function shapeById(id) {
  return SHAPES.find((s) => s.id === id) || null;
}

export function shapeLabel(shape, key) {
  const param = shape.params.find((p) => p.key === key);
  return param ? param.label : key;
}

export function calcAll({
  shapeId,
  materialId,
  dims,
  unit,
  quantity = 1,
  pricePerKg = 0,
  customDensity = 0
}) {
  const shape = shapeById(shapeId);
  if (!shape) {
    return { ok: false, errors: ["型材配置无效"] };
  }
  const material =
    materialId === CUSTOM_MATERIAL_ID
      ? { id: CUSTOM_MATERIAL_ID, name: "自定义材料", density: Number(customDensity) }
      : materialById(materialId);
  if (!material || !Number.isFinite(material.density) || material.density <= 0) {
    return { ok: false, errors: ["自定义密度需为大于 0 的数字"] };
  }

  const dimsCm = {};
  const errors = [];
  for (const key of shape.dims) {
    if (key === "spec") {
      const spec = String(dims.spec || "");
      if (!shape.table || !shape.table[spec]) {
        errors.push("请选择型号");
      }
      continue;
    }
    const value = Number(dims[key]);
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${shapeLabel(shape, key)}需为大于 0 的数字`);
      continue;
    }
    dimsCm[key] = toCm(value, unit);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const invalid = shape.validate ? shape.validate(dimsCm) : null;
  if (invalid) {
    return { ok: false, errors: [invalid] };
  }

  let volumeCm3;
  let weightKg;
  let perMeterKg;
  const lengthCm = dimsCm.l || 0;
  if (shape.table) {
    const entry = shape.table[String(dims.spec)];
    perMeterKg = entry.kgm;
    weightKg = perMeterKg * (lengthCm / 100);
    volumeCm3 = (weightKg * GRAMS_PER_KG) / material.density;
  } else {
    volumeCm3 = shape.volume(dimsCm);
    weightKg = (volumeCm3 * material.density) / GRAMS_PER_KG;
    perMeterKg = lengthCm > 0 ? weightKg / (lengthCm / 100) : 0;
  }
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const totalKg = weightKg * qty;
  const price = Number(pricePerKg) > 0 ? totalKg * Number(pricePerKg) : null;

  return {
    ok: true,
    volumeCm3,
    weightKg,
    perMeterKg,
    totalKg,
    quantity: qty,
    price,
    shape,
    material
  };
}

export function convertResult(kg, unit) {
  const factor = RESULT_FACTOR[unit];
  return factor === undefined ? kg : kg * factor;
}

export function formatNumber(value, maxDecimals = 4) {
  if (!Number.isFinite(value)) return "--";
  return Number(value.toFixed(maxDecimals)).toLocaleString("zh-CN", {
    maximumFractionDigits: maxDecimals
  });
}

export function formatMoney(value) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
