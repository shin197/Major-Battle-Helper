import { getServices } from "../hijack"

function generateFirestoreId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let autoId = ""
  for (let i = 0; i < 20; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return autoId
}

function getMessageContext(store: any) {
  const state = store.getState()
  const rm = state.entities?.roomMessages
  const rc = state.entities?.roomCharacters

  const uid = state.app?.state?.uid || state.app?.user?.uid || null

  let speakingChar = null
  if (rc?.ids) {
    for (const id of rc.ids) {
      const char = rc.entities[id]
      if (char?.speaking) {
        speakingChar = char
        break
      }
    }
  }

  let channel = ""
  let channelName = ""
  if (rm?.ids?.length > 0) {
    const lastId = rm.ids[rm.ids.length - 1]
    const last = rm.entities[lastId]
    if (last) {
      channel = last.channel || ""
      channelName = last.channelName || ""
    }

    if (uid) {
      for (let i = rm.ids.length - 1; i >= 0; i--) {
        const entity = rm.entities[rm.ids[i]]
        if (entity?.from === uid) {
          return {
            name: speakingChar?.name || entity.name || "",
            channel: entity.channel || channel,
            channelName: entity.channelName || channelName,
            color: speakingChar?.color || entity.color || "#e0e0e0",
            iconUrl: speakingChar?.iconUrl || entity.iconUrl || "",
            from: uid
          }
        }
      }
    }
  }

  return {
    name: speakingChar?.name || "",
    channel: channel,
    channelName: channelName,
    color: speakingChar?.color || "#e0e0e0",
    iconUrl: speakingChar?.iconUrl || "",
    from: uid || "system"
  }
}

function _detectCurrentChannel(store: any) {
  try {
    if (store) {
      const appState = store.getState().app
      const ch =
        appState?.chat?.channel ||
        appState?.state?.channel ||
        appState?.chat?.channelId ||
        appState?.state?.channelId
      const chName = appState?.chat?.channelName || appState?.state?.channelName
      if (ch !== undefined && ch !== null) {
        return { channel: ch || "", channelName: chName || "" }
      }
    }

    const BUILTIN_CHANNELS = [
      { channel: "main", channelName: "main" },
      { channel: "info", channelName: "info" },
      { channel: "other", channelName: "other" }
    ]

    let chatTabs = null
    let selectedIdx = -1
    let selectedText = ""

    const textarea = document.querySelector('textarea[name="text"]')
    if (textarea) {
      let node = textarea.parentElement
      for (let i = 0; i < 30 && node; i++) {
        const tablist = node.querySelector('[role="tablist"]')
        if (tablist) {
          chatTabs = tablist.querySelectorAll('[role="tab"]')
          break
        }
        if (node.parentElement) {
          for (const sibling of node.parentElement.children) {
            if (sibling === node) continue
            const tl = sibling.querySelector('[role="tablist"]')
            if (tl) {
              chatTabs = tl.querySelectorAll('[role="tab"]')
              break
            }
          }
        }
        if (chatTabs) break
        node = node.parentElement
      }
    }

    if (!chatTabs) {
      const allTabs = document.querySelectorAll('[role="tab"]')
      for (const tab of allTabs) {
        if (tab.getAttribute("aria-selected") === "true") {
          let container = tab.parentElement
          for (let j = 0; j < 10 && container; j++) {
            if (container.querySelector('textarea[name="text"]')) {
              const parent = tab.parentElement
              if (parent) chatTabs = parent.querySelectorAll('[role="tab"]')
              break
            }
            container = container.parentElement
          }
        }
        if (chatTabs) break
      }
    }

    if (!chatTabs || chatTabs.length === 0) return null

    chatTabs.forEach((tab, idx) => {
      if (
        tab.getAttribute("aria-selected") === "true" ||
        tab.classList.contains("Mui-selected")
      ) {
        selectedIdx = idx
        selectedText = tab.textContent?.trim() || ""
      }
    })

    if (selectedIdx < 0) return null

    if (selectedIdx < BUILTIN_CHANNELS.length) {
      return BUILTIN_CHANNELS[selectedIdx]
    }

    if (selectedText && store) {
      const rm = store.getState().entities?.roomMessages
      if (rm?.ids) {
        const BUILTIN_IDS = ["", "main", "info", "other"]
        for (let i = rm.ids.length - 1; i >= 0; i--) {
          const entity = rm.entities?.[rm.ids[i]]
          if (!entity) continue
          if (entity.type === "system" || entity.name === "system") continue
          if (
            entity.channelName === selectedText &&
            entity.channel &&
            !BUILTIN_IDS.includes(entity.channel)
          ) {
            return { channel: entity.channel, channelName: selectedText }
          }
        }
      }
    }
  } catch (e) {
    //
  }
  return null
}

