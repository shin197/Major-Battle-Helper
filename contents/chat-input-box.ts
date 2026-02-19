import { getChatInputBox } from "~utils/elements"

// 전역 변수로 히스토리 상태 관리 (모듈 최상단에 선언)
const chatHistory: string[] = []
let historyIndex = -1
let savedCurrentInput = "" // 히스토리를 위로 올리기 직전에 치고 있던 텍스트 보관용

function enableAutoClosingPairs(ev: KeyboardEvent) {
  // TypeScript 에러 방지를 위해 Record 타입 지정
  const pairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "(": ")",
    "[": "]",
    "{": "}",
    "<": ">"
  }

  const ta = ev.target as HTMLTextAreaElement
  if (ta != getChatInputBox()) return

  const char = ev.key
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = ta.value
  const closingChars = Object.values(pairs)

  // ==========================================
  // 1. Step Over (닫는 기호 중복 입력 방지 및 커서 이동)
  // ==========================================
  // 이 부분은 닫는 기호(closingChars)를 누를 때 작동해야 하므로 독립적으로 꺼내어 줍니다.
  if (closingChars.includes(char)) {
    if (start === end && value[start] === char) {
      ev.preventDefault()
      // 글자를 입력하는 대신 커서만 한 칸 뒤로 넘깁니다.
      ta.setSelectionRange(start + 1, start + 1)
      return
    }
  }
  // ==========================================
  // 2. Backspace (자동 완성된 쌍 한 번에 지우기)
  // ==========================================
  // 이 부분은 "Backspace"를 누를 때 작동해야 하므로 역시 독립적으로 둡니다.
  if (char === "Backspace" && start === end && start > 0) {
    const prevChar = value[start - 1]
    const nextChar = value[start]

    // 커서 앞이 여는 기호고, 커서 뒤가 짝이 맞는 닫는 기호라면? (예: "()" 중간에 커서가 있을 때)
    if (pairs[prevChar] && pairs[prevChar] === nextChar) {
      ev.preventDefault()

      // 커서 앞뒤의 기호를 블록 지정한 뒤 삭제 (Ctrl+Z 보존을 위해 execCommand 사용)
      ta.setSelectionRange(start - 1, start + 1)
      document.execCommand("delete", false, null)

      // 코코포리아(React) 동기화를 위해 이벤트 강제 발생
      ta.dispatchEvent(new Event("input", { bubbles: true }))
      return
    }
  }

  // ==========================================
  // 3. 기호 자동 완성 (Ctrl+Z 내역 보존 방식)
  // ==========================================
  // 여는 기호를 눌렀을 때만 작동하도록 여기서 조건을 체크합니다.
  if (pairs[char]) {
    ev.preventDefault()
    const closingChar = pairs[char]

    // 3-1. 텍스트를 드래그(블록 지정)한 상태일 때
    if (start !== end) {
      const selectedText = value.substring(start, end)
      // 드래그된 텍스트 양옆에 기호를 감싸서 덮어쓰기
      document.execCommand(
        "insertText",
        false,
        char + selectedText + closingChar
      )

      // 텍스트 블록 지정 상태 유지
      ta.setSelectionRange(start + 1, start + 1 + selectedText.length)
    }
    // 3-2. 일반 입력 상태일 때
    else {
      // 열기+닫기 기호를 동시에 입력
      document.execCommand("insertText", false, char + closingChar)

      // 커서를 여는 기호와 닫는 기호 가운데로 이동
      ta.setSelectionRange(start + 1, start + 1)
    }

    // React 동기화 보장
    ta.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

function enableChatHistory(ev: KeyboardEvent) {
  const ta = ev.target as HTMLTextAreaElement
  if (ta != getChatInputBox()) return

  // ==========================================
  // 1. 엔터키 감지: 채팅 전송 시 히스토리에 저장
  // ==========================================
  // Shift+Enter(줄바꿈)가 아니고, 한글 조합 중(isComposing)이 아닐 때만 작동
  if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
    const text = ta.value.trim()
    if (text) {
      // 바로 직전에 친 채팅과 똑같지 않을 때만 추가 (도배 방지)
      if (chatHistory[chatHistory.length - 1] !== text) {
        chatHistory.push(text)
      }
      // 히스토리 최대 50개 유지
      if (chatHistory.length > 50) chatHistory.shift()
    }
    // 상태 초기화
    historyIndex = chatHistory.length
    savedCurrentInput = ""
    return
  }

  // ==========================================
  // 2. 방향키 위/아래 감지: 히스토리 탐색
  // ==========================================
  if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
    const isModifierPressed = ev.altKey || ev.ctrlKey

    // [핵심] 코코포리아 퍼지 파인더(Fuzzy Finder) 활성화 여부 확인
    // ID가 'downshift-'로 시작하고 '-menu'로 끝나는 ul 태그를 찾습니다.
    const fuzzyMenu = document.querySelector(
      'ul[id^="downshift-"][id$="-menu"]'
    )

    // 메뉴가 존재하고, data-hidden이 "false"라면 퍼지 파인더가 열려있는 것입니다.
    const isFuzzyOpen = fuzzyMenu
      ? fuzzyMenu.getAttribute("data-hidden") === "false"
      : false

    // 퍼지 파인더가 열려있다면 코코포리아의 기본 동작(방향키로 목록 이동)에 양보합니다.
    if (isFuzzyOpen && isModifierPressed) {
      return
    }

    // 히스토리가 없다면 무시
    if (chatHistory.length === 0) {
      return
    }
    // ----------------------------------------------------
    // [선택 사항] 여러 줄(Shift+Enter) 입력 시 커서 이동 보호
    // 만약 현재 입력칸에 줄바꿈(\n)이 포함되어 있다면, 일반적인 커서 이동을 방해하지 않도록 합니다.
    // (이 기능이 불필요하다면 아래 if문을 지우셔도 됩니다.)
    if (ta.value.includes("\n")) {
      return
    }
    // ----------------------------------------------------

    // ev.preventDefault()
    // ev.stopPropagation()
    ev.stopImmediatePropagation()

    if (ev.key === "ArrowUp") {
      // 처음 히스토리를 불러올 때, 현재 치고 있던 텍스트를 임시 저장
      if (historyIndex === chatHistory.length) {
        savedCurrentInput = ta.value
      }

      // 위로 가기 (과거로)
      if (historyIndex > 0) {
        historyIndex--
        replaceInputText(ta, chatHistory[historyIndex])
      }
    } else if (ev.key === "ArrowDown") {
      // 아래로 가기 (최신으로)
      if (historyIndex < chatHistory.length - 1) {
        historyIndex++
        replaceInputText(ta, chatHistory[historyIndex])
      }
      // 맨 아래로 오면 원래 치고 있던 텍스트로 복구
      else if (historyIndex === chatHistory.length - 1) {
        historyIndex++
        replaceInputText(ta, savedCurrentInput)
      }
    }
  }
}

// 텍스트 전체를 갈아끼우는 헬퍼 함수 (Ctrl+Z 내역을 1 묶음으로 처리)
function replaceInputText(ta: HTMLTextAreaElement, text: string) {
  ta.focus()
  // 전체 블록 지정
  ta.setSelectionRange(0, ta.value.length)

  // 만약 비워야 한다면 delete, 텍스트가 있다면 insertText
  if (text === "") {
    document.execCommand("delete", false, null)
  } else {
    document.execCommand("insertText", false, text)
  }

  // React 동기화
  ta.dispatchEvent(new Event("input", { bubbles: true }))
}

document.addEventListener("keydown", enableAutoClosingPairs, true)
document.addEventListener("keydown", enableChatHistory, true)
