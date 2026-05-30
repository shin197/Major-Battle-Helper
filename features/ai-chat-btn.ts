import { ccf } from "~core/isolated/ccfolia-api"
import type { AiSettings } from "~utils/types"
import { setNativeValue, sleep } from "~utils/utils"
import { getCurrentCharacterName } from "./slot-shortcut"

export async function initAiChatBtn() {
  let undoHint = ""
  let isGenerating = false

  const handleAiClick = async (btn: HTMLButtonElement, textarea: HTMLTextAreaElement) => {
    if (isGenerating) return
    isGenerating = true

    // If it's undo mode
    if (btn.getAttribute("data-mode") === "undo") {
      setNativeValue(textarea, undoHint)
      btn.innerHTML = "✨"
      btn.setAttribute("data-mode", "generate")
      btn.title = "AI NPC 제안 (클릭)"
      isGenerating = false
      return
    }

    const activeCharacterName = getCurrentCharacterName()

    const currentText = textarea.value.trim()
    const hint = currentText ? `다음은 당신이 연기할 캐릭터인 '${activeCharacterName}'에게 GM이 전달하는 힌트 또는 대사 예시입니다. 이 의도를 살려서 분위기에 맞게 창작해보세요:\n${currentText}`
      : `당신이 연기할 캐릭터는 '${activeCharacterName}'입니다. 분위기에 맞게 창작해주세요.`

    // Store for undo
    undoHint = textarea.value

    btn.innerHTML = "⏳"
    btn.title = "AI가 생각 중입니다..."
    btn.style.cursor = "wait"

    try {
      const state = await ccf.getReduxState()
      const roomId = state.app?.state?.roomId
      if (!roomId) throw new Error("방에 접속해 있지 않습니다.")

      const getSettings = () => new Promise<AiSettings>((resolve) => {
        chrome.storage.local.get(`ai_settings_${roomId}`, (res) => {
          resolve(res[`ai_settings_${roomId}`] as AiSettings)
        })
      })

      const settings = await getSettings()
      if (!settings || !settings.apiKey) {
        throw new Error("설정에서 OpenAI API 키를 먼저 등록해주세요.")
      }

      // Fetch recent 30 valid messages
      const recentMessages = await ccf.messages.getRecentMessages(30)

      // Transform messages for OpenAI
      const chatHistory = recentMessages.map((msg: any) => {
        return {
          role: "user" as const,
          content: `[${msg.name || "Unknown"}]: ${msg.text || ""}`
        }
      })

      // We append the GM hint to the system prompt
      const finalSystemPrompt = hint ? `${settings.systemPrompt || ""}\n\n${hint}` : (settings.systemPrompt || "")

      const reply = await ccf.ai.generateReply(
        settings.apiKey,
        finalSystemPrompt,
        chatHistory,
        "gpt-4o-mini"
      )

      setNativeValue(textarea, reply)

      // Turn into Undo button
      btn.innerHTML = "↩️"
      btn.setAttribute("data-mode", "undo")
      btn.title = "AI 제안 되돌리기"

    } catch (err: any) {
      console.error("[BattleHelper AI]", err)
      alert(err.message || "AI 제안에 실패했습니다.")
      btn.innerHTML = "✨"
    } finally {
      btn.style.cursor = "pointer"
      isGenerating = false
    }
  }

  const injectBtn = () => {
    // 코코포리아 채팅 폼 영역 내의 전송 버튼들을 찾습니다.
    const sendWrappers = Array.from(document.querySelectorAll('#root .MuiDrawer-docked form button[type="submit"]'))

    for (const sendBtn of sendWrappers) {
      const wrapper = sendBtn.parentElement
      if (!wrapper || wrapper.querySelector(".mb-ai-btn")) continue

      // 전역 채팅 입력칸(textarea)을 찾습니다.
      const textarea = document.querySelector('textarea[name="text"]') as HTMLTextAreaElement
      if (!textarea) continue

      const aiBtn = document.createElement("button")
      aiBtn.type = "button"
      aiBtn.className = "mb-ai-btn"
      aiBtn.innerHTML = "✨"
      aiBtn.title = "AI NPC 제안 (클릭)"
      aiBtn.setAttribute("data-mode", "generate")
      Object.assign(aiBtn.style, {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "16px",
        padding: "0 0px",
        transition: "transform 0.2s",
        minWidth: "22px"
      } as CSSStyleDeclaration)

      aiBtn.onmouseenter = () => (aiBtn.style.transform = "scale(1.1)")
      aiBtn.onmouseleave = () => (aiBtn.style.transform = "scale(1)")

      aiBtn.onclick = (e) => {
        e.preventDefault()
        handleAiClick(aiBtn, textarea)
      }

      // Reset undo state if user types manually
      textarea.addEventListener("input", () => {
        if (aiBtn.getAttribute("data-mode") === "undo" && textarea.value !== undoHint) {
          aiBtn.innerHTML = "✨"
          aiBtn.setAttribute("data-mode", "generate")
          aiBtn.title = "AI NPC 제안 (클릭)"
        }
      })

      wrapper.insertBefore(aiBtn, sendBtn)
    }
  }

  const observer = new MutationObserver(() => {
    injectBtn()
  })

  observer.observe(document.body, { childList: true, subtree: true })
  injectBtn()
}
