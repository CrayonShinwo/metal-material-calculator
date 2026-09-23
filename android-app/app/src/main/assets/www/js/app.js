// 页面交互：渲染、事件绑定、结果刷新。业务计算全部委托 calc.js。
import { CUSTOM_MATERIAL_ID, MATERIALS, SHAPES } from "./materials.js";
import {
  calcAll,
  convertDims,
  convertResult,
  formatMoney,
  formatNumber,
  materialById,
  shapeById,
  shapeLabel
} from "./calc.js";

const $ = (sel) => document.querySelector(sel);
const APP_VERSION = "1.8";

const state = {
  shapeId: "plate",
  materialId: "steel",
  unit: "mm",
  resultUnit: "kg",
  customDensity: "",
  quantity: 1,
  price: "",
  dimsByShape: Object.fromEntries(SHAPES.map((s) => [s.id, { ...s.defaults }]))
};

const currentDims = () => state.dimsByShape[state.shapeId];
let customOption = null;

function renderMaterials() {
  const sel = $("#material-select");
  sel.innerHTML = "";
  for (const m of MATERIALS) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.name}（${m.density} g/cm³）`;
    sel.append(opt);
  }
  const customOpt = document.createElement("option");
  customOpt.value = CUSTOM_MATERIAL_ID;
  customOpt.textContent = "自定义材料（待输入密度）";
  sel.append(customOpt);
  customOption = customOpt;
  sel.value = state.materialId;
}

function syncCustomDensityLabel() {
  if (!customOption) return;
  const value = state.customDensity.trim();
  customOption.textContent = value
    ? `自定义材料（${value} g/cm³）`
    : "自定义材料（待输入密度）";
}

function renderShapes() {
  const sel = $("#shape-select");
  sel.innerHTML = "";
  for (const s of SHAPES) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.icon} ${s.name}`;
    sel.append(opt);
  }
  sel.value = state.shapeId;
}

