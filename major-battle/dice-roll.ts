import { waitFor } from "../utils/wait-for"
import type { DiceResult } from "./dice-result"
import { setLastDiceResult } from "./dice-result"

const CHAT_LOG_SEL = "#root div.MuiDrawer-docked > div > ul > div > div"
const TAB_BAR = "div.MuiTabs-scroller.MuiTabs-hideScrollbar"
const MAIN_TAB_ID = "main" // 첫 번째 탭의 id(또는 data-value)가 ‘main’

let logObs: MutationObserver | null = null

function handleLine(el: HTMLElement, currentBox: HTMLElement) {
  // if (!isMainTabActive()) return
  if (!currentBox.contains(el)) return

  // 이미 색상이 입혀진 줄은 무한루프 방지를 위해 패스
  if (el.dataset.helper === "dice-marked") return

  const pTag = el.querySelector("p")
  if (!pTag) return

  const diceSpans = pTag.querySelectorAll("span")
  if (diceSpans.length === 0) return

  // 우리가 변경한 시그니처(🎲S=)가 포함된 span을 역순으로 찾습니다.
  let targetSpan: HTMLSpanElement | null = null
  for (let i = diceSpans.length - 1; i >= 0; i--) {
    if (diceSpans[i].textContent?.includes("🎲S=")) {
      targetSpan = diceSpans[i]
      break
    }
  }

  if (!targetSpan) return

  const originalHtml = targetSpan.innerHTML
  const lines = originalHtml.split("\n")

  const coloredLines = lines.map((line) => {
    // 주사위 결과가 없는 줄은 원본 그대로 둡니다.
    if (!line.includes("🎲S=")) return line

    // 💡 판정 결과에 따른 색상 및 이펙트 설정
    let mainColor = "#fff" // 기본값: 실패 (회색)
    let isGlow = false
    let isBold = false

    // 주의: '대성공', '강성공' 등 긴 단어를 먼저 체크해야 일반 '성공' 글자에 덮어씌워지지 않습니다.
    if (line.includes("대성공")) {
      mainColor = "#f1de0d" // 노란색 (강성공 + 보너스)
      isGlow = true
      isBold = true
    } else if (line.includes("강성공")) {
      mainColor = "rgba(177, 35, 243, 1)" // 보라색
      isGlow = false
      isBold = true
    } else if (line.includes("성공+")) {
      mainColor = "#29b6f6" // 파란색 (일반 성공 + 보너스)
    } else if (line.includes("대실패")) {
      mainColor = "#f44336" // 빨간색
      isGlow = false
      isBold = true
    } else if (line.includes("성공")) {
      mainColor = "#fff" // 흰색 (보너스 없는 일반 성공)
    } else if (line.includes("실패")) {
      mainColor = "#9e9e9e" // 회색 (실패)
    }

    let glowStyle = isGlow ? `text-shadow: 0 0 5px ${mainColor};` : ""
    if (line.includes("대실패")) {
      glowStyle = `text-shadow: 0 0 5px #000000;`
    }
    const weightStyle = isBold ? `font-weight: bold;` : ""

    // 💡 변경점: 이전처럼 접두사(prefix)를 자르지 않고, 줄(line) 전체를 통째로 span으로 감쌉니다!
    let styledLine = `<span style="color: ${mainColor}; ${glowStyle} ${weightStyle}">${line}</span>`

    styledLine = styledLine.replace(
      /(\u{0023}\u{FE0F}\u{20E3}\d+)/gu,
      '<span style="color: #29b6f6;">$1</span>'
    )
    // (선택) 폭발 이모지(💥1)가 있다면 그 부분만 더 강렬한 붉은색으로 강조합니다.
    styledLine = styledLine.replace(
      /(\u{1F4A5}\d+)/gu,
      '<span style="color: rgba(177, 35, 243, 1); text-shadow: 0 0 4px purple;">$1</span>'
    )

    return styledLine
  })

  targetSpan.innerHTML = coloredLines.join("\n")
  el.dataset.helper = "dice-marked"
}

