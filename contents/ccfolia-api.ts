// contents/ccfolia-api.ts
import type { CcfoliaCharacter } from "../utils/types"

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// 공용 RPC 호출기
export function callCcfolia<T = any>(
  method: string,
  ...args: any[]
): Promise<T> {
  const id = uuid()

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
export const apiConfig = {
  getCharacters: (filterType: "all" | "active" | "mine" | "status" = "all") =>
    callCcfolia<CcfoliaCharacter[]>("getCharacters", filterType),

  getChar: (namePart: string) =>
    callCcfolia<CcfoliaCharacter | undefined>("getChar", namePart),

  getCharacterById: (charId: string) =>
    callCcfolia<CcfoliaCharacter | undefined>("getCharacterById", charId),

  setStatus: (namePart: string, labelPart: string, valueDiff: number) =>
    callCcfolia<void>("setStatus", namePart, labelPart, valueDiff),

  setParam: (namePart: string, labelPart: string, newValue: string) =>
    callCcfolia<void>("setParam", namePart, labelPart, newValue),

  toggleProp: (namePart: string, prop: "active" | "invisible" | "secret") =>
    callCcfolia<void>("toggleProp", namePart, prop),

  setCommands: async (namePart: string, newCommands: string) =>
    callCcfolia<void>("setCommands", namePart, newCommands),

  patchCharacter: async (
    namePart: string,
    updates: {
      status?: Record<string, number>
      params?: Record<string, string>
    }
  ) => callCcfolia<void>("patchCharacter", namePart, updates),

  tokens: {
    // 중첩된 객체도 문자열 "items.getAll" 형태로 호출
    getAll: () => callCcfolia<any[]>("tokens.getAll"),
    getById: (itemId: string) => callCcfolia<any>("tokens.getById", itemId),
    toggleInspector: () => callCcfolia<void>("tokens.toggleInspector")
  }
}

// 사용 예시 (개발 시 주석 처리 또는 테스트용 파일로 분리)
// setTimeout(async () => {
//   const chars = await apiConfig.getCharacters("all");
//   console.log("Fetched via strongly-typed RPC:", chars);
//
//   const items = await apiConfig.items.getAll();
//   console.log("Room Items:", items);
// }, 5000);
