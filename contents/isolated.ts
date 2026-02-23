// 💡 features 폴더에서 알맹이를 가져옵니다.
import type { PlasmoCSConfig } from "plasmo"

import { bootstrapUiAnchors } from "~features/anchors"
import { initChatInputBox } from "~features/chat-input-box"
import { initSlotShortcuts } from "~features/slot-shortcut"

import { initCopyFaces } from "../features/copy-faces"
import { evalChatInputBox } from "../features/enter-eval"
import { initChatLogPager } from "../features/log-pager"
import { evalChatInputBoxMajorBattle } from "../major-battle/enter-eval-mb"
import { initToastObserver } from "../utils/isolated/toast"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

// .env 파일의 값을 상수로 가져옴
const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

try {
  ;(async () => {
    await bootstrapUiAnchors()
  })()
} catch (e) {
  console.error("UI 앵커 초기화 실패:", e)
}

try {
  initToastObserver()
} catch (e) {
  console.error("토스트 초기화 실패:", e)
}
try {
  initCopyFaces()
} catch (e) {
  console.error("표정복사 로드 실패:", e)
}
try {
  initSlotShortcuts()
} catch (e) {
  console.error("슬롯 단축키 로드 실패:", e)
}
try {
  initChatInputBox()
} catch (e) {
  console.error("채팅 입력창 초기화 실패:", e)
}
try {
  initChatLogPager()
} catch (e) {
  console.error("채팅 로그 페이저 로드 실패:", e)
}

try {
  if (IS_MAJOR_BATTLE) {
    console.log("Major Battle 수식 기능 활성화")
    document.addEventListener("keydown", evalChatInputBoxMajorBattle, true)
  } else {
    document.addEventListener("keydown", evalChatInputBox, true)
  }
} catch (e) {
  console.error("채팅창 수식 기능 로드 실패:", e)
}