function renderDims() {
  const shape = shapeById(state.shapeId);
  const dims = currentDims();
  const wrap = $("#dims-list");
  wrap.innerHTML = "";
  for (const p of shape.params) {
    const label = document.createElement("label");
    label.className = "field";
    if (p.type === "select") {
      label.innerHTML = `<span class="field-label">${p.label}</span>`;
      const sel = document.createElement("select");
      sel.className = "select";
      sel.dataset.key = p.key;
      for (const [spec, entry] of Object.entries(shape.table)) {
        const opt = document.createElement("option");
        opt.value = spec;
        opt.textContent = `${entry.name}（${entry.kgm} kg/m）`;
        sel.append(opt);
      }
      sel.value = dims.spec;
      label.append(sel);
    } else {
      label.innerHTML = `<span class="field-label">${p.label} <small>${state.unit}</small></span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = dims[p.key];
      input.dataset.key = p.key;
      input.inputMode = "decimal";
      label.append(input);
    }
    wrap.append(label);
  }
  $("#formula-note").textContent = `公式：${shape.formula}`;
}

function syncCustomDensityVisibility() {
  const wrap = $("#custom-density-wrap");
  const isCustom = state.materialId === CUSTOM_MATERIAL_ID;
  wrap.hidden = !isCustom;
  wrap.style.display = isCustom ? "" : "none";
}

function syncSeg(selector, activeValue) {
  document.querySelectorAll(`${selector} .seg-btn`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.unit === activeValue);
  });
}

function updateResult() {
  const result = calcAll({
    shapeId: state.shapeId,
    materialId: state.materialId,
    dims: currentDims(),
    unit: state.unit,
    quantity: state.quantity,
    pricePerKg: Number(state.price),
    customDensity: Number(state.customDensity)
  });

  const grid = $("#result-grid");
  if (!result.ok) {
    grid.innerHTML = `<p class="err">${result.errors.join("；")}</p>`;
    $("#result-meta").textContent = "";
    return;
  }

  const w = convertResult(result.weightKg, state.resultUnit);
  const total = convertResult(result.totalKg, state.resultUnit);
  const wText = formatNumber(w);
  const totalText = formatNumber(total);
  const long = wText.length > 12;
  const unit = state.resultUnit;
  const money = result.price === null ? null : formatMoney(result.price);
  const qtyText = result.quantity === 1 ? "" : `（${result.quantity} 件）`;

  $("#result-meta").textContent =
    `${result.material.name} · ${result.material.density} g/cm³ · ${result.shape.name}${result.shape.table ? ` ${currentDims().spec}` : ""}`;
  grid.innerHTML = `
    <div class="stat"><span>体积</span><b>${formatNumber(result.volumeCm3)} <small>cm³</small></b></div>
    <div class="stat"><span>每米重量</span><b>${formatNumber(result.perMeterKg)} <small>kg/m</small></b></div>
    <div class="stat stat-main"><span>单件重量</span><b class="${long ? "long" : ""}">${wText} <small>${unit}</small></b></div>
    <div class="stat"><span>总重${qtyText}</span><b>${totalText} <small>${unit}</small></b></div>
    <div class="stat stat-money"><span>金额（单价 ¥${state.price || 0}/kg）</span><b>${money === null ? "—" : `¥${money}`}</b></div>
  `;

  const panel = $("#result-panel");
  panel.classList.remove("stamp");
  void panel.offsetWidth;
  panel.classList.add("stamp");
}

function buildSummary(result) {
  const shape = result.shape;
  const dimsText = shape.dims
    .map((key) => {
      const value = currentDims()[key];
      return key === "spec"
        ? `${shapeLabel(shape, key)} ${value}`
        : `${shapeLabel(shape, key)} ${value} ${state.unit}`;
    })
    .join(" × ");
  const lines = [
    "金属材料计算器",
    `材料：${result.material.name}（${result.material.density} g/cm³）`,
    `型材：${shape.name}（${shape.formula}）`,
    `尺寸：${dimsText}`,
    `数量：${result.quantity}`,
    `单件重量：${formatNumber(convertResult(result.weightKg, state.resultUnit))} ${state.resultUnit}`,
    `每米重量：${formatNumber(result.perMeterKg)} kg/m`,
    `总重：${formatNumber(convertResult(result.totalKg, state.resultUnit))} ${state.resultUnit}`
  ];
  if (result.price !== null) {
    lines.push(`金额：¥${formatMoney(result.price)}`);
  }
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function bindEvents() {
  $("#material-select").addEventListener("change", (e) => {
    state.materialId = e.target.value;
    syncCustomDensityVisibility();
    updateResult();
  });

  $("#custom-density").addEventListener("input", (e) => {
    state.customDensity = e.target.value;
    syncCustomDensityLabel();
    updateResult();
  });

  $("#shape-select").addEventListener("change", (e) => {
    state.shapeId = e.target.value;
    renderDims();
    updateResult();
  });

  $("#dims-list").addEventListener("input", (e) => {
    const input = e.target.closest("input");
    if (!input) return;
    currentDims()[input.dataset.key] = Number(input.value);
    updateResult();
  });

  $("#dims-list").addEventListener("change", (e) => {
    const sel = e.target.closest("select");
    if (!sel) return;
    currentDims()[sel.dataset.key] = sel.value;
    updateResult();
  });

  $("#unit-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn || btn.dataset.unit === state.unit) return;
    const from = state.unit;
    const to = btn.dataset.unit;
    state.unit = to;
    for (const key of Object.keys(state.dimsByShape)) {
      state.dimsByShape[key] = convertDims(state.dimsByShape[key], from, to);
    }
    syncSeg("#unit-toggle", to);
    renderDims();
    updateResult();
  });

  $("#result-unit-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.resultUnit = btn.dataset.unit;
    syncSeg("#result-unit-toggle", state.resultUnit);
    updateResult();
  });

  $("#quantity").addEventListener("input", (e) => {
    state.quantity = Number(e.target.value);
    updateResult();
  });

  $("#price").addEventListener("input", (e) => {
    state.price = e.target.value;
    updateResult();
  });

  $("#copy-btn").addEventListener("click", async () => {
    const result = calcAll({
      shapeId: state.shapeId,
      materialId: state.materialId,
      dims: currentDims(),
      unit: state.unit,
      quantity: state.quantity,
      pricePerKg: Number(state.price),
      customDensity: Number(state.customDensity)
    });
    if (!result.ok) return;
    const ok = await copyText(buildSummary(result));
    const btn = $("#copy-btn");
    btn.textContent = ok ? "已复制 ✓" : "复制失败";
    setTimeout(() => {
      btn.textContent = "复制结果";
    }, 1600);
  });
}

function init() {
  const tag = $("#version-tag");
  if (tag) tag.textContent = `v${APP_VERSION}`;
  renderMaterials();
  renderShapes();
  syncSeg("#unit-toggle", state.unit);
  syncSeg("#result-unit-toggle", state.resultUnit);
  renderDims();
  syncCustomDensityVisibility();
  updateResult();
  bindEvents();
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });
      })
      .catch(() => {});
  });
}
