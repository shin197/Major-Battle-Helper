import { getServices } from "../hijack"

let lastHoveredTokenId: string | null = null

export const tokens = {
  getAll: () => {
    const { store, roomId } = getServices()
    const state = store.getState()
    const roomItems = state.entities.roomItems
    const roomDecks = state.entities.roomDecks
    const roomDices = state.entities.roomDices
    const roomCharacters = state.entities.roomCharacters
    const roomMarkers = Object.values(
      state.entities.rooms.entities[roomId].markers || {}
    )

    const tokens = [
      ...roomItems.ids.map((id: string) => roomItems.entities[id]),
      ...roomDecks.ids.map((id: string) => roomDecks.entities[id]),
      ...roomDices.ids.map((id: string) => roomDices.entities[id]),
      ...roomCharacters.ids.map((id: string) => roomCharacters.entities[id]),
      ...roomMarkers
    ]
    return tokens
  },

  /**
   * 2. 특정 ID의 토큰(아이템, 덱, 다이스, 캐릭터, 마커) 정보 가져오기
   */
  getById: (itemId: string) => {
    const { store } = getServices()
    const state = store.getState()
    const roomId = state.app.state.roomId

    // getAll()에서 참조하는 5곳의 엔티티 그룹에서 순차적으로 ID를 조회합니다.
    return (
      state.entities.roomItems?.entities[itemId] ||
      state.entities.roomDecks?.entities[itemId] ||
      state.entities.roomDices?.entities[itemId] ||
      state.entities.roomCharacters?.entities[itemId] ||
      state.entities.rooms?.entities[roomId]?.markers?.[itemId] ||
      null
    )
  },

  /**
   * 3. 마우스 호버링 토큰 인스펙터 (토글)
   */
  toggleInspector: () => {
    if ((window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE) {
      // 끄기
      document.removeEventListener("mousemove", tokenHoverHandler)
      document.removeEventListener("click", tokenClickHandler)
      ;(window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE = false
      console.log("%c[API] 🕵️‍♂️ 토큰 인스펙터 OFF", "color: gray")
    } else {
      // 켜기
      document.addEventListener("mousemove", tokenHoverHandler)
      document.addEventListener("click", tokenClickHandler)
      ;(window as any).__CCFOLIA_TOKEN_INSPECTOR_ACTIVE = true
      console.log(
        "%c[API] 🕵️‍♂️ 토큰 인스펙터 ON - 캐릭터/다이스/덱/아이템 위에 마우스를 올리세요.",
        "color: #006400"
      )
    }
  }
}
const tokenHoverHandler = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const itemId = findItemIdFromDom(target)

  if (itemId && itemId !== lastHoveredTokenId) {
    lastHoveredTokenId = itemId
    const token = tokens.getById(itemId)

    if (token) {
      console.log(
        `%c[Found Token] ${token.name || "No Name"} (${itemId})`,
        "color: #006400",
        token
      )

      // 시각적 피드백
      target.style.outline = "2px solid #00ff0d"
      setTimeout(() => (target.style.outline = ""), 500)
    }
  }
}

const tokenClickHandler = (e: MouseEvent) => {
  // 클릭 시 해당 토큰 정보 고정 출력 (Deep copy)
  const target = e.target as HTMLElement
  const itemId = findItemIdFromDom(target)
  if (itemId) {
    const token = tokens.getById(itemId)
    if (token) {
      console.log(
        `%c[Clicked Token] ${itemId}`,
        "color: #005c8e; font-weight:bold;",
        JSON.parse(JSON.stringify(token))
      )
    }
  }
}

const findReactProps = (dom: HTMLElement): any => {
  const key = Object.keys(dom).find((k) => k.startsWith("__reactFiber$"))
  // @ts-ignore
  return key ? dom[key] : null
}

const findItemIdFromDom = (target: HTMLElement | null): string | null => {
  let curr = target
  while (curr && curr !== document.body) {
    const fiber = findReactProps(curr)
    if (fiber) {
      let node = fiber
      while (node) {
        const props = node.memoizedProps
        if (props) {
          // 1. ID 값만 넘겨받는 경우
          const idFromProp =
            props.itemId ||
            props.characterId ||
            props.diceId ||
            props.deckId ||
            props.markerId

          if (idFromProp) return idFromProp

          // 2. draggableId 방식 추가!
          if (props.draggableId && typeof props.draggableId === "string") {
            // 여기서 id를 반환합니다.
            return props.draggableId
          }
        }

        node = node.return // 부모 컴포넌트로 이동
      }
    }
    curr = curr.parentElement
  }
  return null
}
