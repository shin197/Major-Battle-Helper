import { getChatInputBox } from "~utils/elements"

import { evalChatInputBox } from "./enter-eval"
import { initMessageActions } from "./message-actions"
import { ccf } from "~core/isolated/ccfolia-api"
import { getCurrentCharacterName } from "./slot-shortcut"
import { showToast } from "~utils/isolated/toast"

// 전역 변수로 히스토리 상태 관리 (모듈 최상단에 선언)
const chatHistory: string[] = []
let historyIndex = -1
let savedCurrentInput = "" // 히스토리를 위로 올리기 직전에 치고 있던 텍스트 보관용

let editingMessageId: string | null = null

// .env 파일의 값을 상수로 가져옴
const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

function enableAutoClosingPairs(ev: KeyboardEvent) {
  // TypeScript 에러 방지를 위해 Record 타입 지정
  const pairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "(": ")",
    "[": "]",
    "{": "}"
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

function updateEditHighlight(id: string | null) {
  let styleEl = document.getElementById("mb-edit-style")
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "mb-edit-style"
    document.head.appendChild(styleEl)
  }
  if (id) {
    styleEl.textContent = `
      div[data-msg-id="${id}"] {
        background-color: rgba(33, 150, 243, 0.15) !important;
        outline: 2px solid rgb(33, 150, 243) !important;
        border-radius: 4px;
        transition: all 0.2s ease-in-out;
      }
    `
  } else {
    styleEl.textContent = ""
  }
}

function exitEditMode(ta: HTMLTextAreaElement) {
  if (!editingMessageId) return
  editingMessageId = null
  updateEditHighlight(null)
}

async function applyEdit(ta: HTMLTextAreaElement) {
  if (!editingMessageId) return
  const newText = ta.value.trim()
  if (newText) {
    try {
      await ccf.messages.edit(editingMessageId, newText)
      exitEditMode(ta)
      replaceInputText(ta, "")
    } catch (e) {
      showToast("❌ 메시지 수정에 실패했습니다.")
    }
  } else {
    // 텍스트가 없으면 수정 취소
    exitEditMode(ta)
  }
}

async function enterEditMode(ta: HTMLTextAreaElement, direction: "prev" | "next" = "prev") {
  try {
    const prevEditingId = editingMessageId
    exitEditMode(ta) // 기존 하이라이트 지우기

    const charName = getCurrentCharacterName()
    const msgs = await ccf.messages.getAll()
    if (!msgs || msgs.length === 0) return

    let targetMsg: any = null

    if (charName) {
      let startIndex = direction === "prev" ? msgs.length - 1 : 0
      if (prevEditingId) {
        const prevIndex = msgs.findIndex((m: any) => (m.id || m._id) === prevEditingId)
        if (prevIndex !== -1) {
          startIndex = direction === "prev" ? prevIndex - 1 : prevIndex + 1
        }
      }

      if (direction === "prev") {
        for (let i = startIndex; i >= 0; i--) {
          if (msgs[i].name === charName && msgs[i].type !== "system") {
            targetMsg = msgs[i]
            break
          }
        }
      } else {
        for (let i = startIndex; i < msgs.length; i++) {
          if (msgs[i].name === charName && msgs[i].type !== "system") {
            targetMsg = msgs[i]
            break
          }
        }
      }
    } else {
      showToast("❗ 캐릭터가 선택되지 않아 단축키로 수정할 수 없습니다.")
      return
    }

    if (targetMsg && (targetMsg.id || targetMsg._id)) {
      editingMessageId = targetMsg.id || targetMsg._id
      replaceInputText(ta, targetMsg.text || "")

      updateEditHighlight(editingMessageId)
      showToast("✏️ 메시지 수정 모드 (Esc: 취소, Enter: 적용)")
    } else {
      if (prevEditingId) {
        // 복원
        editingMessageId = prevEditingId
        updateEditHighlight(editingMessageId)
        showToast(direction === "prev" ? "❗ 더 이상 이전 메시지가 없습니다." : "❗ 더 이상 다음 메시지가 없습니다.")
      } else {
        showToast("❗ 수정할 최근 메시지를 찾을 수 없습니다.")
      }
    }
  } catch (e) {
    console.error("[BattleHelper] enterEditMode error:", e)
  }
}

