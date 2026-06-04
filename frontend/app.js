const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec";

const dom = {};
let lookupToken = "";
let contestant = null;
let products = [];
let productMap = {};
let cart = {};

const PRODUCT_SPECS = [
  {
    id: "ecert",
    label: "電子證書 E-cert",
    type: "single",
    codes: ["ECERT"],
    addColumns: ["ECERT_ADD"],
    purchasedFields: ["ECERT_TLL"],
  },
  {
    id: "notebook",
    label: "藝術家靈感筆記",
    type: "quantity",
    codes: ["NOTEBOOK"],
    addColumns: ["NOTEBOOK_ADD"],
  },
  {
    id: "tote",
    label: "藝術家布袋（A3大小）",
    type: "variantQuantity",
    codes: ["TOTE_A", "TOTE_B", "TOTE_C"],
    addColumns: ["TOTE_A_ADD", "TOTE_B_ADD", "TOTE_C_ADD"],
    variants: [
      { code: "TOTE_A", label: "A. 法國小鎮" },
      { code: "TOTE_B", label: "B. 藝術彩環" },
      { code: "TOTE_C", label: "C. 年度藝術家" },
    ],
  },
  {
    id: "bag",
    label: "藝術繩索背包",
    type: "variantQuantity",
    codes: ["BAG_A", "BAG_B", "BAG_C"],
    addColumns: ["BAG_A_ADD", "BAG_B_ADD", "BAG_C_ADD"],
    variants: [
      { code: "BAG_A", label: "A. 法國小鎮" },
      { code: "BAG_B", label: "B. 藝術彩環" },
      { code: "BAG_C", label: "C. 年度藝術家" },
    ],
  },
  {
    id: "case",
    label: "藝術家筆袋",
    type: "variantQuantity",
    codes: ["CASE_A", "CASE_B", "CASE_C", "CASE_D"],
    addColumns: ["CASE_A_ADD", "CASE_B_ADD", "CASE_C_ADD", "CASE_D_ADD"],
    variants: [
      { code: "CASE_A", label: "A. 太空黑" },
      { code: "CASE_B", label: "B. 靈感白" },
      { code: "CASE_C", label: "C. 星夜藍" },
      { code: "CASE_D", label: "D. 晨光白" },
    ],
  },
  {
    id: "adj",
    label: "評判評語及評分紙",
    type: "single",
    codes: ["ADJ"],
    addColumns: ["ADJ_ADD"],
    disabledUnlessAwarded: true,
  },
  {
    id: "parisEarly",
    label: "巴黎展覽參展 - 限時早鳥優惠",
    type: "single",
    codes: ["PARIS_EARLY"],
    addColumns: ["PARIS_EARLY_ADD"],
    purchasedFields: ["PARIS_TTL"],
  },
  {
    id: "paris",
    label: "巴黎展覽參展",
    type: "single",
    codes: ["PARIS"],
    addColumns: ["PARIS_ADD"],
    purchasedFields: ["PARIS_TTL"],
  },
  {
    id: "hkacEarly",
    label: "香港藝術中心展覽參展 - 限時早鳥優惠",
    type: "single",
    codes: ["HKAC_EARLY"],
    addColumns: ["HKAC_EARLY_ADD"],
    purchasedFields: ["HKAC_TTL"],
  },
  {
    id: "hkac",
    label: "香港藝術中心展覽參展",
    type: "single",
    codes: ["HKAC"],
    addColumns: ["HKAC_ADD"],
    purchasedFields: ["HKAC_TTL"],
  },
  {
    id: "doubleExhibit",
    label: "雙重參展（巴黎+香港藝術中心）- 限時組合優惠",
    type: "single",
    codes: ["DOUBLE_EXHIT"],
    addColumns: ["DOUBLE_EXHIT_ADD"],
    purchasedFields: ["PARIS_TTL", "HKAC_TTL"],
    purchasedMode: "all",
  },
];

document.addEventListener("DOMContentLoaded", init);

