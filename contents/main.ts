import type { PlasmoCSConfig } from "plasmo"

import { initBulkDrag } from "~features/bulk-drag"

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

// try { initChatShortcuts() } catch (e) { console.error("채팅 로드 실패:", e) }