export const messages = {
  /**
   * 모든 메시지 목록을 가져옵니다. (tokens.ts의 getAll과 유사)
   */
  getAll: () => {
    const { store } = getServices()
    const state = store.getState()

    const roomMessages = state.entities.roomMessages
    if (!roomMessages) return []

    return roomMessages.ids.map((id: string) => roomMessages.entities[id])
  },

  /**
   * 내부용: 공통 Firestore 메시지 전송 로직
   */
  _sendDirectMessage: async (text: string, overrides?: any) => {
    console.log("[API] _sendDirectMessage 호출됨", { text, overrides })
    const { fsTools, db, roomId, store } = getServices()
    const { setDoc, doc, collection } = fsTools

    try {
      const ctx = getMessageContext(store)
      console.log("[API] getMessageContext 결과:", ctx)

      // doc() 에 명시적으로 ID 부여
      const messageRef = doc(
        collection(db, "rooms", roomId, "messages"),
        generateFirestoreId()
      )
      console.log("[API] messageRef 생성됨", messageRef)

      const payload: any = {
        text: text,
        type: "text",
        name: ctx.name || "",
        color: ctx.color || "#e0e0e0",
        iconUrl: ctx.iconUrl || "",
        imageUrl: null,
        from: ctx.from || "system",
        to: null,
        toName: "",
        extend: {},
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        channel: "",
        channelName: ""
      }

      const chInfo = _detectCurrentChannel(store)
      if (chInfo) {
        payload.channel = chInfo.channel || ""
        payload.channelName = chInfo.channelName || ""
      } else if (ctx.channel) {
        payload.channel = ctx.channel || ""
        payload.channelName = ctx.channelName || ""
      }

      if (overrides) Object.assign(payload, overrides)
      console.log("[API] 최종 payload:", payload)

      await setDoc(messageRef, payload)
      console.log("[API] setDoc 완료!")
      return true
    } catch (error) {
      console.error("[API] 메시지 전송 실패:", error)
      return false
    }
  },

  /**
   * 시스템 메시지를 전송합니다.
   * @param text 전송할 텍스트
   * @param channel (Optional) 전송할 채널 정보
   */
  sendSystemMessage: async (
    text: string,
    channel?: { channel: string; channelName: string }
  ) => {
    console.log("[API] sendSystemMessage 호출됨", text, channel)
    const overrides: any = {
      name: "system",
      type: "system",
      color: "#888888",
      iconUrl: null
    }
    if (channel) {
      overrides.channel = channel.channel
      overrides.channelName = channel.channelName
    }
    return messages._sendDirectMessage(text, overrides)
  },

  /**
   * 특정 캐릭터의 이름, 아이콘, 색상으로 메시지를 전송합니다.
   */
  sendMessageAsChar: async (
    text: string,
    charName: string,
    iconUrl: string = "",
    color: string = "#e0e0e0"
  ) => {
    console.log("[API] sendMessageAsChar 호출됨", text, charName)
    return messages._sendDirectMessage(text, {
      name: charName,
      iconUrl,
      color
    })
  },

  /**
   * 주사위를 특정 캐릭터로 직접 굴립니다. (Firestore 직접 기록)
   */
  sendDiceAsChar: async (
    notation: string, // 예: "1D20" 또는 "1D20+3"
    label: string,
    charName: string
  ) => {
    const { store } = getServices()
    const diceMatch = notation.match(/^(\d+)[dD](\d+)(?:([+\-])(\d+))?$/)
    if (!diceMatch) return false

    const count = parseInt(diceMatch[1], 10)
    const sides = parseInt(diceMatch[2], 10)
    const bonus = diceMatch[4]
      ? parseInt(diceMatch[4], 10) * (diceMatch[3] === "-" ? -1 : 1)
      : 0

    const dices = []
    let sum = 0
    for (let i = 0; i < count; i++) {
      const val = Math.floor(Math.random() * sides) + 1
      dices.push({ faces: sides, value: val })
      sum += val
    }
    const total = sum + bonus

    const diceStr = `(${notation.toUpperCase()})`
    const resultStr = `${diceStr} ＞ ${total}`

    let iconUrl = ""
    let color = "#e0e0e0"
    if (charName) {
      const rc = store.getState().entities?.roomCharacters
      if (rc?.ids) {
        for (const id of rc.ids) {
          const c = rc.entities[id]
          if (c && c.name === charName) {
            iconUrl = c.iconUrl || ""
            color = c.color || "#e0e0e0"
            break
          }
        }
      }
    }

    const text = label
      ? `${notation.toUpperCase()} ${label}`
      : notation.toUpperCase()

    const overrides = {
      name: charName,
      iconUrl,
      color,
      extend: {
        roll: {
          result: resultStr,
          dices: dices,
          critical: false,
          fumble: false,
          success: false,
          failure: false,
          secret: false,
          skin: {}
        }
      }
    }
    return messages._sendDirectMessage(text, overrides)
  },

  /**
   * 특정 메시지를 삭제합니다.
   * @param messageId 삭제할 메시지의 ID
   */
  delete: async (messageId: string) => {
    const { fsTools, db, roomId } = getServices()
    const { deleteDoc, doc, collection } = fsTools

    try {
      const messageRef = doc(
        collection(db, "rooms", roomId, "messages"),
        messageId
      )
      await deleteDoc(messageRef)
      return true
    } catch (error) {
      console.error("[API] 메시지 삭제 실패:", error)
      return false
    }
  },

  /**
   * 특정 메시지의 텍스트를 수정합니다.
   */
  edit: async (messageId: string, newText: string) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    try {
      const messageRef = doc(
        collection(db, "rooms", roomId, "messages"),
        messageId
      )
      await setDoc(messageRef, { text: newText, updatedAt: Date.now() }, { merge: true })
      return true
    } catch (error) {
      console.error("[API] 메시지 수정 실패:", error)
      return false
    }
  },

  /**
   * 특정 메시지의 주사위 굴림 결과를 Firestore에 직접 업데이트하여 모든 유저에게 동기화합니다.
   * @param messageId 조작할 메시지의 ID
   * @param newResultText 변경할 주사위 결과 텍스트 (예: "1D100<=50 ＞ 99 ＞ 펌블")
   * @param options 성공/실패/크리티컬/펌블 여부 덮어쓰기
   */
  modifyRollResult: async (
    messageId: string,
    newResultText: string,
    options?: {
      success?: boolean
      failure?: boolean
      critical?: boolean
      fumble?: boolean
    }
  ) => {
    // 💡 1. hijack.ts에서 탈취한 Firestore 도구들 가져오기
    const { fsTools, db, roomId, store } = getServices()
    const { setDoc, doc, collection } = fsTools
    const state = store.getState()

    // 💡 2. 기존 Redux Store에서 메시지 원본 데이터 확인
    const messagesEntity = state.entities.roomMessages?.entities
    if (!messagesEntity || !messagesEntity[messageId]) {
      console.warn(
        `[CCFOLIA-API] Message ${messageId} not found in local store.`
      )
      return false
    }

    const targetMessage = messagesEntity[messageId]

    // 주사위 굴림(extend.roll) 데이터가 있는지 확인
    if (!targetMessage.extend || !targetMessage.extend.roll) {
      console.warn(
        `[CCFOLIA-API] Message ${messageId} does not have roll data.`
      )
      return false
    }

    // 💡 3. 새로 업데이트할 주사위 데이터 객체 구성
    const updatedRoll = {
      ...targetMessage.extend.roll, // 기존 roll 데이터 유지 (주사위 눈금 등)
      result: newResultText // 결과 텍스트 덮어쓰기
    }

    if (options) {
      if (options.success !== undefined) updatedRoll.success = options.success
      if (options.failure !== undefined) updatedRoll.failure = options.failure
      if (options.critical !== undefined)
        updatedRoll.critical = options.critical
      if (options.fumble !== undefined) updatedRoll.fumble = options.fumble
    }

    // 💡 4. Firestore 업데이트 페이로드 작성
    // 주의: setDoc + merge:true를 사용하더라도 중첩 객체인 extend 내부가 전부 날아갈 수 있으므로,
    // 기존 extend 객체를 풀어서(...) 다시 감싸줍니다.
    const payload = {
      extend: {
        ...targetMessage.extend,
        roll: updatedRoll
      },
      updatedAt: Date.now() // 코코포리아 클라이언트들의 리렌더링 및 동기화를 트리거하기 위해 갱신
    }

    try {
      const messageRef = doc(
        collection(db, "rooms", roomId, "messages"),
        messageId
      )
      await setDoc(messageRef, payload, { merge: true })
      return true
    } catch (error) {
      return false
    }
  }
}

