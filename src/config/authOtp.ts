/**
 * 全站「電郵驗證碼 OTP」總開關（登入後驗證、註冊前驗證、忘記密碼內嵌 OTP）。
 *
 * - `false`（目前）：略過上述 OTP；忘記密碼改為 Firebase 重設連結電郵。
 * - 要恢復 OTP：改為 `true` 並重新建置／啟動 App。
 */
export const AUTH_EMAIL_OTP_ENABLED = false;
