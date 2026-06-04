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
  dom.contactNumber = document.getElementById("contactNumber");
  dom.contactEmail = document.getElementById("contactEmail");
  dom.enquiryText = document.getElementById("enquiryText");
  dom.section5 = document.getElementById("section5");
  dom.agreeTerms = document.getElementById("agreeTerms");
  dom.submitButton = document.getElementById("submitButton");
  dom.submitMessage = document.getElementById("submitMessage");

  dom.form.addEventListener("submit", handleLookupSubmit);
  dom.submitButton.addEventListener("click", handleSubmitClick);
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
      lockSection3();
      lockSection5();
      return;
    }

    lookupToken = result.lookupToken || "";
    contestant = result.contestant || {};
    showMessage("查閱成功，請核對得獎資料。", "success");
    unlockSection2(contestant);
    await unlockSection3();
    unlockSection5();
  } catch (error) {
    showMessage("系統暫時未能處理查詢，請稍後再試。", "error");
    lockSection2();
    lockSection3();
    lockSection5();
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
  dom.candidatePreview.innerHTML = renderCandidateRows([
    ["2a 得獎者姓名 (中文 Chinese)", data.NAME_CHI],
    ["2b 得獎者姓名 (英文 English)", data.NAME_EN],
    ["2c 得獎者出生年份 Year of Birth", data.YOB],
    ["2d 參賽組別", data.YOB_GROUP],
    ["2e 獎項 (中文)", data.AWARD_CHI],
    ["2f Award (French title)", data.AWARD_ENG],
    ["2g 最具人氣大獎結果", data.STATUS_MYFAV],
    ["2h 獎項到付郵寄地址", data.SHIP_ADDR],
    ["2i 參賽畫作狀況", data.STATUS_RETURN],
    ["2j 藝術家簽名 Artist's Signature (印於藝術贈品上)", data.ART_SIGNATURE_EN],
    ["2k 已加購數量 - 電子證書 E-cert", data.ECERT_TLL, true],
    ["2l 已加購數量 - 額外藝術家靈感筆記", data.NOTEBOOK_TLL, true],
    ["2m 已加購數量 - 法國小鎮（布袋）", data.TOTE_A_TLL, true],
    ["2n 已加購數量 - 藝術彩環（布袋）", data.TOTE_B_TLL, true],
    ["2o 已加購數量 - 年度藝術家（布袋）", data.TOTE_C_TLL, true],
    ["2p 已加購數量 - 法國小鎮（背包）", data.BAG_A_TLL, true],
    ["2q 已加購數量 - 藝術彩環（背包）", data.BAG_B_TLL, true],
    ["2r 已加購數量 - 年度藝術家（背包）", data.BAG_C_TLL, true],
    ["2s 已加購數量 - 太空黑（筆袋）", data.CASE_A_TLL, true],
    ["2t 已加購數量 - 靈感白（筆袋）", data.CASE_B_TLL, true],
    ["2u 已加購數量 - 星夜藍（筆袋）", data.CASE_C_TLL, true],
    ["2v 已加購數量 - 晨光白（筆袋）", data.CASE_D_TLL, true],
    ["2w 已加購數量 - 評判評語及評分紙", data.ADJ_TLL, true],
    ["2x 已加購數量 - 巴黎展覽", data.PARIS_TTL, true],
    ["2y 已加購數量 - 香港展覽", data.HKAC_TTL, true],
    ["2z 已加購項目 Purchase Status", data.PURCHASE_STATUS],
    ["2aa 作品主題、名稱或描述 Artwork Description (optional)", data.ART_DESC],
    ["2ab 學校英文名稱 School Name", data.EDU_SCH],
  ]);
}

function renderCandidateRows(rows) {
  return rows
    .filter(([, value, hideIfBlank]) => !hideIfBlank || hasValue(value))
    .map(([label, value]) => renderDefinition(label, hasValue(value) ? value : "未有資料"))
    .join("");
}

function lockSection2() {
  lookupToken = "";
  contestant = null;
  dom.section2.classList.add("is-hidden");
  dom.candidatePreview.innerHTML = renderDefinition("狀態", "請先完成 Section 1 查閱。");
  if (dom.contactNumber) dom.contactNumber.value = "";
  if (dom.contactEmail) dom.contactEmail.value = "";
  if (dom.enquiryText) dom.enquiryText.value = "";
}

