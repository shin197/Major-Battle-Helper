// 💡 features 폴더에서 알맹이를 가져옵니다.
import type { PlasmoCSConfig } from "plasmo"

import { initCopyFaces } from "~major-battle/copy-faces"
import { initDiceRollEffect } from "~major-battle/dice-roll"
import { loadFeatures, type FeatureDefinition } from "~utils/feature-manager"

import { evalChatInputBoxMajorBattle } from "../enter-eval-mb"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

// .env 파일의 값을 상수로 가져옴
const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

const majorBattleFeatures: FeatureDefinition[] = [
  {
    id: "chat-input",
    name: "채팅 입력창",
    init: () => {
      if (IS_MAJOR_BATTLE) {
        console.log("Major Battle 수식 기능 활성화")
        document.addEventListener("keydown", evalChatInputBoxMajorBattle, true)
      }
    }
  },
  { id: "major-battle", name: "표정 복사", init: initCopyFaces },
  {
    id: "major-battle",
    name: "주사위 롤 텍스트 효과",
    init: initDiceRollEffect
  }
]

// 실행!
loadFeatures(majorBattleFeatures)

// try {

// } catch (e) {
//   console.error("채팅창 수식 기능 로드 실패:", e)
// }
// try {
//   initCopyFaces()
// } catch (e) {
//   console.error("표정복사 로드 실패:", e)
// }
