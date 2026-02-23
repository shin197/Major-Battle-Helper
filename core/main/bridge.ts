import type { CcReq, CcRes } from "../../utils/types" // 경로 주의
import { buildAPI } from "./api"
import { stealReduxStore, stealWebpackRequire } from "./hijack"

export function initCoreEngine() {
  try {
    stealWebpackRequire()
    window.__MY_REDUX = stealReduxStore()
  } catch (e) {}

  window.ccfoliaAPI = buildAPI()
  installRpcBridge()

  console.log("%c[CCFOLIA-API] Core 엔진 가동 완료", "color: lime")
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
      const safeValue =
        value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined

      reply({ id: data.id, type: "ccfolia:result", ok: true, value: safeValue })
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