;(async () => {
  /* ------------- 여기부터 async/await 마음껏 사용 -------------- */

  const TAB_LIST_SEL =
    "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > \
     header div.MuiTabs-scroller.MuiTabs-hideScrollbar.MuiTabs-scrollableX"

  // ❶ 탭 리스트 div가 화면에 나타날 때까지 기다림
  const tabList = await waitFor(TAB_LIST_SEL)

  // ❷ 현재 선택된 탭 버튼 얻기
  let activeBtn = await getActiveBtn(tabList)

  // ❸ 처음에 연결: 채팅 로그 박스 찾고 옵저버 달기
  attachLogObserver(activeBtn)

  // ❹ 이후 탭 전환 감시
  new MutationObserver(() => {
    const btn = tabList.querySelector<HTMLButtonElement>(
      "button[aria-selected='true']"
    )
    if (btn && btn !== activeBtn) {
      activeBtn = btn
      attachLogObserver(activeBtn)
    }
  }).observe(tabList, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected"]
  })

  /* -------------------- 함수 정의 -------------------- */
})()

async function getActiveBtn(root: HTMLElement) {
  // 이미 선택된 것이 있으면 바로 반환
  const now = root.querySelector<HTMLButtonElement>(
    "button[aria-selected='true']"
  )
  if (now) return now

  // 없으면 selected 속성이 붙을 때까지 대기
  return new Promise<HTMLButtonElement>((res) => {
    const obs = new MutationObserver(() => {
      const btn = root.querySelector<HTMLButtonElement>(
        "button[aria-selected='true']"
      )
      if (btn) {
        obs.disconnect()
        res(btn)
      }
    })
    obs.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected"]
    })
  })
}

function attachLogObserver(tabBtn: HTMLButtonElement) {
  const logBox = document.querySelector<HTMLElement>(CHAT_LOG_SEL)
  if (!logBox) return console.warn("logBox not found")

  logObs?.disconnect()

  /* 3) 화면에 이미 있는 <li>/<div> 들 먼저 처리 */
  logBox
    .querySelectorAll(":scope > *")
    .forEach((n) => handleLine(n as HTMLElement, logBox))

  /* 4) 이후 들어올 노드 및 텍스트 변경 감시 */
  logObs = new MutationObserver((records) => {
    records.forEach((r) => {
      // 경우 1: 아예 새로운 채팅 노드가 화면에 추가되었을 때
      r.addedNodes.forEach((n) => {
        if (n.nodeType === 1) handleLine(n as HTMLElement, logBox)
      })

      // 경우 2: 기존 노드 내부의 텍스트(주사위 결과)가 Redux 동기화로 인해 뒤늦게 바뀌었을 때
      if (r.type === "characterData" || r.type === "childList") {
        let curr = r.target as HTMLElement | Node | null

        // 변경이 일어난 곳에서 위로 타고 올라가 최상위 채팅 메시지 박스를 찾음
        while (curr && curr !== logBox) {
          if ((curr as HTMLElement).parentElement === logBox) {
            handleLine(curr as HTMLElement, logBox)
            break
          }
          curr = curr.parentNode
        }
      }
    })
  })

  // 💡 핵심 변경점: subtree와 characterData를 true로 켜서 내부 텍스트 변화까지 샅샅이 감시합니다.
  logObs.observe(logBox, {
    childList: true,
    subtree: true,
    characterData: true
  })
}

