const WEB_APP_URL =
  "https://hkycaa-add-on-upload-965808237264.asia-east2.run.app";
const LEGACY_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec";
const CLOUD_RUN_UPLOAD_URL = "https://hkycaa-add-on-upload-965808237264.asia-east2.run.app";
const MAX_PAYMENT_SLIP_BYTES = 10 * 1024 * 1024;
const STRIPE_PAYMENT_METHOD = "信用卡 / Alipay 內地版 / WeChat Pay 內地版 (+4% 手續費)";
const STRIPE_HANDLING_FEE_RATE = 0.04;
const CHECKOUT_DRAFT_KEY = "hkycaa_addon_checkout_draft";
const CHECKOUT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const ALLOWED_PAYMENT_SLIP_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const dom = {};
const MAX_JSONP_URL_LENGTH = 120000;
let lookupToken = "";
let currentSubmissionId = "";
let previousSubmissionId = "";
let contestant = null;
let products = [];
let productMap = {};
let cart = {};
let latestAmendUrl = "";

const DEFAULT_SITE_CONFIG = {
  competitionName: "SHOW YOUR COLOURS! 當代兒童繪畫大賽 2026",
  formTitle: "比賽成績查閱及加購表格",
  formIntro: "請先完成比賽成績查閱，再核對資料及選擇加購項目。",
  competitionPhotoUrl: "",
};

