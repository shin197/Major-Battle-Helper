import { waitFor } from "../utils/wait-for"
import type { DiceResult } from "./dice-result"
import { setLastDiceResult } from "./dice-result"

const TAB_SCROLLER =
  "#root div.MuiDrawer-docked form header div.MuiTabs-scroller"
const TAB_BTN_SEL = `${TAB_SCROLLER} > div > button[role='tab']`
const CHAT_LOG_SEL = "#root div.MuiDrawer-docked > div > ul > div > div"
const TAB_BAR = "div.MuiTabs-scroller.MuiTabs-hideScrollbar"
const MAIN_TAB_ID = "main" // 첫 번째 탭의 id(또는 data-value)가 ‘main’

let logObs: MutationObserver | null = null

const DICE_LINE_REGEX = /\(\d+\s*B\s*\d+\)\s*[＞>]\s*[\d,\s]+?\s*$/u
// [＞>]\s*(?:\[\d+\]×\d+(?:,\s*)?)+\s*

function handleLine(el: HTMLElement, currentBox: HTMLElement) {
  if (!isMainTabActive()) return
  if (!currentBox.contains(el)) return // 다른 탭으로 옮겨진 줄 skip
  if (el.dataset.helper === "dice-marked") return

  const diceNode = el.querySelector(
    "p > span.MuiTypography-root.MuiTypography-body2"
  )

  if (!diceNode) return

  const text = getOwnText(
    el.querySelector("p > span.MuiTypography-root.MuiTypography-body2")
  )

  // console.log(text)

  // ③ 주사위 판정인지 검사
  if (!DICE_LINE_REGEX.test(text)) return

  // const text2 = el.textContent ?? ""
  const text2 = getOwnText(el.querySelector("p")) + text
  // console.log(text2)
  // if (!DICE_LINE_REGEX.test(text)) return
  const resultText = [
    { color: "#f44336", text: "대실패" },
    { color: "#fff", text: "실패" },
    { color: "#29b6f6", text: "성공" },
    { color: "rgba(177, 35, 243, 1)", text: "강성공" },
    { color: "#f1de0d", text: "대성공" }
  ]

  const diceResult = calcSuccess(text2)
  const color = resultText[diceResult.crit + 1].color
  const successText = resultText[diceResult.crit + 1].text

  const badge = document.createElement("span")
  badge.dataset.helper = "dice-result"
  badge.style.cssText = `margin-left:.5em;font-weight:${diceResult.crit !== 0 && diceResult.crit !== 1 ? 700 : 400};
                       color:${color}`
  badge.textContent = `\u{1F3B2}S=${diceResult.S}${diceResult.unitCount != null ? ` #️⃣${diceResult.unitCount}${diceResult.critCount ? ` ✪${diceResult.critCount}` : ""}` : ""}` // \u{1F3B2} == 🎲
  if (diceResult.passDC != null) {
    badge.textContent += ` ${successText}`
  }
  // const badge2 = document.createElement("span")
  // badge2.dataset.helper = "dice-result2"
  // badge2.style.cssText = `margin-left:.5em;font-weight:${diceResult.crit !== 0 && diceResult.crit !== 1 ? 700 : 400};
  //                      color:${color}`
  // ${diceResult.passDC != null ? (diceResult.passDC ? ` 성공` : ` 실패`) : ""}
  const diceSpan = el.querySelector<HTMLSpanElement>("p > span")
  diceSpan?.insertAdjacentElement("afterend", badge)
  el.dataset.helper = "dice-marked"
  setLastDiceResult(diceResult)
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
    // console.log("[chat] 현재 탭:", tabBtn.textContent?.trim())
    const logBox = document.querySelector<HTMLElement>(CHAT_LOG_SEL)

    if (!logBox) return console.warn("logBox not found")

    logObs?.disconnect()

    /* 3) 화면에 이미 있는 <li>/<div> 들 먼저 처리 */
    logBox
      .querySelectorAll(":scope > *")
      .forEach((n) => handleLine(n as HTMLElement, logBox))

    /* 4) 이후 들어올 노드 감시 */
    logObs = new MutationObserver((records) => {
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1) handleLine(n as HTMLElement, logBox)
        })
      )
    })
    logObs.observe(logBox, { childList: true })
  }
})()

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

    return {
      S,
      crit,
      ...(groupified ? { unitCount } : {}),
      ...(hasDC ? { passDC } : {}),
      ...(critCount > 0 ? { critCount } : {})
    }
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

function unparen(s: string) {
  return s.trim().replace(/^\((.*)\)$/, "$1")
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
