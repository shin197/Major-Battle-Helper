import { ccf } from "~core/isolated/ccfolia-api"
import { handleStatCommand, transformMessage } from "~features/enter-eval"
import { getCurrentCharacterName } from "~features/slot-shortcut"
import { expandDiceVars } from "~major-battle/dice-var-exp"
import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type"
import { getChatInputBox } from "~utils/elements"
import { showToast } from "~utils/isolated/toast"
import { setNativeValue } from "~utils/utils"

import {
  capStatus,
  handleDmgCommand,
  initBattle,
  setUnitCount
} from "./battle-init"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

/** -----------------------------------------------
 * Main Handler: Ctrl + Enter
 * ----------------------------------------------*/
export async function evalChatInputBoxMajorBattle(ev: KeyboardEvent) {
  if (!(ev.ctrlKey && ev.key === "Enter")) return

  const ta = ev.target as HTMLElement
  if (ta != getChatInputBox()) return
  if (!(ta instanceof HTMLTextAreaElement) || !ta.id.startsWith("downshift"))
    return

  const charName = getCurrentCharacterName() || null

  try {
    // 1. 캐릭터 데이터 가져오기
    const character = await ccf.getCharacterByName(charName)

    if (!character) {
      console.warn(`[Major Battle Helper] Character not found: ${charName}`)
    }

    // 2. 주사위 변수 확장 (S, U 등)
    let expandedVal = ta.value
    expandedVal = expandDiceVars(ta.value, {
      nullSPlaceholder: "?",
      nullUnitPlaceholder: "-",
      criticalAsNumber: true
    })

    // 3. 메시지 변환 (Status/Params 치환 + 수식 계산)
    let finalVal = transformMessage(expandedVal, character)

    // 4. /stat 명령어 실행
    if (/^\/(stat|s|ㄴ)(?:\s+|$)/.test(finalVal)) {
      await handleStatCommand(character, finalVal)
      finalVal = ""
    }

    // /dmg, /d, /ㅇ 명령어 감지
    // ^\/(dmg|d|ㅇ) : /dmg, /d, /ㅇ 중 하나로 시작하고
    // (?:\s+|$) : 그 뒤에 반드시 띄어쓰기가 오거나 문장이 끝날 때만 작동
    if (/^\/(dmg|d|ㅇ)(?:\s+|$)/.test(finalVal)) {
      await handleDmgCommand(character, finalVal)
      finalVal = ""
    }
    if (/^\/(unit|u|ㅕ)(?:\s+|$)/.test(finalVal)) {
      await setUnitCount(character, finalVal)
      finalVal = ""
    }
    if (finalVal.startsWith("/battle")) {
      // 전투 초기화 처리
      initBattle()
      finalVal = ""
    }
    if (finalVal.startsWith("/cap")) {
      // 스탯 캐핑 처리
      capStatus(["HP", "MP", "DEF", "AP", "EX", "STK"])
      finalVal = ""
    }

    // 6. 결과 반영
    if (finalVal !== ta.value) {
      setNativeValue(ta, finalVal)
    }
  } catch (err) {
    // console.error("[Major Battle Helper] handleCtrlEnter Error:", err)
  }
}
