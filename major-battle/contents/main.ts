import type { PlasmoCSConfig } from "plasmo"

import { waitForCoreEngine } from "~major-battle/main/dicebot"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
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
