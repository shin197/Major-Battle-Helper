import type { PlasmoCSConfig } from "plasmo"

import { ccf } from "./ccfolia-api" // (경로는 파일 위치에 맞게 수정)

console.log("API 모듈을 불러왔습니다!", ccf)
export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle"
}

console.info("%cContent script loaded", "color: #4caf50")

// // ① 툴바 뱃지
// chrome.action.setBadgeBackgroundColor({ color: "#4caf50" })
// chrome.action.setBadgeText({ text: "ON" })

// contents/debug-probe.ts
chrome.runtime.sendMessage({
  type: "SET_BADGE",
  text: "ON", // 배지 글자
  bg: "#4caf50" // 배경색 바꾸고 싶다면 옵션으로
})
setTimeout(async () => {
  console.log("테스트 시작: asdf")

  try {
    // const chars = await ccf.getCharacters("all")
    const chars = await ccf.characters.getCharacters("all")
    console.log("Fetched via strongly-typed RPC:", chars)

    // items 관련 함수명이 ccf.tokens.getAll() 로 바뀌셨군요!
    const items = await ccf.getAllTokens()
    console.log("Room Items:", items)
  } catch (error) {
    // 🚨 에러가 발생하면 여기서 정확한 원인을 출력해 줍니다.
    console.error("❌ RPC 호출 중 에러 발생:", error)
  }
}, 5000)