// =====================================================================
// 메시지 DOM 태깅 (branch-world-battle-advice 스타일)
// Redux roomMessages 순서와 DOM 순서를 역방향 매칭하여 data-msg-id 주입
// =====================================================================
let _tagInProgress = false
let _msgTagObserver: MutationObserver | null = null
let _msgTagTimer: any = null
let _watchedMsgList: HTMLElement | null = null

function _tagMessageItems() {
  if (_tagInProgress) return
  _tagInProgress = true

  if (_msgTagObserver) _msgTagObserver.disconnect()

  try {
    const msgList = document.querySelector("ul.MuiList-root") as HTMLElement
    if (!msgList) return

    const allItems = msgList.querySelectorAll(".MuiListItem-root")
    if (allItems.length === 0) return

    const { store } = getServices()
    if (!store) return
    const state = store.getState()
    const rm = state.entities?.roomMessages
    if (!rm || !rm.ids || rm.ids.length === 0) return

    const currentChannel = _detectCurrentChannel(store)

    const channelMsgs: any[] = []
    for (let i = 0; i < rm.ids.length; i++) {
      const id = rm.ids[i]
      const ent = rm.entities?.[id]
      if (!ent) continue
      if (currentChannel && ent.channel && ent.channel !== currentChannel.channel)
        continue
      channelMsgs.push(ent)
    }

    const len = Math.min(allItems.length, channelMsgs.length)
    const domOffset = allItems.length - len
    const msgOffset = channelMsgs.length - len

    for (let i = 0; i < len; i++) {
      const item = allItems[domOffset + i] as HTMLElement
      const msg = channelMsgs[msgOffset + i]
      item.setAttribute("data-msg-id", msg.id || msg._id || "")
      item.setAttribute("data-msg-from", msg.from || msg.name || "")
      item.setAttribute("data-msg-type", msg.type || "text")
    }

    // 내 UID 마킹 (isolated world에서 접근 가능하도록)
    const myUid = state.app?.state?.uid || state.app?.user?.uid || ""
    if (
      myUid &&
      document.documentElement.getAttribute("data-mb-my-uid") !== myUid
    ) {
      document.documentElement.setAttribute("data-mb-my-uid", myUid)
    }

    document.dispatchEvent(new CustomEvent("mb-tags-applied"))
  } catch (e) {
    console.error("[API] 태깅 실패:", e)
  } finally {
    _tagInProgress = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (_msgTagObserver && _watchedMsgList) {
          _msgTagObserver.observe(_watchedMsgList, {
            childList: true,
            subtree: true
          })
        }
      })
    })
  }
}

