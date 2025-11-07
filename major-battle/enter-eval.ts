import {
  applyStatCommandResult,
  extractCharacterData,
  openCharacterEditDialog
} from "~contents/character-data"
import { getCurrentCharacterName } from "~contents/slot-shortcut"
import { expandDiceVars } from "~major-battle/dice-var-exp"
import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type"
import { getCharacterListButton, getChatInputBox } from "~utils/elements"

import { initBattle } from "./battle-init"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle",
  all_frames: true // 캔버스가 iframe 안일 때도 주입
}

type Patch = { label: string; value: string | number }

/** -----------------------------------------------
 *  0. 도우미: React-controlled textarea에 값 주입
 * ----------------------------------------------*/
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el) as HTMLTextAreaElement // el.__proto__ 도 됨
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

/** -----------------------------------------------
 *  1. 메시지 변환 규칙
 *     - '\n' → 실제 줄바꿈
 *     - max(A,B), min(A,B) 계산
 *     - 필요하면 여기에 추가 Regex
 * ----------------------------------------------*/

// 외부 제공 함수/객체 타입 선언(프로젝트에 이미 있다면 생략 가능)

function transformMessage(
  src: string,
  dialog: HTMLDivElement,
  opts: {
    greedy?: boolean // 문장 속 수식 그리디 평가
    greedyMinus?: boolean // '-'만 있는 식도 평가(기본 false: 날짜 등 보호)
    greedyBackslash?: boolean // 백슬래시 연산자도 그리디 평가(기본 true)
  } = { greedy: true, greedyMinus: true, greedyBackslash: true }
): string {
  // 숫자 포맷터(정수면 그대로, 소수는 불필요한 0 제거)
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, "")

  let out = src.replace(/\\n/g, "\n") // 리터럴 "\n" → 개행

  // =========================
  // (0) {변수} 치환
  // =========================
  try {
    const rec = extractCharacterData(dialog, true)

    const { status = [], params = [] } = rec ?? {}

    const getFromStatus = (label: string, which: "cur" | "max") => {
      const it = status.find((s) => s.label === label)
      return it ? (which === "cur" ? it.cur : it.max) : undefined
    }
    const getFromParams = (label: string) => {
      const it = params.find((p) => p.label === label)
      return it?.value
    }

    // {HP}, {HP_max}, {ATK} 등 치환
    out = out.replace(/\{([^{}]+)\}/g, (_m, raw) => {
      const token = String(raw).trim()
      const m = /^(.*?)(?:\.|_)(cur|max)$/i.exec(token)
      const base = (m ? m[1] : token).trim()
      const attr = (m ? m[2] : "cur").toLowerCase() as "cur" | "max"

      let v: number | string | undefined = getFromStatus(base, attr)
      if (v === undefined) {
        v = getFromParams(base)
      }
      return v === undefined ? `{${token}}` : String(v)
    })
  } catch {
    // 변수 확장 실패는 전체 처리에 영향 주지 않음
  }

  // =========================
  // (1) min / max 함수 치환
  // =========================
  out = out.replace(
    /max\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
    (_, a, b) => String(Math.max(Number(a), Number(b)))
  )
  out = out.replace(
    /min\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
    (_, a, b) => String(Math.min(Number(a), Number(b)))
  )

  // =========================
  // (2) 산술 평가기: '/'=정수 나눗셈, '\'=ceilDiv
  // =========================
  const evalArith = (expr: string): number => {
    const s = expr.trim()
    const ops: string[] = []
    const vals: number[] = []

    const prec = (op: string) =>
      op === "u-" || op === "u+"
        ? 4
        : op === "^"
          ? 3
          : op === "*" || op === "/" || op === "%" || op === "\\"
            ? 2
            : 1

    const rightAssoc = (op: string) => op === "^" || op === "u-" || op === "u+"

    const apply = (op: string) => {
      if (op === "u-" || op === "u+") {
        const a = vals.pop()
        if (a === undefined) throw new Error("bad expr")
        vals.push(op === "u-" ? -a : +a)
        return
      }
      const b = vals.pop(),
        a = vals.pop()
      if (a === undefined || b === undefined) throw new Error("bad expr")
      switch (op) {
        case "+":
          vals.push(a + b)
          break
        case "-":
          vals.push(a - b)
          break
        case "*":
          vals.push(a * b)
          break
        case "/":
          vals.push(Math.trunc(a / b))
          break // 정수 나눗셈
        case "\\":
          vals.push(Math.ceil(a / b))
          break // 올림 나눗셈(ceilDiv)
        case "%":
          vals.push(a % b)
          break
        case "^":
          vals.push(Math.pow(a, b))
          break
        default:
          throw new Error("op")
      }
    }

    const numTok = (str: string, i: number) => {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(str.slice(i))
      return m ? { v: parseFloat(m[0]), len: m[0].length } : null
    }

    let i = 0,
      expectUnary = true
    while (i < s.length) {
      const ch = s[i]
      if (ch === " " || ch === "\t") {
        i++
        continue
      }

      if (ch === "(") {
        let depth = 1,
          j = i + 1
        while (j < s.length && depth > 0) {
          if (s[j] === "(") depth++
          else if (s[j] === ")") depth--
          j++
        }
        if (depth !== 0) throw new Error("mismatch")
        vals.push(evalArith(s.slice(i + 1, j - 1)))
        i = j
        expectUnary = false
        continue
      }

      const nm = numTok(s, i)
      if (nm) {
        vals.push(nm.v)
        i += nm.len
        expectUnary = false
        continue
      }

      if ("+-*/%^\\\\".includes(ch)) {
        let op = ch === "\\" ? "\\" : ch
        if ((ch === "+" || ch === "-") && expectUnary)
          op = ch === "+" ? "u+" : "u-"

        while (ops.length) {
          const top = ops[ops.length - 1]
          const cond = rightAssoc(op)
            ? prec(op) < prec(top)
            : prec(op) <= prec(top)
          if (cond) apply(ops.pop()!)
          else break
        }
        ops.push(op)
        i++
        expectUnary = true
        continue
      }

      throw new Error("unexpected char at " + i)
    }

    while (ops.length) apply(ops.pop()!)
    if (vals.length !== 1) throw new Error("bad expr")
    return vals[0]
  }

  // (3) 괄호가 순수 산술이면 가장 안쪽부터 평가
  const ALLOWED_PAREN = /^[\d+\-*/%^.\s\t\\]+$/
  const PAREN = /\(([^()]+)\)/g
  let prev: string
  do {
    prev = out
    out = out.replace(PAREN, (m, inner) => {
      if (!ALLOWED_PAREN.test(inner)) return m
      try {
        return fmt(evalArith(inner))
      } catch {
        return m
      }
    })
  } while (out !== prev)

  // (4) 괄호 없는 수식 그리디 평가
  if (opts.greedy) {
    const opPart =
      opts.greedyBackslash === false ? "[+\\-*/%^]" : "(?:\\\\|[+\\-*/%^])"
    const re = new RegExp(
      `(?<![A-Za-z0-9_])(?:[+\\-]?\\d+(?:\\.\\d+)?(?:\\s*${opPart}\\s*[+\\-]?\\d+(?:\\.\\d+)?)+)(?![A-Za-z0-9_])`,
      "g"
    )
    out = out.replace(re, (m) => {
      if (!opts.greedyMinus && !/[+*/%^\\]/.test(m)) return m // '-'만 있으면 패스
      try {
        return fmt(evalArith(m))
      } catch {
        return m
      }
    })
  }

  return out
}
/** -----------------------------------------------
 *  2. Ctrl+Enter 핸들러
 * ----------------------------------------------*/
