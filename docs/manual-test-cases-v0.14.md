# 手動測試案例 v0.14

本文件對應 `/Users/hkycaa/Downloads/Add-On Trial Planning_v0.14.xlsx` 的 `Test Cases v0.14` 分頁。測試案例以繁體中文撰寫，供 SIT/UAT 人手測試使用。

## 測試範圍

- 查詢及身份驗證
- 得獎者資料核對
- 加購項目及金額計算
- 手動付款及付款截圖上載
- Stripe Checkout、Alipay、WeChat Pay、Google Pay eligibility
- Section 6 成功頁、PDF、修改連結
- Cloud Run / Stripe webhook / sandbox-live 模式檢查

## 測試案例

| 測試編號 | 範圍 | 手動測試情境 | 重點預期結果 | 優先級 |
|---|---|---|---|---|
| TC-001 | 系統設定 | 載入 WEBAPP_CONFIG 的比賽名稱、標題、簡介及相片。 | 首頁顯示設定值；空白或 NA 相片不顯示。 | 高 |
| TC-002 | 查詢 | 正確得獎者資料可成功查詢。 | 解鎖 Section 2、3、5；查詢階段不寫 RAW_ADD。 | 高 |
| TC-003 | 查詢 | 漏填或出生年份格式錯誤不可查詢。 | 顯示驗證訊息；後續區段不解鎖。 | 高 |
| TC-004 | 查詢 | 得獎者編號錯誤及身份不符。 | 分別顯示得獎者編號錯誤及身份不符訊息。 | 高 |
| TC-005 | 核對資料 | 聯絡電話只可輸入數字，電郵需有效。 | 提交被阻止；RAW_ADD 無新增行。 | 高 |
| TC-006 | 加購 | 數量型產品金額計算。 | 單項及應付總數 = 數量 x PRODUCT LIST 價格。 | 高 |
| TC-007 | 加購 | 多款變體可同時選購並正確加總。 | 購物車列出所有變體；RAW_ADD 對應欄位正確。 | 高 |
| TC-008 | 加購 | OFF / GREY OUT 狀態顯示。 | OFF 不可選；GREY OUT 停用；顯示不可加購提示。 | 中 |
| TC-009 | 無加購提交 | 沒有選購產品仍可提交更正/查詢資料。 | Section 4 不需要；PAYMENT_PROVIDER=NONE。 | 高 |
| TC-010 | 付款方法 | 未選付款方法時手動付款欄位保持隱藏。 | 付款人英文名及付款截圖不顯示；提交要求付款方法。 | 高 |
| TC-011 | 手動付款 | PayMe / AlipayHK 港版需要付款人英文名及付款截圖。 | 缺漏被阻止；補齊後寫入 RAW_ADD 及 Drive metadata。 | 高 |
| TC-012 | 手動付款 | FPS 及 HSBC 轉帳沿用手動付款規則。 | 付款方法、付款人英文名、付款截圖均正確寫入。 | 高 |
| TC-013 | 手動付款 | 不支援或過大付款截圖檔案。 | 上載或提交被阻止；不寫不完整 RAW_ADD。 | 中 |
| TC-014 | Stripe | 選擇信用卡/內地錢包後隱藏手動付款欄位。 | 按鈕變為 `遞交並付款 Submit and Pay`；未付款不寫 RAW_ADD。 | 高 |
| TC-015 | Stripe | Stripe 金額及手續費正確。 | Checkout 總額 = 產品總額 + `手續費 Surcharge (+4%)`。 | 高 |
| TC-016 | Stripe | Stripe 項目名稱包含比賽名稱且不重複描述。 | 項目名稱為 `產品名稱 - 比賽名稱`；沒有重複灰色描述。 | 高 |
| TC-017 | Stripe | Checkout 使用付款方法設定及停用 Adaptive Pricing。 | 使用 Stripe Payment Method Configuration；不顯示 SGD/HKD 貨幣切換。 | 高 |
| TC-018 | Stripe | Alipay 內地版 / WeChat Pay 內地版顯示條件。 | 符合 Stripe eligibility 時顯示；否則記錄 Dashboard/地區/貨幣條件。 | 中 |
| TC-019 | Stripe | Google Pay 顯示條件。 | Chrome、Google Pay 卡、domain 及 Stripe eligibility 均符合時才顯示。 | 中 |
| TC-020 | Stripe | 成功付款寫入 RAW_ADD。 | Section 6 顯示；PAYMENT_PROVIDER=STRIPE；PAYMENT_STATUS=PAID。 | 高 |
| TC-021 | Stripe | 付款失敗或取消不寫 RAW_ADD 並可還原草稿。 | 返回表格後還原資料，可重新付款。 | 高 |
| TC-022 | Stripe | 3D Secure 成功及失敗路徑。 | 完成驗證才寫入 RAW_ADD；未完成不寫入。 | 中 |
| TC-023 | Webhook | Webhook 重試不可造成重複提交。 | 重送同一 event 不產生重複營運記錄。 | 中 |
| TC-024 | Section 6 | 成功頁綠色橫幅格式。 | 只保留綠色橫幅，Submission ID 粗體。 | 高 |
| TC-025 | Section 6 | 下載付款摘要 PDF。 | 開啟瀏覽器列印/儲存 PDF，內容以摘要為主。 | 中 |
| TC-026 | Section 6 | 查詢另一位得獎者重設流程。 | 返回 Section 1，清除上一位資料及購物車。 | 中 |
| TC-027 | 修改 | 修改剛才提交之資料導向修改連結。 | 導向 `?amend=` 簽名連結並還原表格。 | 高 |
| TC-028 | 修改 | 重新遞交覆寫同一 Submission ID。 | 同一 RAW_ADD 行更新；Submission Timestamp 保留。 | 高 |
| TC-029 | 安全 | 無效 lookupToken / amend token 不可提交或修改。 | 後端拒絕；顯示無效連結或驗證錯誤。 | 高 |
| TC-030 | 營運 | Cloud Run health 及 Stripe 設定檢查。 | `/health` 顯示 stripeConfigured=true；webhook event 成功。 | 高 |
| TC-031 | 模式 | Sandbox / Live 不可混用。 | sk_test 只配 sandbox；live mode 不可用測試卡。 | 高 |
| TC-032 | 響應式 | 桌面及手機版不重疊。 | 查詢、加購、付款、Section 6 在不同寬度均可用。 | 中 |

## Google Pay 補充

Google Pay 不是獨立的 Stripe Checkout `payment_method_type`；它是 card payment 之下的 wallet。即使 Stripe Dashboard 已啟用，仍需要 Chrome、Google 帳戶或 Chrome profile 有可用 Google Pay 卡、HTTPS、domain/Stripe eligibility 等條件同時成立才會顯示。