function enableChatHistory(ev: KeyboardEvent) {
  const ta = ev.target as HTMLTextAreaElement
  if (ta != getChatInputBox()) return

  // ==========================================
  // 0. 편집 모드 중 키보드 단축키 처리
  // ==========================================
  if (editingMessageId) {
    if (ev.key === "ArrowUp" && ev.altKey) {
      ev.preventDefault()
      ev.stopImmediatePropagation()
      enterEditMode(ta, "prev")
      return
    }
    if (ev.key === "ArrowDown" && ev.altKey) {
      ev.preventDefault()
      ev.stopImmediatePropagation()
      enterEditMode(ta, "next")
      return
    }
    if (ev.key === "Escape") {
      ev.preventDefault()
      ev.stopImmediatePropagation()
      exitEditMode(ta)
      return
    }
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && !ev.ctrlKey) {
      ev.preventDefault()
      ev.stopImmediatePropagation()
      applyEdit(ta)
      return
    }
  }

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

    // [특수 편집 모드] 히스토리 탐색 중이 아닐 때 Alt+Up (히스토리가 없어서 -1인 경우 포함)
    if (ev.key === "ArrowUp" && ev.altKey && (historyIndex === chatHistory.length || historyIndex === -1) && !editingMessageId) {
      ev.preventDefault()
      ev.stopImmediatePropagation()
      enterEditMode(ta, "prev")
      return
    }

    // 퍼지 파인더(Fuzzy Finder) 활성화 여부 확인
    const fuzzyMenu = document.querySelector(
      'ul[id^="downshift-"][id$="-menu"]'
    )
    const isFuzzyOpen = fuzzyMenu
      ? fuzzyMenu.getAttribute("data-hidden") === "false"
      : false

    if (isFuzzyOpen && isModifierPressed) return
    if (chatHistory.length === 0) return

    // ----------------------------------------------------
    // [개선된 커서 이동 보호 로직]
    // ----------------------------------------------------
    const cursorStart = ta.selectionStart
    const cursorEnd = ta.selectionEnd

    if (ev.key === "ArrowUp") {
      if (ta.value.substring(0, cursorStart).includes("\n")) return
      if (cursorStart > 0 && ta.value.length > 0) return
    }

    if (ev.key === "ArrowDown") {
      if (ta.value.substring(cursorEnd).includes("\n")) return
      if (cursorEnd < ta.value.length) return
    }

    // ----------------------------------------------------
    // 이제부터 히스토리를 불러옵니다. 기본 방향키 동작을 완전히 막습니다.
    // ----------------------------------------------------
    ev.preventDefault()
    ev.stopImmediatePropagation()

    if (ev.key === "ArrowUp") {
      if (historyIndex === chatHistory.length) {
        savedCurrentInput = ta.value
      }

      if (historyIndex > 0) {
        historyIndex--
        replaceInputText(ta, chatHistory[historyIndex])

        // 💡 위로 가기: 텍스트 변경 직후 커서를 맨 앞(0)으로 이동
        setTimeout(() => {
          ta.setSelectionRange(0, 0)
        }, 0)
      }
    } else if (ev.key === "ArrowDown") {
      if (historyIndex < chatHistory.length - 1) {
        historyIndex++
        replaceInputText(ta, chatHistory[historyIndex])

        // 💡 아래로 가기: 텍스트 변경 직후 커서를 맨 뒤로 이동
        setTimeout(() => {
          ta.setSelectionRange(ta.value.length, ta.value.length)
        }, 0)
      } else if (historyIndex === chatHistory.length - 1) {
        historyIndex++
        replaceInputText(ta, savedCurrentInput)

        // 💡 아래로 가기(원래 작성중이던 글 복구): 커서를 맨 뒤로 이동
        setTimeout(() => {
          ta.setSelectionRange(ta.value.length, ta.value.length)
        }, 0)
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

export function initChatInputBox() {
  document.addEventListener("keydown", enableAutoClosingPairs, true)
  document.addEventListener("keydown", enableChatHistory, true)
  try {
    if (!IS_MAJOR_BATTLE) {
      document.addEventListener("keydown", evalChatInputBox, true)
    }
    // 메시지 호버 삭제 버튼 기능 초기화
    setTimeout(initMessageActions, 2000)
  } catch (e) {
    console.error("채팅창 기능 향상 로드 실패:", e)
  }
}
