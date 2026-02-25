import type { PlasmoCSConfig } from "plasmo"

import { initBulkDrag } from "~features/bulk-drag"
import { waitForCoreEngine } from "~major-battle/main/dicebot"

import { initCoreEngine } from "../core/main/bridge"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}

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

const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

try {
  if (IS_MAJOR_BATTLE) {
    console.log("Major Battle 다이스봇 로드")
    waitForCoreEngine()
  }
} catch (e) {
  console.error("메이저배틀 다이스봇 로드 실패:", e)
}
