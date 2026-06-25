import { getCurrentCharacterName } from "~features/slot-shortcut"
import { characters } from "./characters"
import { notes } from "./notes"

export const ai = {
  /**
   * Request a chat completion from OpenAI API.
   * @param apiKey The user's OpenAI API Key
   * @param systemPrompt The system prompt configured for the room
   * @param chatHistory The recent messages (formatted for OpenAI)
   * @param model The model to use (default: "gpt-4o-mini")
   */
  /**
   * 내부용: 설정, 노트, 캐릭터 파라미터를 조합하여 최종 시스템 프롬프트를 만듭니다.
   */
  buildContext: (systemPrompt: string, characterId?: string) => {
    let finalSystemPrompt = systemPrompt ? systemPrompt.trim() + "\n\n" : ""

    const allNotes = notes.getAllNotes() as any[]
    const aiNotes = allNotes.filter(n => n.name && n.name.includes("#AI"))
    if (aiNotes.length > 0) {
      finalSystemPrompt += "--- [Scenario Context] ---\n"
      aiNotes.forEach(n => {
        finalSystemPrompt += `${n.name.replace("#AI", "#").trim()}\n${n.text}\n\n`
      })
    }

    if (characterId) {
      const char = characters.getById(characterId) as any
      if (char) {
        finalSystemPrompt += `--- [Character Context: ${char.name}] ---\n`
        finalSystemPrompt += `[절대 규칙] 당신은 이번 턴에 오직 '${char.name}'의 역할만 연기해야 합니다. 절대로 다른 캐릭터(예: 주요 주변 인물 등)의 대사나 행동을 대신 출력하지 마세요.\n`
        const aiParams = (char.params || []).filter((p: any) => p.label && p.label.includes("#AI"))
        if (aiParams.length > 0) {
          aiParams.forEach((p: any) => {
            finalSystemPrompt += `${p.label.replace("#AI", "#").trim()}: ${p.value}\n`
          })
        }

        if (char.commands) {
          const aiCommands = char.commands
            .split("\n")
            .filter((line: string) => line.trim().startsWith("//"))
            .map((line: string) => line.trim().substring(2).trim())

          if (aiCommands.length > 0) {
            finalSystemPrompt += `[추가 설정/메모]\n${aiCommands.join("\n")}\n`
          }
        }
        finalSystemPrompt += "\n"
      }
    }

    return finalSystemPrompt.trim()
  },

  generateReply: async (
    apiKey: string,
    systemPrompt: string,
    chatHistory: Array<{ role: "system" | "user" | "assistant"; content: string; name?: string }>,
    model: string = "gpt-4o-mini"
  ) => {
    if (!apiKey) {
      throw new Error("API Key is missing. Please configure it in the extension settings.")
    }

    const { getServices } = require("../hijack")
    const store = getServices()?.store
    if (!store) throw new Error("Redux store not found")

    const state = store.getState()

    // const activeCharacterId = state.app?.state?.roomChatId
    const activeCharacterName = state.app?.state?.roomChatName
    const activeCharacterId = characters.getByName(activeCharacterName).id

    const messages = []
    const finalSystemPrompt = ai.buildContext(systemPrompt, activeCharacterId)

    if (finalSystemPrompt !== "") {
      messages.push({ role: "system", content: finalSystemPrompt })
    }

    messages.push(...chatHistory)

    console.log(finalSystemPrompt, messages)

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `OpenAI API Error: ${response.status}`)
      }

      const data = await response.json()
      console.log(data)
      let reply = data.choices?.[0]?.message?.content || ""

      // 응답에서 "[캐릭터명]: " 또는 "캐릭터명: " 접두사 자동 제거 (코코포리아 포맷 맞춤)
      reply = reply.trim()

      // 1. [아무이름]: 패턴 제거 (예: [메튜]: "안녕")
      reply = reply.replace(/^\[[^\n\]]+\]\s*:\s*/, "")

      // 2. 활성화된 캐릭터명: 패턴 제거 (예: 메튜: "안녕")
      if (activeCharacterName) {
        const nameRegex = new RegExp(`^${activeCharacterName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*:\\s*`, "i")
        reply = reply.replace(nameRegex, "")
      }

      // 간혹 남는 따옴표가 어색할 수 있으므로, 대사가 따옴표로만 감싸져 있다면 그것도 벗겨주는게 좋을 수 있지만
      // 유저가 따옴표 출력을 선호할 수 있으므로 여기서는 접두사만 확실하게 제거합니다.

      return reply.trim()
    } catch (error: any) {
      console.error("[BattleHelper AI]", error)
      throw error
    }
  },

  /**
   * F12 콘솔 등에서 AI 프롬프트가 어떻게 만들어지는지 확인하는 용도의 메서드
   * ccfoliaAPI.ai.generatePrompt() 형태로 인자 없이 호출 가능합니다.
   */
  generatePrompt: async () => {
    const { getServices } = require("../hijack")
    const store = getServices()?.store
    if (!store) throw new Error("Redux store not found")

    const state = store.getState()
    const roomId = state.app?.state?.roomId
    if (!roomId) throw new Error("방에 접속해 있지 않습니다.")

    // 1. Isolated 세계에 AI 설정값 요청
    const getAiSettings = () => new Promise<any>((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data?.type === "MBH_PROVIDE_AI_SETTINGS") {
          window.removeEventListener("message", listener)
          resolve(event.data.aiSettings)
        }
      }
      window.addEventListener("message", listener)
      window.postMessage({ type: "MBH_REQUEST_AI_SETTINGS", roomId }, "*")
    })

    const settings = await getAiSettings()
    const systemPrompt = settings?.systemPrompt || ""

    // const activeCharacterId = state.app?.state?.roomChatId
    const rc = state.entities?.roomCharacters

    // 3. 채팅창에 GM이 적은 힌트 텍스트 가져오기
    const textarea = document.querySelector('textarea[name="text"]') as HTMLTextAreaElement
    const currentText = textarea ? textarea.value.trim() : ""

    let activeCharacterName = state.app?.state?.roomChatName || "지정된 캐릭터"

    const hint = currentText
      ? `다음은 당신이 연기할 캐릭터인 '${activeCharacterName}'에게 GM이 전달하는 힌트 또는 대사 예시입니다. 이 의도를 살려서 분위기에 맞게 창작해보세요:\n${currentText}`
      : `당신이 연기할 캐릭터는 '${activeCharacterName}'입니다. 분위기에 맞게 창작해주세요.`

    const combinedGlobalPrompt = hint ? `${systemPrompt}\n\n${hint}` : systemPrompt

    // 4. 컨텍스트 빌드
    const finalPrompt = ai.buildContext(combinedGlobalPrompt, characters.getByName(activeCharacterName)._id)
    return finalPrompt
  }
}