const PRODUCT_SPECS = [
  {
    id: "ecert",
    label: "電子證書 E-cert",
    type: "single",
    codes: ["ECERT"],
    addColumns: ["ECERT_ADD"],
    purchasedFields: ["ECERT_TTL"],
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
  dom.competitionName = document.getElementById("competitionName");
  dom.pageTitle = document.getElementById("pageTitle");
  dom.formIntro = document.getElementById("formIntro");
  dom.competitionPhoto = document.getElementById("competitionPhoto");
  dom.topNotice = document.getElementById("topNotice");
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
  dom.payeeNameField = document.getElementById("payeeNameField");
  dom.payeeName = document.getElementById("payeeName");
  dom.paymentSlipField = document.getElementById("paymentSlipField");
  dom.paymentSlip = document.getElementById("paymentSlip");
  dom.paymentSlipNote = document.getElementById("paymentSlipNote");
  dom.contactNumber = document.getElementById("contactNumber");
  dom.contactEmail = document.getElementById("contactEmail");
  dom.enquiryText = document.getElementById("enquiryText");
  dom.section5 = document.getElementById("section5");
  dom.agreeTerms = document.getElementById("agreeTerms");
  dom.submitButton = document.getElementById("submitButton");
  dom.submitMessage = document.getElementById("submitMessage");
  dom.section6 = document.getElementById("section6");
  dom.submissionSummary = document.getElementById("submissionSummary");
  dom.newSubmissionButton = document.getElementById("newSubmissionButton");
  dom.editSubmissionButton = document.getElementById("editSubmissionButton");

  dom.form.addEventListener("submit", handleLookupSubmit);
  dom.submitButton.addEventListener("click", handleSubmitClick);
  dom.newSubmissionButton.addEventListener("click", handleNewSubmissionClick);
  dom.editSubmissionButton.addEventListener("click", handleEditSubmissionClick);
  dom.contactNumber.addEventListener("input", handleContactNumberInput);
  dom.paymentMethod.addEventListener("change", handlePaymentMethodChange);
  [dom.name, dom.yob, dom.entryNo].forEach((input) => {
    input.addEventListener("input", updateConfirmState);
  });

  updateConfirmState();
  updateUploadAvailability();
  loadSiteConfig();
  handleStripeReturn();
  handleAmendUrl();
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

  let result = null;
  try {
    result = await jsonpLookup(payload);
  } catch (error) {
    showMessage(getLookupErrorMessage(error), "error");
    lockSection2();
    lockSection3();
    lockSection5();
    lockSection6();
    setLoading(false);
    return;
  }

    if (!result.success) {
    showMessage(result.message || "查閱失敗，請重新輸入。", "error");
    lockSection2();
    lockSection3();
    lockSection5();
    lockSection6();
    setLoading(false);
    return;
  }

  try {
    lookupToken = result.lookupToken || "";
    currentSubmissionId = "";
    contestant = result.contestant || {};
    showMessage("查閱成功，請核對得獎資料。", "success");
    lockSection6();
    unlockSection2(contestant);
    await unlockSection3();
    unlockSection5();
  } catch (error) {
    console.error(error);
    showMessage("查閱成功，但暫時未能載入加購項目。請重新整理頁面後再試。", "error");
    lockSection3();
    lockSection5();
    lockSection6();
  } finally {
    setLoading(false);
  }
}

function getLookupErrorMessage(error) {
  const message = String(error && error.message ? error.message : error);

  if (message === "REQUEST_TIMEOUT") {
    return "查詢需時過長，請稍後再試。";
  }

  if (message === "REQUEST_FAILED") {
    return "查詢連線失敗，請重新整理頁面後再試。";
  }

  return "系統暫時未能處理查詢，請稍後再試。";
}

function jsonpLookup(payload) {
  return apiRequest(payload, "aotLookup");
}

async function loadSiteConfig() {
  try {
    const result = await apiRequest({ action: "config" }, "aotConfig");
    applySiteConfig(result.config || DEFAULT_SITE_CONFIG);
  } catch (error) {
    applySiteConfig(DEFAULT_SITE_CONFIG);
  }
}

function applySiteConfig(config) {
  const merged = Object.assign({}, DEFAULT_SITE_CONFIG, config || {});

  dom.competitionName.textContent = merged.competitionName;
  dom.pageTitle.textContent = merged.formTitle;
  dom.formIntro.textContent = merged.formIntro;
  document.title = merged.formTitle;

  if (isUsableUrl(merged.competitionPhotoUrl)) {
    dom.competitionPhoto.src = merged.competitionPhotoUrl;
    dom.competitionPhoto.alt = merged.competitionName;
    dom.competitionPhoto.classList.remove("is-hidden");
  } else {
    dom.competitionPhoto.removeAttribute("src");
    dom.competitionPhoto.alt = "";
    dom.competitionPhoto.classList.add("is-hidden");
  }
}

function isUsableUrl(value) {
  const text = String(value || "").trim();
  return Boolean(text && text.toUpperCase() !== "NA" && /^https?:\/\//i.test(text));
}

async function apiRequest(payload, prefix) {
  if (payload.action === "amend" || payload.action === "createCheckoutSession" || payload.action === "stripeCheckoutResult") {
    return fetchRequest(payload, WEB_APP_URL);
  }

  try {
    return await fetchRequest(payload, WEB_APP_URL);
  } catch (primaryError) {
    try {
      return await fetchRequest(payload, LEGACY_WEB_APP_URL);
    } catch (legacyFetchError) {
      return jsonpRequest(payload, prefix, LEGACY_WEB_APP_URL);
    }
  }
}

async function fetchRequest(payload, baseUrl) {
  if (payload.action === "submit" || payload.action === "createCheckoutSession") {
    return postRequest(payload, baseUrl);
  }

  const params = new URLSearchParams(payload);
  const requestUrl = `${baseUrl}?${params.toString()}`;
  if (requestUrl.length > MAX_JSONP_URL_LENGTH) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    const result = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(result?.message || result?.detail || "REQUEST_FAILED");
    }

    return result;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("REQUEST_TIMEOUT");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function postRequest(payload, baseUrl) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal,
    });

    const result = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(result?.message || result?.detail || "REQUEST_FAILED");
    }

    return result;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("REQUEST_TIMEOUT");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function jsonpRequest(payload, prefix, baseUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = `${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const params = new URLSearchParams(payload);
    params.set("callback", callbackName);

    const script = document.createElement("script");
    const requestUrl = `${baseUrl}?${params.toString()}`;
    if (requestUrl.length > MAX_JSONP_URL_LENGTH) {
      reject(new Error("REQUEST_TOO_LARGE"));
      return;
    }

    script.src = requestUrl;
    script.async = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("REQUEST_TIMEOUT"));
    }, 60000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("REQUEST_FAILED"));
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
    renderCandidateSection("參賽者及獎項資料", [
      ["得獎者姓名 (中文 Chinese)", data.NAME_CHI],
      ["得獎者姓名 (英文 English)", data.NAME_EN],
      ["得獎者出生年份 Year of Birth", data.YOB],
      ["參賽組別", data.YOB_GROUP],
      ["獎項 (中文)", data.AWARD_CHI],
      ["Award (French title)", data.AWARD_ENG],
      ["最具人氣大獎結果", data.STATUS_MYFAV],
      ["獎項到付郵寄地址", data.SHIP_ADDR],
      ["參賽畫作狀況", data.STATUS_RETURN],
      ["藝術家簽名 Artist's Signature (印於藝術贈品上)", data.ART_SIGNATURE_EN],
      ["作品主題、名稱或描述 Artwork Description (optional)", data.ART_DESC],
      ["學校英文名稱 School Name", data.EDU_SCH],
    ]),
    renderCandidateSection("已加購記錄", [
      ["電子證書 E-cert", data.ECERT_TTL, true],
      ["額外藝術家靈感筆記", data.NOTEBOOK_TTL, true],
      ["法國小鎮（布袋）", data.TOTE_A_TTL, true],
      ["藝術彩環（布袋）", data.TOTE_B_TTL, true],
      ["年度藝術家（布袋）", data.TOTE_C_TTL, true],
      ["法國小鎮（背包）", data.BAG_A_TTL, true],
      ["藝術彩環（背包）", data.BAG_B_TTL, true],
      ["年度藝術家（背包）", data.BAG_C_TTL, true],
      ["太空黑（筆袋）", data.CASE_A_TTL, true],
      ["靈感白（筆袋）", data.CASE_B_TTL, true],
      ["星夜藍（筆袋）", data.CASE_C_TTL, true],
      ["晨光白（筆袋）", data.CASE_D_TTL, true],
      ["評判評語及評分紙", data.ADJ_TTL, true],
      ["巴黎展覽", data.PARIS_TTL, true],
      ["香港展覽", data.HKAC_TTL, true],
      ["已加購項目 Purchase Status", data.PURCHASE_STATUS],
    ], "暫未有已加購記錄。"),
  ].join("");
}

function renderCandidateSection(title, rows, emptyMessage) {
  const renderedRows = rows
    .filter(([label, value, hideIfBlank]) => {
      if (!hideIfBlank) return true;
      if (hasValue(value)) return true;
      return label.includes("電子證書") && hasPurchasedText("電子證書");
    })
    .map(([label, value]) => {
      const fallback = label.includes("電子證書") && hasPurchasedText("電子證書") ? "已加購" : "未有資料";
      return renderDefinition(label, hasValue(value) ? value : fallback);
    })
    .join("");

  return `
    <section class="candidate-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="candidate-rows">
        ${renderedRows || renderDefinition("狀態", emptyMessage || "未有資料")}
      </div>
    </section>
  `;
}

function lockSection2() {
  lookupToken = "";
  currentSubmissionId = "";
  previousSubmissionId = "";
  contestant = null;
  dom.section2.classList.add("is-hidden");
  dom.candidatePreview.innerHTML = renderCandidateSection("狀態", [["查閱狀態", "請先完成 Section 1 查閱。"]]);
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

function hasPurchasedText(keyword) {
  return String(contestant?.PURCHASE_STATUS || "").includes(keyword) &&
    String(contestant?.PURCHASE_STATUS || "").includes("已加購");
}

function setLoading(isLoading) {
  dom.confirmButton.disabled = isLoading || !isLookupReady();
  dom.confirmButton.classList.toggle("is-loading", isLoading);
  dom.confirmButton.setAttribute("aria-busy", isLoading ? "true" : "false");
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

  try {
    await ensureProductsLoaded();
  } catch (error) {
    dom.productMessage.textContent = "暫時未能載入加購項目，請稍後再試。";
    dom.productMessage.className = "message is-error";
    return;
  }

  renderProducts();
  updateTotalPayable();
}

async function ensureProductsLoaded() {
  if (products.length) return;

  const result = await apiRequest({ action: "products" }, "aotProducts");
  products = result.products || [];
  productMap = products.reduce((map, product) => {
    map[normalizeCode(product.code)] = product;
    return map;
  }, {});
}

function lockSection3() {
  dom.section3.classList.add("is-hidden");
  dom.productGrid.innerHTML = "";
  dom.productMessage.textContent = "";
  cart = {};
  updateTotalPayable();
  updatePaymentSection(0);
}

async function handleAmendUrl() {
  const amendToken = new URLSearchParams(window.location.search).get("amend");
  if (!amendToken) return;

  showTopNotice("正在載入已提交資料...", "info");

  try {
    const result = await apiRequest({ action: "amend", token: amendToken }, "aotAmend");
    if (!result.success || result.mode !== "amend") {
      showTopNotice(result.message || "修改連結無效，請重新查閱得獎者資料。", "error");
      return;
    }

    await restoreAmendment(result);
    showTopNotice("已載入提交資料，可修改後重新遞交。", "success");
  } catch (error) {
    showTopNotice(getSubmitErrorMessage(error), "error");
  }
}

async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const paymentState = params.get("payment");
  if (!paymentState) return;

  if (paymentState === "cancelled") {
    const restored = await restoreCheckoutDraft();
    clearPaymentReturnParams();
    showTopNotice(
      restored
        ? "付款未完成，已還原剛才填寫的資料，可再次遞交並付款。"
        : "付款未完成，請重新查閱得獎者資料後再遞交。",
      restored ? "info" : "error"
    );
    return;
  }

  if (paymentState !== "success") return;

  const sessionId = params.get("session_id");
  showTopNotice("正在確認付款狀態...", "info");

  try {
    const result = await apiRequest(
      {
        action: "stripeCheckoutResult",
        sessionId,
      },
      "aotStripeResult"
    );

    if (!result.success) {
      throw new Error(result.message || "付款尚未完成，請稍後再試。");
    }

    clearCheckoutDraft();
    clearPaymentReturnParams();
    const submission = result.submission || {};
    submission.amendToken = result.amendToken || "";
    showSection6(result.submissionId, submission);
    showTopNotice("已成功付款及遞交。", "success");
  } catch (error) {
    const restored = await restoreCheckoutDraft();
    clearPaymentReturnParams();
    showTopNotice(
      restored
        ? `${getSubmitErrorMessage(error)}<br>已還原剛才填寫的資料，可稍後再試。`
        : getSubmitErrorMessage(error),
      "error"
    );
  }
}

function saveCheckoutDraft(submission) {
  const now = Date.now();
  const draft = {
    savedAt: now,
    expiresAt: now + CHECKOUT_DRAFT_TTL_MS,
    lookupToken,
    currentSubmissionId,
    previousSubmissionId,
    contestant,
    lookupFields: {
      name: dom.name.value.trim(),
      yob: dom.yob.value.trim(),
      entryNo: dom.entryNo.value.trim(),
    },
    submission,
  };

  localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
}

function readCheckoutDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(CHECKOUT_DRAFT_KEY) || "null");
    if (!draft || !draft.expiresAt || draft.expiresAt < Date.now()) {
      clearCheckoutDraft();
      return null;
    }

    return draft;
  } catch (error) {
    clearCheckoutDraft();
    return null;
  }
}

function clearCheckoutDraft() {
  localStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

async function restoreCheckoutDraft() {
  const draft = readCheckoutDraft();
  if (!draft || !draft.submission) return false;

  lookupToken = draft.lookupToken || draft.submission.lookupToken || "";
  currentSubmissionId = draft.currentSubmissionId || draft.submission.submissionId || "";
  previousSubmissionId = draft.previousSubmissionId || draft.submission.previousSubmissionId || "";
  contestant = draft.contestant || {};

  if (draft.lookupFields) {
    dom.name.value = draft.lookupFields.name || "";
    dom.yob.value = draft.lookupFields.yob || "";
    dom.entryNo.value = draft.lookupFields.entryNo || "";
    updateConfirmState();
  }

  lockSection6();
  unlockSection2(contestant);
  await ensureProductsLoaded();
  dom.section3.classList.remove("is-hidden");
  renderProducts();
  restoreCartItems(draft.submission.items || []);

  dom.contactNumber.value = draft.submission.contactNumber || "";
  dom.contactEmail.value = draft.submission.contactEmail || "";
  dom.enquiryText.value = draft.submission.enquiryText || "";
  dom.paymentMethod.value = draft.submission.paymentMethod || "";
  dom.payeeName.value = draft.submission.payeeName || "";
  if (dom.agreeTerms) dom.agreeTerms.checked = false;

  unlockSection5();
  updateTotalPayable();
  dom.section2.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function clearPaymentReturnParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, document.title, url.toString());
}

function buildCheckoutReturnUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function restoreAmendment(result) {
  lookupToken = result.lookupToken || "";
  currentSubmissionId = result.submissionId || "";
  previousSubmissionId = currentSubmissionId;
  contestant = result.contestant || {};

  document.getElementById("section1").classList.add("is-hidden");
  lockSection6();
  unlockSection2(contestant);
  await ensureProductsLoaded();
  dom.section3.classList.remove("is-hidden");
  renderProducts();

  const submission = result.submission || {};
  dom.contactNumber.value = String(submission.contactNumber || "").replace(/\D/g, "");
  dom.contactEmail.value = submission.contactEmail || "";
  dom.enquiryText.value = submission.enquiryText || "";
  dom.paymentMethod.value = submission.paymentMethod || "";
  dom.payeeName.value = submission.payeeName || "";

  restoreCartItems(submission.items || []);
  unlockSection5();
  updateSubmitButtonLabel();
  updateTotalPayable();
  dom.section2.scrollIntoView({ behavior: "smooth", block: "start" });
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

function restoreCartItems(items) {
  cart = {};

  (items || []).forEach((item) => {
    const code = normalizeCode(item.code);
    const quantity = Number(item.quantity) || 0;
    if (!code || quantity <= 0) return;

    const spec = PRODUCT_SPECS.find((candidate) => {
      return candidate.codes.map(normalizeCode).includes(code);
    });
    if (!spec) return;

    if (spec.type === "variantQuantity") {
      const existing = Array.isArray(cart[spec.id]) ? cart[spec.id] : [];
      existing.push({ code, quantity });
      cart[spec.id] = existing;
      return;
    }

    cart[spec.id] = { code, quantity };
  });

  Object.entries(cart).forEach(([productId, value]) => {
    const card = dom.productGrid.querySelector(`[data-product-id="${productId}"]`);
    const spec = PRODUCT_SPECS.find((item) => item.id === productId);
    if (!card || !spec) return;

    if (spec.type === "single") {
      const input = card.querySelector("[data-product-input]");
      if (input) input.checked = Boolean(value);
    } else if (spec.type === "quantity") {
      const input = card.querySelector("[data-product-input]");
      if (input) input.value = String(value.quantity || 0);
    } else {
      (Array.isArray(value) ? value : []).forEach((variantItem) => {
        const input = card.querySelector(`[data-variant-code="${normalizeCode(variantItem.code)}"]`);
        if (input) input.value = String(variantItem.quantity || 0);
      });
    }

    updateProductLineTotal(card, spec);
  });
}

function renderProductCard(spec) {
  const selectedCode = spec.codes.find((code) => productMap[normalizeCode(code)]) || spec.codes[0];
  const product = productMap[normalizeCode(selectedCode)] || {};
  const disabledReason = getProductDisabledReason(spec, product);
  const disabled = Boolean(disabledReason);
  const description = product.description || "";
  const price = getSpecPrice(spec, selectedCode);
  const photo = isUsableUrl(product.photo) ? product.photo : "";

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
  const total = calculateTotalPayable();

  if (dom.totalPayable) {
    dom.totalPayable.textContent = formatMoney(total);
  }

  updatePaymentSection(calculateCartTotal());
  updateSubmitButtonLabel();
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

function calculateTotalPayable() {
  const productTotal = calculateCartTotal();
  if (productTotal <= 0 || !isStripeSelected()) return productTotal;
  return roundMoney(productTotal + calculateStripeHandlingFee(productTotal));
}

function calculateStripeHandlingFee(productTotal) {
  return roundMoney(Number(productTotal || 0) * STRIPE_HANDLING_FEE_RATE);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
  const manualSelected = shouldShow && isManualPaymentSelected();
  dom.section4.classList.toggle("is-hidden", !shouldShow);

  if (dom.paymentMethod) dom.paymentMethod.required = shouldShow;
  if (dom.payeeNameField) dom.payeeNameField.classList.toggle("is-hidden", !manualSelected);
  if (dom.payeeName) {
    dom.payeeName.required = manualSelected;
    dom.payeeName.disabled = !manualSelected;
    if (!manualSelected) dom.payeeName.value = "";
  }
  if (dom.paymentSlipField) dom.paymentSlipField.classList.toggle("is-hidden", !manualSelected);
  if (dom.paymentSlip) dom.paymentSlip.required = manualSelected && isCloudRunUploadEnabled();

  if (!shouldShow) {
    if (dom.paymentMethod) dom.paymentMethod.value = "";
    if (dom.payeeName) dom.payeeName.value = "";
    if (dom.paymentSlip) dom.paymentSlip.value = "";
  }

  updateUploadAvailability();
}

function updateUploadAvailability() {
  if (!dom.paymentSlip) return;

  const total = calculateCartTotal();
  const enabled = total > 0 && isManualPaymentSelected() && isCloudRunUploadEnabled();
  dom.paymentSlip.disabled = !enabled;
  if (!enabled) dom.paymentSlip.value = "";

  if (!dom.paymentSlipNote) return;
  if (isStripeSelected()) {
    dom.paymentSlipNote.textContent = "信用卡 / 內地錢包付款將前往 Stripe 付款頁，毋須上載付款記錄。";
    return;
  }

  dom.paymentSlipNote.textContent = enabled
    ? "請上載 PDF、JPG、PNG 或 HEIC 檔案，大小不可超過 10MB。"
    : "請先選擇 PayMe / AlipayHK、轉數快 FPS 或 HSBC 銀行轉帳，才需要上載付款記錄。";
}

function isCloudRunUploadEnabled() {
  return Boolean(CLOUD_RUN_UPLOAD_URL && CLOUD_RUN_UPLOAD_URL.trim());
}

function handlePaymentMethodChange() {
  updatePaymentSection(calculateCartTotal());
  updateTotalPayable();
}

function isStripeSelected() {
  const method = dom.paymentMethod ? dom.paymentMethod.value.trim() : "";
  return method === STRIPE_PAYMENT_METHOD ||
    (/信用卡|WeChat Pay|內地版|\+4%/.test(method) && !/PayMe|AlipayHK|港版/.test(method));
}

function isManualPaymentSelected() {
  return Boolean(dom.paymentMethod && dom.paymentMethod.value.trim() && !isStripeSelected());
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

function lockSection6() {
  if (!dom.section6) return;
  dom.section6.classList.add("is-hidden");
  if (dom.submissionSummary) dom.submissionSummary.innerHTML = "";
  latestAmendUrl = "";
}

function handleNewSubmissionClick() {
  resetFormForNextContestant();
}

function handleContactNumberInput() {
  dom.contactNumber.value = dom.contactNumber.value.replace(/\D/g, "");
}

function handleEditSubmissionClick() {
  if (latestAmendUrl) {
    window.location.href = latestAmendUrl;
    return;
  }

  if (!contestant || !lookupToken) {
    showTopNotice("請重新查閱得獎者資料後再修改。", "error");
    dom.section6.classList.add("is-hidden");
    if (document.getElementById("section1")) {
      document.getElementById("section1").classList.remove("is-hidden");
      document.getElementById("section1").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  previousSubmissionId = currentSubmissionId;
  dom.section6.classList.add("is-hidden");
  dom.section2.classList.remove("is-hidden");
  dom.section3.classList.remove("is-hidden");
  unlockSection5();
  updateSubmitButtonLabel();
  updatePaymentSection(calculateCartTotal());
  dom.section2.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetFormForNextContestant() {
  lookupToken = "";
  currentSubmissionId = "";
  previousSubmissionId = "";
  latestAmendUrl = "";
  contestant = null;
  cart = {};

  dom.form.reset();
  updateConfirmState();
  clearMessage();
  lockSection2();
  lockSection3();
  lockSection5();
  lockSection6();
  document.getElementById("section1").classList.remove("is-hidden");
  document.getElementById("section1").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleSubmitClick() {
  const errors = [];

  if (!lookupToken) {
    errors.push("請先完成比賽成績查閱。");
  }

  if (!dom.contactNumber.value.trim()) {
    errors.push("請填寫家長/聯絡人 WhatsApp 號碼。");
  } else if (!/^\d+$/.test(dom.contactNumber.value.trim())) {
    errors.push("家長/聯絡人 WhatsApp 號碼只可輸入數字。");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dom.contactEmail.value.trim())) {
    errors.push("請填寫有效的家長/聯絡人電郵地址。");
  }

  const productTotal = calculateCartTotal();
  const stripeSelected = productTotal > 0 && isStripeSelected();
  const manualSelected = productTotal > 0 && isManualPaymentSelected();
  if (productTotal > 0) {
    if (!dom.paymentMethod.value.trim()) {
      errors.push("請選擇付款方式。");
    }

    if (manualSelected && !dom.payeeName.value.trim()) {
      errors.push("請填寫付款帳戶之英文姓名。");
    }

    if (manualSelected && isCloudRunUploadEnabled()) {
      const file = dom.paymentSlip.files && dom.paymentSlip.files[0];
      const fileError = validatePaymentSlipFile(file);
      if (fileError) errors.push(fileError);
    }
  }

  if (!dom.agreeTerms.checked) {
    errors.push("請確認本人明白及同意本表格細則。");
  }

  if (errors.length) {
    showSubmitMessage(errors.join("<br>"), "error");
    return;
  }

  setSubmitLoading(true);

  try {
    const paymentSlipUpload = productTotal > 0 && manualSelected && isCloudRunUploadEnabled()
      ? await uploadPaymentSlip()
      : null;
    const submission = await buildSubmissionPayload(paymentSlipUpload);

    if (stripeSelected) {
      await redirectToStripeCheckout(submission);
      return;
    }

    const result = await apiRequest({ action: "submit", payload: JSON.stringify(submission) }, "aotSubmit");

    if (!result.success) {
      showSubmitMessage(result.message || "提交失敗，請稍後再試。", "error");
      return;
    }

    submission.paymentSlipUpload = result.paymentSlip || paymentSlipUpload || null;
    submission.amendToken = result.amendToken || "";
    showSection6(result.submissionId, submission);
  } catch (error) {
    showSubmitMessage(getSubmitErrorMessage(error), "error");
  } finally {
    setSubmitLoading(false);
  }
}

function validatePaymentSlipFile(file) {
  if (!file) return "請上載轉帳記錄或截圖。";

  if (file.size > MAX_PAYMENT_SLIP_BYTES) {
    return "上載檔案不可超過 10MB。";
  }

  if (file.type && !ALLOWED_PAYMENT_SLIP_TYPES.has(file.type)) {
    return "請上載 PDF、JPG、PNG 或 HEIC 格式的檔案。";
  }

  return "";
}

async function uploadPaymentSlip() {
  const file = dom.paymentSlip.files && dom.paymentSlip.files[0];
  const fileError = validatePaymentSlipFile(file);
  if (fileError) {
    throw new Error(fileError);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("entryNo", contestant?.IND_CODE || dom.entryNo.value.trim() || "unknown-entry");
  formData.append("uploadType", "payment-slip");

  const response = await fetch(`${CLOUD_RUN_UPLOAD_URL.replace(/\/$/, "")}/upload`, {
    method: "POST",
    body: formData,
  });

  const result = await readJsonResponse(response);

  if (!response.ok || !result?.success || !result?.file) {
    const message = result?.message || result?.detail || "付款記錄上載失敗，請稍後再試。";
    throw new Error(message);
  }

  return result.file;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function getSubmitErrorMessage(error) {
  const message = String(error && error.message ? error.message : error);

  if (message === "REQUEST_TOO_LARGE") {
    return "提交失敗：提交資料太大。請稍後再試。";
  }

  if (message === "REQUEST_TIMEOUT") {
    return "提交需時過長，請稍後再試。如有上載檔案，請先壓縮檔案。";
  }

  if (message === "REQUEST_FAILED") {
    return "提交連線失敗。請重新整理頁面後再試。";
  }

  if (/[\u4e00-\u9fff]/.test(message)) {
    return message;
  }

  if (/upload|file|payment|slip/i.test(message)) {
    return "付款記錄上載失敗，請稍後再試。";
  }

  return "提交失敗，請稍後再試。";
}

function setSubmitLoading(isLoading) {
  dom.submitButton.disabled = isLoading;
  dom.submitButton.classList.toggle("is-loading", isLoading);
  dom.submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
  dom.submitButton.textContent = isLoading ? getSubmitLoadingLabel() : getSubmitButtonLabel();
}

function getSubmitButtonLabel() {
  if (calculateCartTotal() > 0 && isStripeSelected()) return "遞交並付款 Submit and Pay";
  return previousSubmissionId ? "重新遞交 Resubmit" : "遞交 Submit";
}

function getSubmitLoadingLabel() {
  if (calculateCartTotal() > 0 && isStripeSelected()) return "前往付款頁...";
  return previousSubmissionId ? "重新遞交中..." : "遞交中...";
}

function updateSubmitButtonLabel() {
  if (!dom.submitButton || dom.submitButton.classList.contains("is-loading")) return;
  dom.submitButton.textContent = getSubmitButtonLabel();
}

async function buildSubmissionPayload(paymentSlipUpload = null) {
  return {
    lookupToken,
    submissionId: currentSubmissionId,
    previousSubmissionId,
    contestant: {
      entryNo: contestant?.IND_CODE || "",
      nameChi: contestant?.NAME_CHI || "",
      nameEn: contestant?.NAME_EN || "",
      yob: contestant?.YOB || "",
      awardChi: contestant?.AWARD_CHI || "",
    },
    contactNumber: dom.contactNumber.value.replace(/\D/g, ""),
    contactEmail: dom.contactEmail.value.trim(),
    enquiryText: dom.enquiryText.value.trim(),
    paymentMethod: dom.paymentMethod.value.trim(),
    payeeName: dom.payeeName.value.trim(),
    totalPayable: calculateTotalPayable(),
    paymentSlipUpload,
    items: getCartItems(),
  };
}

async function redirectToStripeCheckout(submission) {
  saveCheckoutDraft(submission);

  const result = await apiRequest(
    {
      action: "createCheckoutSession",
      payload: JSON.stringify(submission),
      returnUrl: buildCheckoutReturnUrl(),
    },
    "aotStripeCheckout"
  );

  if (!result.success || !result.checkoutUrl) {
    throw new Error(result.message || "未能建立付款連結，請稍後再試。");
  }

  window.location.href = result.checkoutUrl;
}

function getCartItems() {
  return Object.values(cart).flatMap((item) => {
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }).map((item) => {
    const product = productMap[normalizeCode(item.code)] || {};
    return {
      code: normalizeCode(item.code),
      name: getProductDisplayName(item.code),
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(product.price) || 0,
      total: getLineTotal(item),
    };
  });
}

function getProductDisplayName(code) {
  const normalized = normalizeCode(code);

  for (const spec of PRODUCT_SPECS) {
    if (!spec.codes.map(normalizeCode).includes(normalized)) continue;
    const variant = spec.variants?.find((item) => normalizeCode(item.code) === normalized);
    return variant ? `${spec.label} - ${variant.label}` : spec.label;
  }

  return normalized;
}

function showSection6(submissionId, submission) {
  currentSubmissionId = submissionId || currentSubmissionId;
  previousSubmissionId = "";
  latestAmendUrl = buildAmendUrl(submission.amendToken);
  updateSubmitButtonLabel();

  [document.getElementById("section1"), dom.section2, dom.section3, dom.section4, dom.section5].forEach((section) => {
    if (section) section.classList.add("is-hidden");
  });

  dom.section6.classList.remove("is-hidden");
  dom.submissionSummary.innerHTML = renderSubmissionSummary(currentSubmissionId, submission);
  dom.section6.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSubmissionSummary(submissionId, submission) {
  const amendUrl = latestAmendUrl || buildAmendUrl(submission.amendToken);
  const summaryItems = Array.isArray(submission.items) ? submission.items : [];
  const feeItem = Number(submission.stripeHandlingFee || 0) > 0
    ? `
        <div class="summary-item">
          <span>計算手續費後付款總數 Total Amount after surcharge (+4%)</span>
          <strong>${formatMoney(submission.totalPayable)}</strong>
        </div>
      `
    : "";
  const items = summaryItems.length
    ? summaryItems.map((item) => `
        <div class="summary-item">
          <span>${escapeHtml(item.name)}</span>
          <strong>${escapeHtml(item.quantity)} x ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}</strong>
        </div>
      `).join("") + feeItem
    : `<div class="summary-item"><span>加購項目</span><strong>沒有加購項目</strong></div>`;

  return `
    <div class="success-banner">
      <strong>已成功遞交</strong>
      <span>提交編號 Submission ID: ${escapeHtml(submissionId || "")}</span>
    </div>
    <div class="summary-card">
      <h3>提交資料摘要</h3>
      <div class="summary-rows">
        ${renderSummaryRow("得獎者編號", submission.contestant.entryNo)}
        ${renderSummaryRow("參賽者", submission.contestant.nameChi || submission.contestant.nameEn)}
        ${renderSummaryRow("WhatsApp", submission.contactNumber)}
        ${renderSummaryRow("電郵", submission.contactEmail)}
        ${submission.paymentSlipUpload ? renderSummaryRow("付款記錄", submission.paymentSlipUpload.fileName) : ""}
        ${submission.enquiryText ? renderSummaryRow("更正 / 查詢", submission.enquiryText) : ""}
        ${renderSummaryRow("應付總數", formatMoney(submission.totalPayable), true)}
        ${amendUrl ? renderSummaryLinkRow("修改連結", amendUrl) : ""}
      </div>
    </div>
    <div class="summary-card">
      <h3>加購摘要</h3>
      <div class="summary-items">${items}</div>
    </div>
  `;
}

function buildAmendUrl(amendToken) {
  if (!amendToken) return "";

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("amend", amendToken);
  return url.toString();
}

function renderSummaryRow(label, value, isStrong = false) {
  return `
    <div class="summary-row ${isStrong ? "is-strong" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderSummaryLinkRow(label, url) {
  return `
    <div class="summary-row">
      <span>${escapeHtml(label)}</span>
      <strong><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></strong>
    </div>
  `;
}

function showSubmitMessage(message, type) {
  dom.submitMessage.textContent = "";
  dom.submitMessage.className = "message";
  showTopNotice(message, type);
}

function showTopNotice(message, type) {
  dom.topNotice.innerHTML = message;
  dom.topNotice.className = `top-notice is-visible is-${type}`;
  window.clearTimeout(showTopNotice.timeoutId);
  showTopNotice.timeoutId = window.setTimeout(() => {
    dom.topNotice.classList.remove("is-visible");
  }, 7000);
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
