// contents/inject.ts
import type { PlasmoCSConfig } from "plasmo"

import { applyMajorBattleDiceResult } from "../major-battle/dice-roll13.0"
import type { CcReq, CcRes } from "../utils/types"
import { buildAPI } from "./inject/api"
import {
  getServices,
  stealReduxStore,
  stealWebpackRequire
} from "./inject/hijack"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}

const processedMessageIds = new Set<string>()

function init() {
  try {
    stealWebpackRequire()
    window.__MY_REDUX = stealReduxStore()
  } catch (e) {}

  // API 객체 생성 및 Window에 노출
  window.ccfoliaAPI = buildAPI()

  installRpcBridge()
  startMessageListener()
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

      const safeValue =
        value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined

      // reply({ id: data.id, type: "ccfolia:result", ok: true, value })
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

export function startMessageListener() {
  // 💡 즉시 실행하지 않고, Store가 준비될 때까지 1초마다 재시도합니다.
  const checkInterval = setInterval(() => {
    try {
      const services = getServices()
      if (services && services.store) {
        clearInterval(checkInterval) // 타이머 종료
        console.log(
          "%c[CCFOLIA-API] 🎲 Redux Store 준비됨! 주사위 감시를 시작합니다.",
          "color: #ff9800"
        )

        // 💡 Store가 확보되었으므로 실제 구독(Subscribe) 시작
        initSubscription(services.store)
      }
    } catch (e) {
      // getServices 내부 에러 무시하고 다음 주기에 재시도
    }
  }, 1000)
}

function initSubscription(store: any) {
  const state = store.getState()
  // 주의: 페이지 첫 로드 시 uid나 roomId가 아직 없을 수도 있으므로,
  // subscribe 내부에서 매번 최신 state를 가져와서 평가하는 것이 안전합니다.

  store.subscribe(() => {
    const currentState = store.getState()

    // app state가 완전히 로드되지 않은 초기 상태 방어
    if (currentState.app?.state?.loading || !currentState.app?.state?.roomId)
      return
    const myUid = currentState.app.state.uid
    const roomId = currentState.app.state.roomId
    const roomOwner = currentState.entities.rooms?.entities[roomId]?.owner
    const amIGM = myUid === roomOwner

    const messagesEntity = currentState.entities.roomMessages?.entities
    if (!messagesEntity) return

    const messageIds = currentState.entities.roomMessages.ids
    const recentIds = messageIds.slice(-5)

    recentIds.forEach((msgId: string) => {
      if (processedMessageIds.has(msgId)) return

      const msg = messagesEntity[msgId]
      if (!msg || !msg.extend || !msg.extend.roll) return

      if (msg.extend.roll.critical) {
        processedMessageIds.add(msgId)
        return
      }

      const msgOwner = msg.uid || msg.owner

      if (msgOwner === myUid) {
        processedMessageIds.add(msgId)
        applyMajorBattleDiceResult(msgId, msg)
      } else if (amIGM) {
        const delay = 1000
        setTimeout(() => {
          const checkState = store.getState()
          const currentMsg = checkState.entities.roomMessages?.entities[msgId]

          if (!currentMsg || currentMsg.extend?.roll?.critical) {
            processedMessageIds.add(msgId)
            return
          }

          console.log(
            `[API-GM] 바닐라 플레이어의 주사위를 대신 처리합니다: ${msgId}`
          )
          processedMessageIds.add(msgId)
          applyMajorBattleDiceResult(msgId, currentMsg)
        }, delay)
      } else {
        processedMessageIds.add(msgId)
      }
    })
  })
}

init()
