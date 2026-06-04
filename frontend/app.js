const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg/exec";

const dom = {};
let lookupToken = "";
let contestant = null;

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

  dom.form.addEventListener("submit", handleLookupSubmit);
  [dom.name, dom.yob, dom.entryNo].forEach((input) => {
    input.addEventListener("input", updateConfirmState);
  });

  updateConfirmState();
}

function updateConfirmState() {
  const valid =
    dom.name.value.trim() &&
    /^\d{4}$/.test(dom.yob.value.trim()) &&
    dom.entryNo.value.trim();

  dom.confirmButton.disabled = !valid;
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
  } catch (error) {
    showMessage("系統暫時未能處理查詢，請稍後再試。", "error");
    lockSection2();
  } finally {
    setLoading(false);
  }
}

function jsonpLookup(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `aotLookup_${Date.now()}_${Math.random()
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
  dom.section2.classList.remove("is-locked");
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
  dom.section2.classList.add("is-locked");
  dom.candidatePreview.innerHTML = renderDefinition("狀態", "請先完成 Section 1 查閱。");
}

function renderDefinition(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function setLoading(isLoading) {
  dom.confirmButton.disabled = isLoading || !dom.name.value.trim() || !dom.yob.value.trim() || !dom.entryNo.value.trim();
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

