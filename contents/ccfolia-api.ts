import { get } from "http"

import type { CcfoliaCharacter } from "../utils/types"

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// 공용 RPC 호출기
function ccfoliaRPC<T = any>(method: string, ...args: any[]): Promise<T> {
  const id = uuid()

  // 🚨 [추가] 발신 로그
  // console.log(`%c[RPC 📤] ${method} 호출 시도`, "color: #3b82f6", args)

  return new Promise<T>((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return
      const data = ev.data
      if (!data || data.type !== "ccfolia:result" || data.id !== id) return

      window.removeEventListener("message", onMsg)
      if (data.ok) resolve(data.value as T)
      else reject(new Error(data.error))
    }

    window.addEventListener("message", onMsg)
    window.postMessage({ id, type: "ccfolia:call", method, args }, "*")

    setTimeout(() => {
      window.removeEventListener("message", onMsg)
      reject(new Error(`ccfolia RPC timeout on method: ${method}`))
    }, 5000)
  })
}

/**
 * 다른 Content Scripts 에서 자유롭게 가져다 쓸 수 있는
 * 강력하게 타이핑된 API 래퍼입니다.
 */
export const ccf = {
  // ccf.characters
  characters: {
    getCharacters: (filterType: "all" | "active" | "mine" | "status" = "all") =>
      ccfoliaRPC<CcfoliaCharacter[]>("characters.getCharacters", filterType),
    getByName: (namePart: string) =>
      ccfoliaRPC<CcfoliaCharacter | undefined>(
        "characters.getByName",
        namePart
      ),
    getById: (charId: string) =>
      ccfoliaRPC<CcfoliaCharacter | undefined>("characters.getById", charId),
    setStatus: (namePart: string, labelPart: string, valueDiff: number) =>
      ccfoliaRPC<void>("characters.setStatus", namePart, labelPart, valueDiff),
    setParam: (namePart: string, labelPart: string, newValue: string) =>
      ccfoliaRPC<void>("characters.setParam", namePart, labelPart, newValue),
    toggleProp: (namePart: string, prop: "active" | "invisible" | "secret") =>
      ccfoliaRPC<void>("characters.toggleProp", namePart, prop),
    setCommands: (namePart: string, newCommands: string) =>
      ccfoliaRPC<void>("characters.setCommands", namePart, newCommands),
    patch: (
      namePart: string,
      updates: {
        status?: Record<string, number>
        params?: Record<string, string>
      }
    ) => ccfoliaRPC<void>("characters.patch", namePart, updates)
  },
  getCharacters: (filterType: "all" | "active" | "mine" | "status" = "all") =>
    ccfoliaRPC<CcfoliaCharacter[]>("characters.getCharacters", filterType),

  getCharacterByName: (namePart: string) =>
    ccfoliaRPC<CcfoliaCharacter | undefined>("characters.getByName", namePart),

  getCharacterById: (charId: string) =>
    ccfoliaRPC<CcfoliaCharacter | undefined>("characters.getById", charId),

  setCharacterStatus: (
    namePart: string,
    labelPart: string,
    valueDiff: number
  ) => ccfoliaRPC<void>("characters.setStatus", namePart, labelPart, valueDiff),

  setCharacterParam: (namePart: string, labelPart: string, newValue: string) =>
    ccfoliaRPC<void>("characters.setParam", namePart, labelPart, newValue),

  toggleCharacterProp: (
    namePart: string,
    prop: "active" | "invisible" | "secret"
  ) => ccfoliaRPC<void>("characters.toggleProp", namePart, prop),

  setCharacterCommands: async (namePart: string, newCommands: string) =>
    ccfoliaRPC<void>("characters.setCommands", namePart, newCommands),

  patchCharacter: async (
    namePart: string,
    updates: {
      status?: Record<string, number>
      params?: Record<string, string>
    }
  ) => ccfoliaRPC<void>("characters.patch", namePart, updates),

  // ccf.tokens

  tokens: {
    // 중첩된 객체도 문자열 "items.getAll" 형태로 호출
    getAll: () => ccfoliaRPC<any[]>("tokens.getAll"),
    getById: (itemId: string) => ccfoliaRPC<any>("tokens.getById", itemId),
    toggleInspector: () => ccfoliaRPC<void>("tokens.toggleInspector")
  },
  getAllTokens: () => ccfoliaRPC<any[]>("tokens.getAll")
}