export async function applyMajorBattleDiceResult(msgId: string, msg: any) {
  if (process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "false") {
    return // 기능이 꺼져있으면 아무것도 하지 않음
  }

  // 1. 코코포리아 원본 데이터 추출
  const originalFormula = msg.text || ""
  const originalResult = msg.extend?.roll?.result || ""

  const lines = originalResult.split("\n")

  let hasModifications = false

  // 다중 굴림일 경우 전체 상태를 추적하기 위한 플래그들
  let overallSuccess = false
  let overallFailure = false
  let overallCritical = false
  let overallFumble = false

  // 해당 줄이 주사위 판정 결과 줄인지 확인하는 정규식 (예: "(2B6) ＞ 1,2")
  const DICE_LINE_REGEX = /\(\d+\s*B\s*\d+\)\s*[＞>]\s*[\d,\s]+?\s*$/u

  // 💡 2. 각 줄(line)을 순회하며 변환합니다.
  const newLines = lines.map((line) => {
    // 주사위 판정 줄이 아니면 (예: "#1", 빈 줄 등) 원본 그대로 반환
    if (!DICE_LINE_REGEX.test(line)) {
      return line
    }

    // calcSuccess가 옵션(msg.text)과 주사위 결과(line)를 모두 읽을 수 있게 임시로 합침
    const rawLine = `${originalFormula} ${line}`
    const diceResult = calcSuccess(rawLine)

    if (diceResult.S === null) return line // 파싱 실패 시 원본 유지

    hasModifications = true

    // 뱃지 텍스트 조합
    let successText = ""
    if (diceResult.crit === -1) successText = "대실패"
    else if (diceResult.crit === 0) successText = "실패"
    else if (diceResult.crit === 1) {
      // 일반 성공일 때 보너스가 터졌는지 검사
      successText = diceResult.bonusHit ? "성공+" : "성공"
    } else if (diceResult.crit === 2) successText = "강성공"
    else if (diceResult.crit >= 3) successText = "대성공"

    let customBadge = `\u{1F3B2}S=${diceResult.S}`
    if (diceResult.unitCount != null) {
      customBadge += ` #️⃣${diceResult.unitCount}`
      if (diceResult.critCount) {
        customBadge += ` \u{1F4A5}${diceResult.critCount}` // 💥 폭발 이모지
      }
    }
    if (diceResult.unitCount == null) {
      customBadge += ` ${successText}`
    }

    // 전체 상태 플래그 갱신 (하나라도 해당되면 true)
    if (diceResult.crit >= 1) overallSuccess = true
    if (diceResult.crit === 0) overallFailure = true
    if (diceResult.crit >= 2) overallCritical = true
    if (diceResult.crit === -1) overallFumble = true

    // 💡 3. 주사위 결과 줄 끝에 뱃지를 붙여서 반환
    return `${line} ＞ ${customBadge}`
  })

  // 바뀐 곳이 없으면(주사위 굴림이 아니면) API 호출 생략
  if (!hasModifications) return

  // 💡 4. 변환된 줄들을 다시 줄바꿈(\n)으로 합칩니다.
  const newText = "\n" + newLines.join("\n")

  const options = {
    success: true,
    failure: false,
    critical: true,
    fumble: false
  }

  await window.ccfoliaAPI.messages.modifyRollResult(
    msgId,
    newText,
    options as any
  )
}