async function handleCtrlEnter(ev: KeyboardEvent) {
  // 단축키 조건
  if (!(ev.ctrlKey && ev.key === "Enter")) return

  const ta = ev.target as HTMLElement
  if (ta != getChatInputBox()) return
  if (!(ta instanceof HTMLTextAreaElement) || !ta.id.startsWith("downshift"))
    return
  // 캐릭터 이름 가져오기
  const charName = getCurrentCharacterName()

  // 메이저배틀에만 필요한 코드
  const expandedVal = expandDiceVars(ta.value, {
    nullSPlaceholder: "?", // S가 없을 때 "?"로
    nullUnitPlaceholder: "-", // unitCount 없으면 "-"
    criticalAsNumber: true // {S.!}는 1/0
    // computeUnitCount: (S) => Math.floor(S / 5) // 필요 시 제공
  })

  const characterListBtn = getCharacterListButton()

  const dialog = await openCharacterEditDialog(charName)

  const newVal = transformMessage(expandedVal, dialog) //ta.value
  var finalVal = newVal

  if (charName) {
    if (newVal.startsWith("/stat")) {
      applyStatCommandResult(dialog, newVal)
      finalVal = ""
    }
  }

  // 메이저배틀에만 필요한 커맨드
  if (newVal.startsWith("/battle")) {
    initBattle()
    finalVal = ""
  }
  characterListBtn.click() // 다이얼로그 회수
  setNativeValue(ta, finalVal)
}

/** -----------------------------------------------
 *  3. 한 번만 전역 리스너 등록
 * ----------------------------------------------*/
document.addEventListener("keydown", handleCtrlEnter, true)
