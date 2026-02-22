export const findReactProps = (dom: HTMLElement): any => {
  const key = Object.keys(dom).find((k) => k.startsWith("__reactFiber$"))
  // @ts-ignore
  return key ? dom[key] : null
}

export const findItemIdFromDom = (
  target: HTMLElement | null
): string | null => {
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