function init() {
  dom.form = document.getElementById("lookupForm");
  dom.name = document.getElementById("contestantName");
  dom.yob = document.getElementById("yearOfBirth");
  dom.entryNo = document.getElementById("entryNo");
  dom.confirmButton = document.getElementById("confirmButton");
  dom.message = document.getElementById("lookupMessage");
  dom.section2 = document.getElementById("section2");
  dom.candidatePreview = document.getElementById("candidatePreview");
  dom.section3 = document.getElementById("section3");
  dom.productGrid = document.getElementById("productGrid");
  dom.productMessage = document.getElementById("productMessage");
  dom.totalPayable = document.getElementById("totalPayable");
  dom.section4 = document.getElementById("section4");
  dom.paymentMethod = document.getElementById("paymentMethod");
  dom.payeeName = document.getElementById("payeeName");
  dom.paymentSlip = document.getElementById("paymentSlip");

  dom.form.addEventListener("submit", handleLookupSubmit);
  [dom.name, dom.yob, dom.entryNo].forEach((input) => {
    input.addEventListener("input", updateConfirmState);
  });

  updateConfirmState();
}

function updateConfirmState() {
  dom.confirmButton.disabled = !isLookupReady();
}

function isLookupReady() {
  return Boolean(
    dom.name.value.trim() &&
      /^\d{4}$/.test(dom.yob.value.trim()) &&
      dom.entryNo.value.trim()
  );
}

async function handleLookupSubmit(event) {
  event.preventDefault();
  clearMessage();

  const payload = {
    action: "lookup",
    name: dom.name.value.trim(),
    yob: dom.yob.value.trim(),
    entryNo: dom.entryNo.value.trim(),
  };

  if (!payload.name || !payload.yob || !payload.entryNo) {
    showMessage("請輸入參賽者名字、出生年份及得獎者編號。", "error");
    return;
  }

  if (!/^\d{4}$/.test(payload.yob)) {
    showMessage("出生年份必須為 4 位數字，例如 2021。", "error");
    return;
  }

  setLoading(true);

  try {
    const result = await jsonpLookup(payload);

    if (!result.success) {
      showMessage(result.message || "查閱失敗，請重新輸入。", "error");
      lockSection2();
      return;
    }

    lookupToken = result.lookupToken || "";
    contestant = result.contestant || {};
    showMessage("查閱成功，請核對得獎資料。", "success");
    unlockSection2(contestant);
    await unlockSection3();
  } catch (error) {
    showMessage("系統暫時未能處理查詢，請稍後再試。", "error");
    lockSection2();
    lockSection3();
  } finally {
    setLoading(false);
  }
}

function jsonpLookup(payload) {
  return jsonpRequest(payload, "aotLookup");
}