export function startMessageTagging() {
  _tagMessageItems()

  const msgList = document.querySelector("ul.MuiList-root") as HTMLElement
  if (!msgList) {
    setTimeout(startMessageTagging, 2000)
    return
  }
  _watchedMsgList = msgList

  if (_msgTagObserver) _msgTagObserver.disconnect()
  _msgTagObserver = new MutationObserver(() => {
    if (_msgTagTimer) clearTimeout(_msgTagTimer)
    _msgTagTimer = setTimeout(_tagMessageItems, 250)
  })
  _msgTagObserver.observe(msgList, { childList: true, subtree: true })

  // Redux 구독
  const { store } = getServices()
  if (store) {
    let _prevMsgCount = 0
    store.subscribe(() => {
      const rm = store.getState().entities?.roomMessages
      const count = rm?.ids?.length || 0
      if (count !== _prevMsgCount) {
        _prevMsgCount = count
        if (_msgTagTimer) clearTimeout(_msgTagTimer)
        _msgTagTimer = setTimeout(_tagMessageItems, 100)
      }
    })
  }

  setInterval(() => {
    const currentList = document.querySelector("ul.MuiList-root") as HTMLElement
    if (currentList && currentList !== _watchedMsgList) {
      _watchedMsgList = currentList
      if (_msgTagObserver) _msgTagObserver.disconnect()
      _msgTagObserver.observe(currentList, { childList: true, subtree: true })
      _tagMessageItems()
    }
  }, 500)

  document.addEventListener("mb-retag-messages", () => {
    _tagMessageItems()
  })
}
