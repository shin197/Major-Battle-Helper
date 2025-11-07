// import { openCharacterEditDialogRead } from "./character-data"
// import { getCurrentCharacterName } from "./slot-shortcut"

// /** -----------------------------------------------
//  *  0. 도우미: React-controlled textarea에 값 주입
//  * ----------------------------------------------*/
// function setNativeValue(el: HTMLTextAreaElement, value: string) {
//   const proto = Object.getPrototypeOf(el) as HTMLTextAreaElement // el.__proto__ 도 됨
//   const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
//   setter?.call(el, value)
//   el.dispatchEvent(new Event("input", { bubbles: true }))
// }

// /** -----------------------------------------------
//  *  1. 메시지 변환 규칙
//  *     - '\n' → 실제 줄바꿈
//  *     - max(A,B), min(A,B) 계산
//  *     - 필요하면 여기에 추가 Regex
//  * ----------------------------------------------*/

// // 외부 제공 함수/객체 타입 선언(프로젝트에 이미 있다면 생략 가능)

// async function transformMessage(
//   src: string,
//   opts: {
//     greedy?: boolean // 문장 속 수식 그리디 평가
//     greedyMinus?: boolean // '-'만 있는 식도 평가(기본 false: 날짜 등 보호)
//     greedyBackslash?: boolean // 백슬래시 연산자도 그리디 평가(기본 true)
//   } = { greedy: true, greedyMinus: false, greedyBackslash: true }
// ): Promise<string> {
//   // 숫자 포맷터(정수면 그대로, 소수는 불필요한 0 제거)
//   const fmt = (n: number) =>
//     Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, "")

//   let out = src.replace(/\\n/g, "\n") // 리터럴 "\n" → 개행

//   // =========================
//   // (0) {변수} 치환
//   // =========================
//   try {
//     const name = getCurrentCharacterName()
//     if (name) {
//       const rec = await openCharacterEditDialogRead(name)

//       const { status = [], params = [] } = rec ?? {}

//       const getFromStatus = (label: string, which: "cur" | "max") => {
//         const it = status.find((s) => s.label === label)
//         return it ? (which === "cur" ? it.cur : it.max) : undefined
//       }
//       const getFromParams = (label: string) => {
//         const it = params.find((p) => p.label === label)
//         return it?.value
//       }

//       // {HP}, {HP_max}, {ATK} 등 치환
//       out = out.replace(/\{([^{}]+)\}/g, (_m, raw) => {
//         const token = String(raw).trim()
//         const m = /^(.*?)(?:\.|_)(cur|max)$/i.exec(token)
//         const base = (m ? m[1] : token).trim()
//         const attr = (m ? m[2] : "cur").toLowerCase() as "cur" | "max"

//         let v: number | string | undefined = getFromStatus(base, attr)
//         if (v === undefined) {
//           v = getFromParams(base)
//         }
//         return v === undefined ? `{${token}}` : String(v)
//       })
//     }
//   } catch {
//     // 변수 확장 실패는 전체 처리에 영향 주지 않음
//   }

//   // =========================
//   // (1) min / max 함수 치환
//   // =========================
//   out = out.replace(
//     /max\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
//     (_, a, b) => String(Math.max(Number(a), Number(b)))
//   )
//   out = out.replace(
//     /min\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
//     (_, a, b) => String(Math.min(Number(a), Number(b)))
//   )

//   // =========================
//   // (2) 산술 평가기: '/'=정수 나눗셈, '\'=ceilDiv
//   // =========================
//   const evalArith = (expr: string): number => {
//     const s = expr.trim()
//     const ops: string[] = []
//     const vals: number[] = []

//     const prec = (op: string) =>
//       op === "u-" || op === "u+"
//         ? 4
//         : op === "^"
//           ? 3
//           : op === "*" || op === "/" || op === "%" || op === "\\"
//             ? 2
//             : 1

//     const rightAssoc = (op: string) => op === "^" || op === "u-" || op === "u+"

//     const apply = (op: string) => {
//       if (op === "u-" || op === "u+") {
//         const a = vals.pop()
//         if (a === undefined) throw new Error("bad expr")
//         vals.push(op === "u-" ? -a : +a)
//         return
//       }
//       const b = vals.pop(),
//         a = vals.pop()
//       if (a === undefined || b === undefined) throw new Error("bad expr")
//       switch (op) {
//         case "+":
//           vals.push(a + b)
//           break
//         case "-":
//           vals.push(a - b)
//           break
//         case "*":
//           vals.push(a * b)
//           break
//         case "/":
//           vals.push(Math.trunc(a / b))
//           break // 정수 나눗셈
//         case "\\":
//           vals.push(Math.ceil(a / b))
//           break // 올림 나눗셈(ceilDiv)
//         case "%":
//           vals.push(a % b)
//           break
//         case "^":
//           vals.push(Math.pow(a, b))
//           break
//         default:
//           throw new Error("op")
//       }
//     }