function calcSuccess(rawLine: string): DiceResult {
  try {
    const HEAD_REGEX =
      /(?<cnt>\(?[0-9+\-*/()\s]+\)?)\s*B\s*(?<size>\(?[0-9+\-*/()\s]+\)?)[^(【]*(?:\((?<opts>[^)]*)\))?/u

    const head = HEAD_REGEX.exec(rawLine)
    if (!head?.groups) return { S: null, crit: 0 }

    const tySize = evalArithmetic(head.groups.size)

    const rawOpts = head.groups.opts ?? ""

    const tokens = rawOpts // 「+2, !, neg, 특수」 등
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => t.trim())

    const plus = Number(tokens.find((t) => /^[+-]?\d+$/.test(t)) ?? 0)

    const flags = tokens.filter((t) => !/^\+?\d+$/.test(t))

    const dicePart = rawLine.match(/[＞>]\s*([\d,\s]+)\s*$/u)?.[1] ?? ""

    if (!dicePart) return { S: null, crit: 0 }
    const dice = dicePart.split(",").map((d) => Number(d.trim()))

    const hasBang = flags.some((f) => f === "!")
    const groupified = flags.some((f) => f.startsWith("#"))
    const count = Number(
      (flags.find((f) => /^#\d+$/.test(f)) ?? "#1").replace("#", "")
    )
    const hasDC = flags.some((f) => f.startsWith("DC="))
    const DC = Number((flags.find((f) => /^DC=\d+$/.test(f)) ?? "1").slice(3))
    const level = Number(
      (flags.find((f) => /^Lv[-]?\d+$/.test(f)) ?? "1").slice(2)
    )

    let S = 0

    let unitCount = count
    let crit = 0
    let passDC = true
    let critCount = 0
    let anyBonusHit = false

    for (var i = 0; i < count; i++) {
      const primaryDie = dice[i] ?? 0
      const secondaryDie = dice[count] ?? 0
      const exDiceCount = dice.length - count - 1
      crit = 0
      let exS = 0
      let exFail = false
      let bonusHit = false
      for (let j = 0; j < exDiceCount; j++) {
        const num = dice[count + 1 + j]
        if (num === 1 || secondaryDie == 1) {
          exFail = true
        } else {
          exS += num
          if (num === tySize) {
            S += plus
            bonusHit = true
          }
        }
      }
      if (primaryDie == 1 || exFail) {
        unitCount--
        // S = 0
        if (primaryDie === 1 && secondaryDie === 1) {
          crit = -1
        }
        continue
      } else if (primaryDie < tySize - level && !hasBang) {
        S += secondaryDie + exS
        crit = 1
      } else {
        S += primaryDie + secondaryDie + exS
        crit = 2
        critCount += 1
      }
      if (secondaryDie === tySize) {
        S += plus
        bonusHit = true
      }
      if (bonusHit) anyBonusHit = true
      if (hasDC && S < DC) {
        passDC = false
        crit = 0
      }
      if (crit === 2 && bonusHit) {
        crit = 3
      }
    }

    if (groupified) {
      if (S === 0) {
        crit = 0
      } else {
        crit = 1
      }
    }
    const diceResult = {
      S,
      crit,
      ...(groupified ? { unitCount } : {}),
      ...(hasDC ? { passDC } : {}),
      ...(critCount > 0 ? { critCount } : {}),
      bonusHit: anyBonusHit
    }
    setLastDiceResult(diceResult)
    return diceResult
  } catch {
    return { S: null, crit: 0 }
  }
}

function isMainTabActive(): boolean {
  const activeBtn = document.querySelector(
    `${TAB_BAR} button[aria-selected="true"]`
  ) as HTMLElement | null

  return (
    !!activeBtn &&
    (activeBtn.id === MAIN_TAB_ID || activeBtn.dataset.value === MAIN_TAB_ID)
  )
}

waitFor(TAB_BAR).then((tabBar) => {
  const update = () => {
    const show = isMainTabActive()
    document
      .querySelectorAll<HTMLElement>(".dice-result")
      .forEach((b) => (b.style.display = show ? "inline" : "none"))
  }

  // 처음 한 번
  update()

  // aria-selected 변화를 감시
  new MutationObserver(update).observe(tabBar, {
    attributes: true,
    subtree: true,
    attributeFilter: ["aria-selected"]
  })
})

function getOwnText(p: HTMLElement): string {
  return Array.from(p.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE) // <span> 제외
    .map((n) => n.textContent ?? "")
    .join("")
    .trim()
}

export function evalArithmetic(exprRaw: string): number {
  if (!exprRaw) throw new Error("empty expression")
  const s = exprRaw.replace(/\s+/g, "")
  if (!/^[\d.+\-*/()]*$/.test(s)) {
    throw new Error(`Invalid characters in expression: ${exprRaw}`)
  }

  let i = 0

  function peek(): string {
    return s[i] ?? ""
  }
  function eat(ch?: string): string {
    const c = s[i] ?? ""
    if (ch && c !== ch) throw new Error(`Expected '${ch}' at ${i}, got '${c}'`)
    i++
    return c
  }

  function parseNumber(): number {
    const start = i
    // match: digits[.digits] or .digits
    if (peek() === ".") {
      i++
      while (/\d/.test(peek())) i++
    } else {
      while (/\d/.test(peek())) i++
      if (peek() === ".") {
        i++
        while (/\d/.test(peek())) i++
      }
    }
    const numStr = s.slice(start, i)
    if (!numStr) throw new Error(`Number expected at ${start}`)
    const val = Number(numStr)
    if (!Number.isFinite(val)) throw new Error(`Invalid number '${numStr}'`)
    return val
  }

  // factor := ('+'|'-') factor | number | '(' expr ')'
  function factor(): number {
    const c = peek()
    if (c === "+" || c === "-") {
      // unary
      eat()
      const v = factor()
      return c === "-" ? -v : v
    }
    if (c === "(") {
      eat("(")
      const v = expr()
      if (peek() !== ")") throw new Error(`Missing ')' at ${i}`)
      eat(")")
      return v
    }
    return parseNumber()
  }

  // term := factor (('*'|'/') factor)*
  function term(): number {
    let v = factor()
    while (peek() === "*" || peek() === "/") {
      const op = eat()
      const r = factor()
      if (op === "/") {
        if (r === 0) throw new Error("Division by zero")
        v = v / r
      } else {
        v = v * r
      }
    }
    return v
  }

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let v = term()
    while (peek() === "+" || peek() === "-") {
      const op = eat()
      const r = term()
      v = op === "+" ? v + r : v - r
    }
    return v
  }

  const out = expr()
  if (i !== s.length) throw new Error(`Unexpected token '${peek()}' at ${i}`)
  if (!Number.isFinite(out)) throw new Error("Non-finite result")
  return out
}