function renderDefinition(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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
    <div class="variant-list">
      ${spec.variants.map((variant) => {
        const variantProduct = productMap[normalizeCode(variant.code)];
        const unavailable = !variantProduct || normalizeStatus(variantProduct.shelfStatus) === "OFF";
        return `
          <label class="variant-row ${unavailable ? "is-unavailable" : ""}">
            <span>
              ${escapeHtml(variant.label)}
              <small>${formatMoney(Number(variantProduct?.price) || 0)}</small>
              ${unavailable ? `<em>此項目暫時不能加購。</em>` : ""}
            </span>
            <select
              data-product-input
              data-product-id="${escapeHtml(spec.id)}"
              data-role="variant-quantity"
              data-variant-code="${escapeHtml(variant.code)}"
              ${disabled || unavailable ? "disabled" : ""}
            >
              ${renderQuantityOptions()}
            </select>
          </label>
        `;
      }).join("")}
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

  const card = input.closest(".product-card");
  if (spec.type === "single") {
    cart[productId] = input.checked ? { code: spec.codes[0], quantity: 1 } : null;
  } else if (spec.type === "quantity") {
    const quantity = Number(input.value || 0);
    cart[productId] = quantity > 0 ? { code: spec.codes[0], quantity } : null;
  } else {
    const variantItems = Array.from(card.querySelectorAll('[data-role="variant-quantity"]'))
      .map((select) => {
        const quantity = Number(select.value || 0);
        return quantity > 0
          ? { code: select.dataset.variantCode, quantity }
          : null;
      })
      .filter(Boolean);

    cart[productId] = variantItems.length ? variantItems : null;
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
    if (Array.isArray(item)) {
      return sum + item.reduce((variantSum, variantItem) => variantSum + getLineTotal(variantItem), 0);
    }
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

  if (Array.isArray(item)) {
    priceEl.textContent = formatMoney(item.reduce((sum, variantItem) => sum + getLineTotal(variantItem), 0));
    return;
  }

  priceEl.textContent = formatMoney(getLineTotal(item));
}

function getCurrentProductCode(card, spec) {
  if (spec.type === "variantQuantity") {
    const selectedVariant = Array.from(card.querySelectorAll('[data-role="variant-quantity"]'))
      .find((select) => Number(select.value || 0) > 0);

    return selectedVariant?.dataset.variantCode || spec.codes[0];
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

function unlockSection5() {
  dom.section5.classList.remove("is-hidden");
  if (dom.submitMessage) {
    dom.submitMessage.textContent = "";
    dom.submitMessage.className = "message";
  }
}

function lockSection5() {
  if (!dom.section5) return;
  dom.section5.classList.add("is-hidden");
  if (dom.agreeTerms) dom.agreeTerms.checked = false;
  if (dom.submitMessage) {
    dom.submitMessage.textContent = "";
    dom.submitMessage.className = "message";
  }
}

function handleSubmitClick() {
  const errors = [];

  if (!lookupToken) {
    errors.push("請先完成比賽成績查閱。");
  }

  if (!dom.contactNumber.value.trim()) {
    errors.push("請填寫家長/聯絡人 WhatsApp 號碼。");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dom.contactEmail.value.trim())) {
    errors.push("請填寫有效的家長/聯絡人電郵地址。");
  }

  const total = calculateCartTotal();
  if (total > 0) {
    if (!dom.paymentMethod.value.trim()) {
      errors.push("請選擇付款方式。");
    }

    if (!dom.payeeName.value.trim()) {
      errors.push("請填寫付款銀行帳戶之英文姓名。");
    }
  }

  if (!dom.agreeTerms.checked) {
    errors.push("請確認本人明白及同意本表格細則。");
  }

  if (errors.length) {
    showSubmitMessage(errors.join("<br>"), "error");
    return;
  }

  showSubmitMessage("資料已通過前端檢查。提交寫入 Google Sheet 功能將於下一階段接駁。", "success");
}

function showSubmitMessage(message, type) {
  dom.submitMessage.innerHTML = message;
  dom.submitMessage.className = `message is-${type}`;
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