//     const numTok = (str: string, i: number) => {
//       const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(str.slice(i))
//       return m ? { v: parseFloat(m[0]), len: m[0].length } : null
//     }

//     let i = 0,
//       expectUnary = true
//     while (i < s.length) {
//       const ch = s[i]
//       if (ch === " " || ch === "\t") {
//         i++
//         continue
//       }

//       if (ch === "(") {
//         let depth = 1,
//           j = i + 1
//         while (j < s.length && depth > 0) {
//           if (s[j] === "(") depth++
//           else if (s[j] === ")") depth--
//           j++
//         }
//         if (depth !== 0) throw new Error("mismatch")
//         vals.push(evalArith(s.slice(i + 1, j - 1)))
//         i = j
//         expectUnary = false
//         continue
//       }

//       const nm = numTok(s, i)
//       if (nm) {
//         vals.push(nm.v)
//         i += nm.len
//         expectUnary = false
//         continue
//       }

//       if ("+-*/%^\\\\".includes(ch)) {
//         let op = ch === "\\" ? "\\" : ch
//         if ((ch === "+" || ch === "-") && expectUnary)
//           op = ch === "+" ? "u+" : "u-"

//         while (ops.length) {
//           const top = ops[ops.length - 1]
//           const cond = rightAssoc(op)
//             ? prec(op) < prec(top)
//             : prec(op) <= prec(top)
//           if (cond) apply(ops.pop()!)
//           else break
//         }
//         ops.push(op)
//         i++
//         expectUnary = true
//         continue
//       }

//       throw new Error("unexpected char at " + i)
//     }

//     while (ops.length) apply(ops.pop()!)
//     if (vals.length !== 1) throw new Error("bad expr")
//     return vals[0]
//   }

//   // (3) 괄호가 순수 산술이면 가장 안쪽부터 평가
//   const ALLOWED_PAREN = /^[\d+\-*/%^.\s\t\\]+$/
//   const PAREN = /\(([^()]+)\)/g
//   let prev: string
//   do {
//     prev = out
//     out = out.replace(PAREN, (m, inner) => {
//       if (!ALLOWED_PAREN.test(inner)) return m
//       try {
//         return fmt(evalArith(inner))
//       } catch {
//         return m
//       }
//     })
//   } while (out !== prev)

//   // (4) 괄호 없는 수식 그리디 평가
//   if (opts.greedy) {
//     const opPart =
//       opts.greedyBackslash === false ? "[+\\-*/%^]" : "(?:\\\\|[+\\-*/%^])"
//     const re = new RegExp(
//       `(?<![A-Za-z0-9_])(?:[+\\-]?\\d+(?:\\.\\d+)?(?:\\s*${opPart}\\s*[+\\-]?\\d+(?:\\.\\d+)?)+)(?![A-Za-z0-9_])`,
//       "g"
//     )
//     out = out.replace(re, (m) => {
//       if (!opts.greedyMinus && !/[+*/%^\\]/.test(m)) return m // '-'만 있으면 패스
//       try {
//         return fmt(evalArith(m))
//       } catch {
//         return m
//       }
//     })
//   }

//   return out
// }
// /** -----------------------------------------------
//  *  2. Ctrl+Enter 핸들러
//  * ----------------------------------------------*/
// async function handleCtrlEnter(ev: KeyboardEvent) {
//   // 단축키 조건
//   if (!(ev.ctrlKey && ev.key === "Enter")) return

//   const ta = ev.target as HTMLElement
//   if (!(ta instanceof HTMLTextAreaElement) || !ta.id.startsWith("downshift"))
//     return

//   // 캐릭터 이름 가져오기

//   // ① 변환 → ② 값 주입
//   const newVal = transformMessage(ta.value) //ta.value
//   if ((await newVal) !== ta.value) {
//     setNativeValue(ta, await newVal)
//   }

//   /* 여기서 event를 막지 않으면 전송 로직이 그대로 이어집니다.
//      만약 “변환 후 다시 Ctrl+Enter” 를 재발행하고 싶다면
//      ev.stopImmediatePropagation(); ev.preventDefault();
//      setNativeValue(...);
//      setTimeout(() =>
//        ta.dispatchEvent(
//          new KeyboardEvent("keydown", {key:"Enter", code:"Enter", ctrlKey:true, bubbles:true})
//        ), 0
//      );
//   */
// }

// /** -----------------------------------------------
//  *  3. 한 번만 전역 리스너 등록
//  *     - capture 단계(true)에서 처리해야 값이 먼저 바뀐 뒤
//  *       사이트 쪽 keydown → keyup 로직이 실행됩니다.
//  * ----------------------------------------------*/
// // document.addEventListener("keydown", handleCtrlEnter, true)
