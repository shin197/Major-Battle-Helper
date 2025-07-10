import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle"
}

console.log("%c[MBH] content script loaded", "color: #4caf50")

// // ① 툴바 뱃지
// chrome.action.setBadgeBackgroundColor({ color: "#4caf50" })
// chrome.action.setBadgeText({ text: "ON" })

// contents/debug-probe.ts
chrome.runtime.sendMessage({
  type: "SET_BADGE",
  text: "ON",          // 배지 글자
  bg: "#4caf50"    // 배경색 바꾸고 싶다면 옵션으로
})
