import { getCurrentCharacterName } from "~contents/slot-shortcut"
import { expandDiceVars } from "~major-battle/dice-var-exp"
import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type"
import { getChatInputBox } from "~utils/elements"
import { callCcfolia } from "~contents/ccfolia-api"
import { capStatus, initBattle } from "./battle-init"
import { evaluateMath } from "~utils/eval-math"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

// --- 타입 정의 ---
interface CcfoliaStatus {
  label: string
  value: number
  max: number
}

interface CcfoliaParam {
  label: string
  value: string
}

interface CcfoliaCharacter {
  _id: string
  name: string
  status: CcfoliaStatus[]
  params: CcfoliaParam[]
  active: boolean
  secret: boolean
  invisible: boolean
  [key: string]: any
}

/** -----------------------------------------------
 * 0. 도우미: React-controlled textarea에 값 주입
 * ----------------------------------------------*/
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el) as HTMLTextAreaElement
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

/** -----------------------------------------------
 * 2. 메시지 변환 로직
 * ----------------------------------------------*/
function transformMessage(msg: string, character: CcfoliaCharacter): string {
  let result = msg

  // 1. 변수 치환 (Status & Params)
  // 예: {HP} -> 10, {STR} -> 5
  // 음수 값이 들어갈 경우 -10 처럼 치환됨
  if(character){
    character.status.forEach((st) => {
      const valRegex = new RegExp(`\\{${escapeRegExp(st.label)}\\}`, "g")
      result = result.replace(valRegex, String(st.value))

      // 1-2. 최대값 치환 ({HP:max}, {HP.max}, {HP_max})
      // 정규식 설명: 구분자로 ':', '.', '_' 중 하나가 오고 그 뒤에 'max'가 오는 패턴
      const maxRegex = new RegExp(`\\{${escapeRegExp(st.label)}[:._]max\\}`, "g")
      result = result.replace(maxRegex, String(st.max))
    })
    character.params.forEach((pm) => {
      result = result.replace(new RegExp(`\\{${escapeRegExp(pm.label)}\\}`, "g"), pm.value)
    })
  }

  // 2. 수식 계산
  // "최소 2개의 피연산자"가 있는 수식 패턴을 찾음 (예: 3+5, -10+5, 10/2)
  // 패턴: (숫자|괄호) (공백*연산자공백* (숫자|괄호))+
  // 주의: /stat HP+5 에서 HP를 제외하고 +5만 잡히는 것을 방지하기 위해, 앞부분이 숫자나 괄호여야 함.
  
  const mathRegex = /(?:(?:\-?\(?\d+(?:\.\d+)?\)?)\s*[\+\-\*\/\\%]\s*)+(?:(?:\-?\(?\d+(?:\.\d+)?\)?))/g
  
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

/** -----------------------------------------------
 * 3. /stat 명령어 처리 (Status 및 Params 업데이트)
 * ----------------------------------------------*/
async function handleStatCommand(character: CcfoliaCharacter, commandLine: string) {
  const content = commandLine.replace(/^\/stat\s+/, "").trim()
  
  // 파싱: 라벨 + 연산자(=,+,-) + 값
  const match = content.match(/^(.+?)([\+\-\=])(.*)$/)
  if (!match) return

  const [, label, operator, valStr] = match
  
  // 값 부분에 수식이 남아있다면 추가 계산 (예: /stat HP+3+5 -> 3+5 계산)
  let finalValStr = valStr
  const calculated = evaluateMath(valStr)
  if (calculated) finalValStr = calculated

  const isNumericOp = operator === "+" || operator === "-"
  const numVal = parseInt(finalValStr, 10)

  // A. Status 검색
  const targetStatus = character.status.find(s => s.label === label)
  if (targetStatus) {
    if (isNaN(numVal) && isNumericOp) return 

    let newValue = targetStatus.value
    if (operator === "=" && !isNaN(numVal)) newValue = numVal
    else if (operator === "+") newValue += numVal
    else if (operator === "-") newValue -= numVal
    
    await callCcfolia("setStatus", character.name, label, newValue)
    console.info(`[Major Battle Helper] Status Updated: ${label} -> ${newValue}`)
    return
  }

  // B. Params 검색
  const targetParam = character.params.find(p => p.label === label)
  if (targetParam) {
    let newValue = targetParam.value // string

    if (isNumericOp) {
      const currentInt = parseInt(newValue, 10)
      if (!isNaN(currentInt) && !isNaN(numVal)) {
        if (operator === "+") newValue = String(currentInt + numVal)
        else if (operator === "-") newValue = String(currentInt - numVal)
      } else {
        console.warn(`[Major Battle Helper] Cannot do math on non-numeric param: ${newValue}`)
        return
      }
    } else if (operator === "=") {
      newValue = finalValStr
    }

    await callCcfolia("setParam", character.name, label, newValue)
    console.info(`[Major Battle Helper] Param Updated: ${label} -> ${newValue}`)
    return
  }
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
