import type { PlasmoCSConfig } from "plasmo"

import { initBulkDrag } from "~features/bulk-drag"
import { waitForCoreEngine } from "~major-battle/main/dicebot"

import { initCoreEngine } from "../core/main/bridge"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}
const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

// 🚀 분리된 코어 엔진 실행!
try {
  initCoreEngine()
} catch (e) {
  console.error("코어 엔진 로드 실패:", e)
}
try {
  initBulkDrag()
} catch (e) {
  console.error("드래그 로드 실패:", e)
}

try {
  if (IS_MAJOR_BATTLE) {
    console.log("Major Battle 다이스봇 로드")
    waitForCoreEngine()
  }
} catch (e) {
  console.error("채팅창 수식 기능 로드 실패:", e)
}

// try { initChatShortcuts() } catch (e) { console.error("채팅 로드 실패:", e) }
