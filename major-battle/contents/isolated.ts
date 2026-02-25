// 💡 features 폴더에서 알맹이를 가져옵니다.
import type { PlasmoCSConfig } from "plasmo"

import { evalChatInputBoxMajorBattle } from "../enter-eval-mb"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

// .env 파일의 값을 상수로 가져옴
const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

try {
  if (IS_MAJOR_BATTLE) {
    console.log("Major Battle 수식 기능 활성화")
    document.addEventListener("keydown", evalChatInputBoxMajorBattle, true)
  }
} catch (e) {
  console.error("채팅창 수식 기능 로드 실패:", e)
}
