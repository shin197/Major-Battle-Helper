import { getCurrentCharacterName } from "~contents/slot-shortcut"
import { expandDiceVars } from "~major-battle/dice-var-exp"
import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type"
import { getChatInputBox } from "~utils/elements"
import { callCcfolia } from "~contents/ccfolia-api"
import { capStatus, initBattle } from "./battle-init"
import { handleStatCommand, transformMessage, type CcfoliaCharacter } from "~contents/enter-eval"
import { setNativeValue } from "~utils/utils"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}


/** -----------------------------------------------
 * Main Handler: Ctrl + Enter
 * ----------------------------------------------*/
export async function handleCtrlEnter(ev: KeyboardEvent) {
  if (!(ev.ctrlKey && ev.key === "Enter")) return

  const ta = ev.target as HTMLElement
  if (ta != getChatInputBox()) return
  if (!(ta instanceof HTMLTextAreaElement) || !ta.id.startsWith("downshift")) return

  const charName = getCurrentCharacterName() || null

  try {
    // 1. 캐릭터 데이터 가져오기
    const character = await callCcfolia<CcfoliaCharacter>("getChar", charName)

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
    if (character &&finalVal.startsWith("/stat")) {
      await handleStatCommand(character, finalVal)
      finalVal = "" 
    }

    // 5. /battle 명령어 실행
    if (finalVal.startsWith("/battle")) {
      initBattle()
      finalVal = ""
    }
    if (finalVal.startsWith("/cap")) {
      capStatus()
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

/** -----------------------------------------------
 *  3. 한 번만 전역 리스너 등록
 * ----------------------------------------------*/
if(process.env.PLASMO_PUBLIC_ENABLE_MAJOR_BATTLE === 'true'){
  document.addEventListener("keydown", handleCtrlEnter, true)
  console.log("HANDLE CTRL+ENTER REGISTERED MAJOR BATTLE")
}
