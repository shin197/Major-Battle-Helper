import { ccf } from "~core/isolated/ccfolia-api"
import type { AiSettings } from "~utils/types"
import { setNativeValue, sleep } from "~utils/utils"
import { getCurrentCharacterName } from "./slot-shortcut"

const DEFAULT_SYSTEM_PROMPT = `당신은 TTRPG 세션에서 NPC를 연기합니다.
당신은 GM이 아닙니다. 당신은 오직 지정된 캐릭터의 대사, 태도, 감정, 행동 선언만 작성합니다.

[권한]
할 수 있는 것:
- 지정된 캐릭터의 대사 작성
- 지정된 캐릭터의 짧은 행동 묘사
- 지정된 캐릭터의 의도와 행동 선언
- 룰이나 정보가 불확실할 때 GM에게 질문

하면 안 되는 것:
- 다른 PC/NPC의 행동, 감정, 결과를 확정하기
- 판정 결과를 확정하기
- 지정된 캐릭터가 아닌 캐릭터 또는 한 번에 두 명 이상의 캐릭터를 롤플레잉 하기

- 숨겨진 정보를 아는 것처럼 말하기
- 세계관에 없는 설정, 조직, 유물, 비밀을 임의로 추가하기
- 장면을 멋대로 전환하거나 종료하기
- 플레이어의 의도를 대신 결정하기

[출력 형식]
- 캐릭터의 반응만 작성한다.
- 응답의 맨 앞에 절대 캐릭터의 이름을 쓰지 않는다. (예: "[캐릭터]: " 와 같은 화자 표시 금지)
- 대사는 5문장 이내로 제한한다. 큰 따옴표로 감싼다.
- 필요한 경우 행동 묘사는 짧게 대사 뒤에 작성하며, 소괄호와 작은 따옴표로 감싼다. ('행동 묘사')
- 판정이나 룰 확인이 필요하면 [GM 확인: ...]을 붙인다.`;

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
        chrome.storage.local.get("ai_settings_global", (res) => {
          resolve(res["ai_settings_global"] as AiSettings)
        })
      })

      const settings = await getSettings()
      
      const model = settings.model || "gpt-4.1-mini"
      let provider = "openai"
      if (model.includes("gemini")) provider = "gemini"
      else if (model.includes("claude")) provider = "claude"
      else if (model.includes("grok")) provider = "grok"

      const apiKey = settings.apiKeys?.[provider] || settings.apiKey
      if (!apiKey) {
        throw new Error(`설정에서 ${provider.toUpperCase()} API 키를 먼저 등록해주세요.`)
      }

      // Fetch recent valid messages
      const historyCount = settings.historyCount ?? 30
      const recentMessages = await ccf.messages.getRecentMessages(historyCount)

      // Transform messages for OpenAI
      const chatHistory = recentMessages.map((msg: any) => {
        const speaker = msg.type === "system" ? "System" : (msg.name || "Unknown")
        return {
          role: "user" as const,
          content: `[${speaker}]: ${msg.text || ""}`
        }
      })

      // We append the GM hint to the system prompt
      const basePrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT
      const finalSystemPrompt = hint ? `${basePrompt}\n\n${hint}` : basePrompt

      const reply = await ccf.ai.generateReply(
        apiKey,
        finalSystemPrompt,
        chatHistory,
        model
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