function jsonpRequest(payload, prefix) {
  return new Promise((resolve, reject) => {
    const callbackName = `${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const params = new URLSearchParams(payload);
    params.set("callback", callbackName);

    const script = document.createElement("script");
    script.src = `${WEB_APP_URL}?${params.toString()}`;
    script.async = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Lookup timed out"));
    }, 20000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Lookup request failed"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    document.body.appendChild(script);
  });
}

function unlockSection2(data) {
  dom.section2.classList.remove("is-hidden");
  dom.candidatePreview.innerHTML = [
    ["得獎者編號 Entry No.", data.IND_CODE],
    ["得獎者姓名 (中文)", data.NAME_CHI],
    ["得獎者姓名 (English)", data.NAME_EN],
    ["出生年份 Year of Birth", data.YOB],
    ["參賽組別", data.YOB_GROUP],
    ["獎項 (中文)", data.AWARD_CHI],
    ["Award", data.AWARD_ENG],
    ["最具人氣大獎結果", data.STATUS_MYFAV],
    ["獎項到付郵寄地址", data.SHIP_ADDR],
    ["參賽畫作狀況", data.STATUS_RETURN],
  ]
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => renderDefinition(label, value))
    .join("");
}

function lockSection2() {
  lookupToken = "";
  contestant = null;
  dom.section2.classList.add("is-hidden");
  dom.candidatePreview.innerHTML = renderDefinition("狀態", "請先完成 Section 1 查閱。");
}

function renderDefinition(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function setLoading(isLoading) {
  dom.confirmButton.disabled = isLoading || !isLookupReady();
  dom.confirmButton.textContent = isLoading ? "查閱中..." : "確認 Confirm";
}

function showMessage(message, type) {
  dom.message.innerHTML = message;
  dom.message.className = `message is-${type}`;
}

function clearMessage() {
  dom.message.textContent = "";
  dom.message.className = "message";
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function unlockSection3() {
  dom.section3.classList.remove("is-hidden");
  dom.productMessage.textContent = "";
  cart = {};

  if (!products.length) {
    try {
      const result = await jsonpRequest({ action: "products" }, "aotProducts");
      products = result.products || [];
      productMap = products.reduce((map, product) => {
        map[normalizeCode(product.code)] = product;
        return map;
      }, {});
    } catch (error) {
      dom.productMessage.textContent = "暫時未能載入加購項目，請稍後再試。";
      dom.productMessage.className = "message is-error";
      return;
    }
  }

  renderProducts();
  updateTotalPayable();
}

function lockSection3() {
  dom.section3.classList.add("is-hidden");
  dom.productGrid.innerHTML = "";
  dom.productMessage.textContent = "";
  cart = {};
  updateTotalPayable();
  updatePaymentSection(0);
}

function renderProducts() {
  const visibleSpecs = PRODUCT_SPECS.filter((spec) => {
    return spec.codes.some((code) => {
      const product = productMap[normalizeCode(code)];
      return product && normalizeStatus(product.shelfStatus) !== "OFF";
    });
  });

  dom.productGrid.innerHTML = visibleSpecs.map(renderProductCard).join("");

  dom.productGrid.querySelectorAll("[data-product-input]").forEach((input) => {
    input.addEventListener("change", handleProductChange);
  });
}

function renderProductCard(spec) {
  const selectedCode = spec.codes.find((code) => productMap[normalizeCode(code)]) || spec.codes[0];
  const product = productMap[normalizeCode(selectedCode)] || {};
  const disabledReason = getProductDisabledReason(spec, product);
  const disabled = Boolean(disabledReason);
  const description = product.description || "";
  const price = getSpecPrice(spec, selectedCode);
  const photo = product.photo || "";

  return `
    <article class="product-card ${photo ? "" : "no-photo"} ${disabled ? "is-disabled" : ""}" data-product-id="${escapeHtml(spec.id)}">
      ${photo ? `<img class="product-photo" src="${escapeHtml(photo)}" alt="">` : ""}
      <div class="product-main">
        <div class="product-title-row">
          <h3>${escapeHtml(spec.label)}</h3>
          <span class="product-price" data-line-price="${escapeHtml(spec.id)}">${formatMoney(price)}</span>
        </div>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        ${disabledReason ? `<p class="disabled-reason">${escapeHtml(disabledReason)}</p>` : ""}
        ${renderProductControls(spec, disabled)}
      </div>
    </article>
  `;
}

function renderProductControls(spec, disabled) {
  if (spec.type === "single") {
    return `
      <label class="product-check">
        <input type="checkbox" data-product-input data-product-id="${escapeHtml(spec.id)}" ${disabled ? "disabled" : ""}>
        <span>加購此項目</span>
      </label>
    `;
  }

  if (spec.type === "quantity") {
    return `
      <label class="product-field">
        <span>數量</span>
        <select data-product-input data-product-id="${escapeHtml(spec.id)}" ${disabled ? "disabled" : ""}>
          ${renderQuantityOptions()}
        </select>
      </label>
    `;
  }

  return `
    <div class="product-control-grid">
      <label class="product-field">
        <span>款式</span>
        <select data-product-input data-product-id="${escapeHtml(spec.id)}" data-role="variant" ${disabled ? "disabled" : ""}>
          ${spec.variants.map((variant) => {
            const unavailable = !productMap[normalizeCode(variant.code)] || normalizeStatus(productMap[normalizeCode(variant.code)].shelfStatus) === "OFF";
            return `<option value="${escapeHtml(variant.code)}" ${unavailable ? "disabled" : ""}>${escapeHtml(variant.label)}</option>`;
          }).join("")}
        </select>
      </label>
      <label class="product-field">
        <span>數量</span>
        <select data-product-input data-product-id="${escapeHtml(spec.id)}" data-role="quantity" ${disabled ? "disabled" : ""}>
          ${renderQuantityOptions()}
        </select>
      </label>
    </div>
  `;
}

function renderQuantityOptions() {
  return Array.from({ length: 10 }, (_, value) => {
    return `<option value="${value}">${value}</option>`;
  }).join("");
}

function handleProductChange(event) {
  const input = event.target;
  const productId = input.dataset.productId;
  const spec = PRODUCT_SPECS.find((item) => item.id === productId);
  if (!spec) return;

  const card = input.closest("[data-product-id]");
  if (spec.type === "single") {
    cart[productId] = input.checked ? { code: spec.codes[0], quantity: 1 } : null;
  } else if (spec.type === "quantity") {
    const quantity = Number(input.value || 0);
    cart[productId] = quantity > 0 ? { code: spec.codes[0], quantity } : null;
  } else {
    const variant = card.querySelector('[data-role="variant"]').value;
    const quantity = Number(card.querySelector('[data-role="quantity"]').value || 0);
    cart[productId] = quantity > 0 ? { code: variant, quantity } : null;
  }

  updateProductLineTotal(card, spec);
  updateTotalPayable();
}

function updateTotalPayable() {
  const total = calculateCartTotal();

  if (dom.totalPayable) {
    dom.totalPayable.textContent = formatMoney(total);
  }

  updatePaymentSection(total);
}

function calculateCartTotal() {
  return Object.values(cart).reduce((sum, item) => {
    if (!item) return sum;
    return sum + getLineTotal(item);
  }, 0);
}

function getLineTotal(item) {
  const product = productMap[normalizeCode(item.code)] || {};
  return (Number(product.price) || 0) * (Number(item.quantity) || 0);
}

function updateProductLineTotal(card, spec) {
  if (!card) return;

  const priceEl = card.querySelector("[data-line-price]");
  if (!priceEl) return;

  const item = cart[spec.id];
  if (!item) {
    priceEl.textContent = formatMoney(getSpecPrice(spec, getCurrentProductCode(card, spec)));
    return;
  }

  priceEl.textContent = formatMoney(getLineTotal(item));
}

function getCurrentProductCode(card, spec) {
  if (spec.type === "variantQuantity") {
    return card.querySelector('[data-role="variant"]')?.value || spec.codes[0];
  }

  return spec.codes[0];
}

function updatePaymentSection(total) {
  if (!dom.section4) return;

  const shouldShow = Number(total || 0) > 0;
  dom.section4.classList.toggle("is-hidden", !shouldShow);

  if (dom.paymentMethod) dom.paymentMethod.required = shouldShow;
  if (dom.payeeName) dom.payeeName.required = shouldShow;

  if (!shouldShow) {
    if (dom.paymentMethod) dom.paymentMethod.value = "";
    if (dom.payeeName) dom.payeeName.value = "";
  }
}

function getProductDisabledReason(spec, product) {
  const status = normalizeStatus(product.shelfStatus);
  if (status === "GREY OUT") return "此項目暫時不能加購。";

  if (isAlreadyPurchased(spec)) {
    return "此項目已加購。";
  }

  if (
    spec.disabledUnlessAwarded &&
    !["冠軍", "亞軍", "季軍", "殿軍"].includes(String(contestant.AWARD_CHI || "").trim())
  ) {
    return "此項目只適用於冠軍、亞軍、季軍或殿軍。";
  }

  return "";
}

function isAlreadyPurchased(spec) {
  if (!spec.purchasedFields || !spec.purchasedFields.length) return false;

  const checker = (field) => Number(contestant[field] || 0) > 0;
  return spec.purchasedMode === "all"
    ? spec.purchasedFields.every(checker)
    : spec.purchasedFields.some(checker);
}

function getSpecPrice(spec, code) {
  const product = productMap[normalizeCode(code || spec.codes[0])] || {};
  return Number(product.price) || 0;
}

function formatMoney(value) {
  return `HK$${Number(value || 0).toLocaleString("en-HK")}`;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}
