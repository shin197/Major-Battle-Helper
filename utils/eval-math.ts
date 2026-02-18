/** -----------------------------------------------
 * 1. 수식 평가기 (Math Evaluator)
 * - 개선점: 빼기(-)와 음수(-)를 정확히 구분
 * ----------------------------------------------*/
const MathOps = {
  "+": (a: number, b: number) => a + b,
  "-": (a: number, b: number) => a - b,
  "*": (a: number, b: number) => a * b,
  "/": (a: number, b: number) => Math.floor(a / b), // 버림
  "\\": (a: number, b: number) => Math.ceil(a / b), // 올림
  "%": (a: number, b: number) => a % b
}

export const evaluateMath = (expression: string): string | null => {
  try {
    // 1. 초기 토큰화: 숫자(부호 미포함)와 연산자를 무조건 분리
    // 예: "2-5" -> ["2", "-", "5"]
    // 예: "-5" -> ["-", "5"]
    const rawTokens = expression.match(/\d+(?:\.\d+)?|[\+\-\*\/\\%\(\)]/g)
    if (!rawTokens) return null

    // 2. 문맥을 파악하여 토큰 정제 (단항 연산자 처리)
    const tokens: (string | number)[] = []
    
    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i]
      
      if (token === "-") {
        // "-"가 나왔을 때, 이게 빼기인지 음수 부호인지 판별
        // 조건: 수식의 시작이거나, 바로 앞이 연산자 또는 여는 괄호라면 '음수 부호'
        const prev = rawTokens[i - 1]
        const isUnary = i === 0 || " +-*/\\%(".includes(prev)
        
        if (isUnary) {
          // 음수 부호인 경우
          if (i + 1 < rawTokens.length && !isNaN(parseFloat(rawTokens[i + 1]))) {
            // 다음이 숫자라면 합쳐서 음수 토큰으로 만듦 (예: ["-", "5"] -> [-5])
            tokens.push(-parseFloat(rawTokens[i + 1]))
            i++ // 다음 숫자는 이미 처리했으므로 건너뜀
          } else {
             // 다음이 괄호 등이라면 -1을 곱하는 식으로 변환 (예: -(2+3) -> -1 * (2+3))
             tokens.push(-1)
             tokens.push("*")
          }
        } else {
          // 빼기 연산자인 경우
          tokens.push("-")
        }
      } else if (!isNaN(parseFloat(token))) {
        // 일반 숫자
        tokens.push(parseFloat(token))
      } else {
        // 기타 연산자/괄호
        tokens.push(token)
      }
    }

    // 3. Shunting-yard (중위 -> 후위 표기법 변환)
    const outputQueue: (number | string)[] = []
    const operatorStack: string[] = []
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "\\": 2, "%": 2 }

    tokens.forEach((token) => {
      if (typeof token === "number") {
        outputQueue.push(token)
      } else if (typeof token === "string" && " +-*/\\%".includes(token)) {
        // 공백이 포함될 수 있으므로 trim
        const op = token.trim()
        if(!op) return
        
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== "(" &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[op]
        ) {
          outputQueue.push(operatorStack.pop()!)
        }
        operatorStack.push(op)
      } else if (token === "(") {
        operatorStack.push(token as string)
      } else if (token === ")") {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
          outputQueue.push(operatorStack.pop()!)
        }
        operatorStack.pop()
      }
    })

    while (operatorStack.length > 0) {
      outputQueue.push(operatorStack.pop()!)
    }

    // 4. RPN 계산 (후위 표기법 계산)
    const stack: number[] = []
    outputQueue.forEach((token) => {
      if (typeof token === "number") {
        stack.push(token)
      } else if (typeof token === "string" && MathOps[token]) {
        if (stack.length < 2) throw new Error("Invalid Stack")
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(MathOps[token](a, b))
      }
    })

    if (stack.length !== 1) return null
    return String(stack[0])
  } catch (e) {
    return null
  }
}