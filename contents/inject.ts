// contents/inject.ts
import type { PlasmoCSConfig } from "plasmo"

import type { CcReq, CcRes } from "../utils/types"
import { buildAPI } from "./inject/api"
import { stealReduxStore, stealWebpackRequire } from "./inject/hijack"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}

function init() {
  try {
    stealWebpackRequire()
    window.__MY_REDUX = stealReduxStore()
  } catch (e) {}

  // API 객체 생성 및 Window에 노출
  window.ccfoliaAPI = buildAPI()

  installRpcBridge()
  console.log("%c[CCFOLIA-API] MAIN 컨텍스트 인젝트 완료", "color: lime")
}

function installRpcBridge() {
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window) return
    const data = ev.data as CcReq
    if (!data || data.type !== "ccfolia:call" || !data.id) return

    const reply = (res: CcRes) => window.postMessage(res, "*")

    try {
      const api = window.ccfoliaAPI
      if (!api) throw new Error("ccfoliaAPI not ready")

      // "items.getAll" 처럼 중첩된 메서드 호출을 지원하기 위한 파싱
      const methodPath = data.method.split(".")
      let targetFn = api
      let parentObj = api

      for (const key of methodPath) {
        parentObj = targetFn
        targetFn = targetFn[key]
        if (!targetFn) throw new Error(`Unknown method path: ${data.method}`)
      }

      if (typeof targetFn !== "function")
        throw new Error(`${data.method} is not a function`)

      const value = await targetFn.apply(parentObj, data.args)
      reply({ id: data.id, type: "ccfolia:result", ok: true, value })
    } catch (e: any) {
      reply({
        id: data.id,
        type: "ccfolia:result",
        ok: false,
        error: String(e?.message ?? e)
      })
    }
  })
}

init()
