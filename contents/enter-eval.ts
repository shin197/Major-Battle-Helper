import { getCurrentCharacterName } from "~contents/slot-shortcut"
import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type"
import { getChatInputBox } from "~utils/elements"
import { evaluateMath } from "~utils/eval-math"
import type { CcfoliaCharacter } from "~utils/types"
import { setNativeValue } from "~utils/utils"

import { ccf } from "./ccfolia-api"
import { showToast } from "./toast"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

/** -----------------------------------------------
 * 2. 메시지 변환 로직
 * ----------------------------------------------*/
export function transformMessage(
  msg: string,
  character: CcfoliaCharacter
): string {
  let result = msg

  // 1. 변수 치환 (Status & Params)
  // 예: {HP} -> 10, {STR} -> 5
  // 음수 값이 들어갈 경우 -10 처럼 치환됨
  if (character) {
    character.status.forEach((st) => {
      const valRegex = new RegExp(`\\{${escapeRegExp(st.label)}\\}`, "g")
      result = result.replace(valRegex, String(st.value))

      // 1-2. 최대값 치환 ({HP:max}, {HP.max}, {HP_max})
      // 정규식 설명: 구분자로 ':', '.', '_' 중 하나가 오고 그 뒤에 'max'가 오는 패턴
      const maxRegex = new RegExp(
        `\\{${escapeRegExp(st.label)}[:._]max\\}`,
        "g"
      )
      result = result.replace(maxRegex, String(st.max))
    })
    character.params.forEach((pm) => {
      result = result.replace(
        new RegExp(`\\{${escapeRegExp(pm.label)}\\}`, "g"),
        pm.value
      )
    })
  }

  // 2. 수식 계산
  // "최소 2개의 피연산자"가 있는 수식 패턴을 찾음 (예: 3+5, -10+5, 10/2)
  // 패턴: (숫자|괄호) (공백*연산자공백* (숫자|괄호))+
  // 주의: /stat HP+5 에서 HP를 제외하고 +5만 잡히는 것을 방지하기 위해, 앞부분이 숫자나 괄호여야 함.

  const mathRegex =
    /(?:(?:\-?\(?\d+(?:\.\d+)?\)?)\s*[\+\-\*\/\\%]\s*)+(?:(?:\-?\(?\d+(?:\.\d+)?\)?))/g

  result = result.replace(mathRegex, (match) => {
    // 010-1234 같은 전화번호 형식은 계산하지 않도록 하는 것이 좋겠지만,
    // 현재 요구사항은 "문자열 안의 수식 평가"이므로 계산함.
    // 다만, 단순 음수(-10)는 연산자가 없으므로 위 정규식에 걸리지 않음.
    const calculated = evaluateMath(match)
    return calculated !== null ? calculated : match
  })

  return result
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function handleStatCommand(
  character: CcfoliaCharacter,
  commandLine: string
) {
  const content = commandLine.replace(/^\/stat\s+/, "").trim()

  // 1. 명령어 분리
  const parts = content.split(/[\s,]+/).filter((p) => p.length > 0)
  if (parts.length === 0) return

  const statusUpdates: Record<string, number> = {}
  const paramUpdates: Record<string, string> = {}

  for (const part of parts) {
    // 2. 파싱: 라벨 + 연산자(+, -, =, :) + 값
    // 정규식에 : 추가됨
    const match = part.match(/^(.+?)([\+\-\=\:])(.*)$/)
    if (!match) {
      console.warn(`[BattleHelper] Invalid format: ${part}`)
      continue
    }

    const [, label, operator, valStr] = match

    // --- [기능 추가] 콜론(:) 연산자 처리 ---
    // 조건: 수식 계산 없이 문자열 그대로 Params에 대입. Status는 무시함.
    if (operator === ":") {
      const targetParam = character.params.find((p) => p.label === label)
      if (targetParam) {
        paramUpdates[label] = valStr
      } else {
        // Params에 없으면 경고 (Status에 있어도 무시됨)
        console.warn(
          `[BattleHelper] Param not found for string assignment: ${label}`
        )
      }
      continue // 다음 명령어로 넘어감
    }

    // --- 기존 로직 (+, -, =) ---

    // 수식 계산
    let finalValStr = valStr
    const calculated = evaluateMath(valStr)
    if (calculated) finalValStr = calculated

    const isNumericOp = operator === "+" || operator === "-"
    const numVal = parseInt(finalValStr, 10)

    // A. Status 검색 (숫자형)
    const targetStatus = character.status.find((s) => s.label === label)
    if (targetStatus) {
      if (isNaN(numVal) && isNumericOp) continue

      let currentVal =
        statusUpdates[label] !== undefined
          ? statusUpdates[label]
          : targetStatus.value

      let newValue = currentVal
      if (operator === "=" && !isNaN(numVal)) newValue = numVal
      else if (operator === "+") newValue += numVal
      else if (operator === "-") newValue -= numVal

      statusUpdates[label] = newValue
      continue
    }

    // B. Params 검색 (문자열/숫자 혼용)
    const targetParam = character.params.find((p) => p.label === label)
    if (targetParam) {
      let currentValStr =
        paramUpdates[label] !== undefined
          ? paramUpdates[label]
          : targetParam.value
      let newValue = currentValStr

      if (isNumericOp) {
        // 숫자 연산 (+, -)
        const currentInt = parseInt(currentValStr, 10)
        if (!isNaN(currentInt) && !isNaN(numVal)) {
          if (operator === "+") newValue = String(currentInt + numVal)
          else if (operator === "-") newValue = String(currentInt - numVal)
        } else {
          console.warn(`[BattleHelper] Non-numeric param math: ${part}`)
          continue
        }
      } else if (operator === "=") {
        // 단순 대입 (=)
        newValue = finalValStr
      }

      paramUpdates[label] = newValue
      continue
    }
  }

  // 3. API 호출
  const hasStatusUpdates = Object.keys(statusUpdates).length > 0
  const hasParamUpdates = Object.keys(paramUpdates).length > 0

  if (hasStatusUpdates || hasParamUpdates) {
    try {
      await ccf.patchCharacter(character.name, {
        status: hasStatusUpdates ? statusUpdates : undefined,
        params: hasParamUpdates ? paramUpdates : undefined
      })
      showToast(`✅ 캐릭터: ${character.name} 의 업데이트가 완료되었습니다.`)
      // console.info(`[BattleHelper] Batch Update applied for ${character.name}`, { statusUpdates, paramUpdates })
    } catch (e) {
      showToast("❌ 캐릭터 업데이트에 실패했습니다.")
    }
  }
}

/** -----------------------------------------------
 * Main Handler: Ctrl + Enter
 * ----------------------------------------------*/
export async function handleCtrlEnter(ev: KeyboardEvent) {
  if (!(ev.ctrlKey && ev.key === "Enter")) return

  const ta = ev.target as HTMLElement
  if (ta != getChatInputBox()) return
  if (!(ta instanceof HTMLTextAreaElement) || !ta.id.startsWith("downshift"))
    return

  const charName = getCurrentCharacterName() || null

  try {
    // 1. 캐릭터 데이터 가져오기
    const character = await ccf.getCharacterByName(charName)
    // callCcfolia<CcfoliaCharacter>("getChar", charName)

    if (!character) {
      showToast(`❗ 캐릭터: ${charName} 를 찾을 수 없습니다.`)
      // console.warn(`[Major Battle Helper] Character not found: ${charName}`)
    }

    // 3. 메시지 변환 (Status/Params 치환 + 수식 계산)
    let finalVal = transformMessage(ta.value, character)

    // 4. /stat 명령어 실행
    if (character && finalVal.startsWith("/stat")) {
      await handleStatCommand(character, finalVal)
      finalVal = ""
    }

    // 6. 결과 반영
    if (finalVal !== ta.value) {
      setNativeValue(ta, finalVal)
    }
  } catch (err) {}
}

/** -----------------------------------------------
 *  3. 한 번만 전역 리스너 등록
 * ----------------------------------------------*/
if (process.env.PLASMO_PUBLIC_ENABLE_MAJOR_BATTLE === "false") {
  document.addEventListener("keydown", handleCtrlEnter, true)
}
