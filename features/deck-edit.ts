import { ccf } from "~core/isolated/ccfolia-api"
import { generateRandomId } from "~utils/utils"
import { openMultiImagePicker } from "./multi-image-picker"

export async function injectDeckEditor(form: HTMLElement, deckId: string) {
  if (form.querySelector("#mb-deck-editor")) return

  const deckData = await ccf.decks.getById(deckId)
  if (!deckData) return

  // 덱 아이템 가져오기
  // { [cardId]: { imageUrl, memo } }
  let items = deckData.items || {}

  // 전체 컨테이너 생성
  const container = document.createElement("div")
  container.id = "mb-deck-editor"
  Object.assign(container.style, {
    marginTop: "24px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  })

  // 헤더 툴바 (MuiToolbar-root)
  const headerToolbar = document.createElement("div")
  headerToolbar.className = "MuiToolbar-root MuiToolbar-dense css-mjywep"

  const headerTitle = document.createElement("h6")
  headerTitle.className = "MuiTypography-root MuiTypography-subtitle2 sc-eQxmfS lhqHqS css-hf8y9a"
  headerTitle.textContent = "카드 목록"
  headerTitle.style.flexGrow = "1"
  headerToolbar.appendChild(headerTitle)

  const addBtn = document.createElement("button")
  addBtn.className = "MuiButtonBase-root MuiIconButton-root MuiIconButton-edgeEnd MuiIconButton-sizeSmall css-hr9wpe"
  addBtn.tabIndex = 0
  addBtn.type = "button"
  addBtn.setAttribute("aria-label", "추가")
  addBtn.innerHTML = `
    <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-vubbuv" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="AddIcon">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
    </svg>
    <span class="MuiTouchRipple-root css-w0pj6f"></span>
  `
  headerToolbar.appendChild(addBtn)
  container.appendChild(headerToolbar)

  addBtn.addEventListener("click", async () => {
    const selectedImages = await openMultiImagePicker()
    if (selectedImages && selectedImages.length > 0) {
      for (const img of selectedImages) {
        const newCardId = generateRandomId()
        // 파일 이름(@표정이름)에서 골뱅이를 제거하고 메모로 사용
        const memoName = img.label.startsWith("@") ? img.label.substring(1) : img.label
        const newItem = { imageUrl: img.iconUrl, memo: memoName }
        items[newCardId] = newItem

        // UI 즉시 추가 렌더링
        listContainer.appendChild(renderItem(newCardId, newItem))
      }

      // 파이어베이스 동기화
      await saveItems()
    }
  })

  // 아이템 리스트 컨테이너
  const listContainer = document.createElement("div")
  listContainer.style.display = "flex"
  listContainer.style.flexDirection = "column"
  listContainer.style.gap = "8px"
  container.appendChild(listContainer)

  // Firebase 업데이트 헬퍼
  const saveItems = async () => {
    await ccf.decks.update(deckId, { items })
  }

  // 아이템 렌더링 함수
  const renderItem = (cardId: string, itemData: { imageUrl: string; memo: string }) => {
    const row = document.createElement("div")
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "rgba(255,255,255,0.05)",
      padding: "8px",
      borderRadius: "4px"
    })

    // 1. 이미지 버튼 (아바타)
    const imgBtn = document.createElement("button")
    imgBtn.type = "button"
    imgBtn.className = "MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall css-xfvph6"

    const avatarWrapper = document.createElement("div")
    avatarWrapper.className = "MuiAvatar-root MuiAvatar-circular css-3i9vrz"
    Object.assign(avatarWrapper.style, {
      width: "32px",
      height: "32px",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      overflow: "hidden"
    })

    if (itemData.imageUrl) {
      const img = document.createElement("img")
      img.src = itemData.imageUrl
      img.className = "MuiAvatar-img css-1hy9t21"
      img.style.width = "100%"
      img.style.height = "100%"
      img.style.objectFit = "cover"
      avatarWrapper.appendChild(img)
    } else {
      avatarWrapper.textContent = "IMG"
      avatarWrapper.style.fontSize = "12px"
    }

    imgBtn.appendChild(avatarWrapper)

    // 이미지 클릭 시 피커 호출
    imgBtn.addEventListener("click", async () => {
      const newUrl = await ccf.app.openImagePicker()
      if (newUrl) {
        itemData.imageUrl = newUrl
        items[cardId] = itemData

        // 뷰 업데이트
        avatarWrapper.innerHTML = ""
        const newImg = document.createElement("img")
        newImg.src = newUrl
        newImg.className = "MuiAvatar-img css-1hy9t21"
        newImg.style.width = "100%"
        newImg.style.height = "100%"
        newImg.style.objectFit = "cover"
        avatarWrapper.appendChild(newImg)

        await saveItems()
      }
    })

    row.appendChild(imgBtn)

    // 2. 텍스트 입력 (메모/이름) - MUI 의존성 없는 커스텀 스타일
    const inputWrapper = document.createElement("div")
    Object.assign(inputWrapper.style, {
      position: "relative",
      flexGrow: "1",
      marginTop: "16px",
      marginBottom: "8px"
    })

    // 네이티브 스타일 라벨
    const inputLabel = document.createElement("label")
    Object.assign(inputLabel.style, {
      position: "absolute",
      top: "-18px",
      left: "0",
      fontSize: "12px",
      color: "rgba(255, 255, 255, 0.7)",
      transition: "color 0.2s"
    })
    inputLabel.textContent = "메모"

    const inputBase = document.createElement("div")
    Object.assign(inputBase.style, {
      position: "relative",
      display: "flex",
      alignItems: "center",
      borderBottom: "2px solid rgba(255, 255, 255, 0.7)",
      transition: "border-bottom 0.2s"
    })

    const input = document.createElement("textarea")
    input.rows = 4
    Object.assign(input.style, {
      width: "100%",
      background: "none",
      border: "none",
      outline: "none",
      color: "inherit",
      padding: "4px 0 5px",
      fontSize: "1rem",
      fontFamily: "inherit"
    })
    input.placeholder = "메모"
    input.value = itemData.memo || ""

    // Focus 애니메이션
    input.addEventListener("focus", () => {
      inputLabel.style.color = "rgb(33, 150, 243)"
      inputBase.style.borderBottom = "2px solid rgb(33, 150, 243)"
      inputBase.style.paddingBottom = "0px" // border 2px 보정
    })
    input.addEventListener("blur", () => {
      inputLabel.style.color = "rgba(255, 255, 255, 0.7)"
      inputBase.style.borderBottom = "2px solid rgba(255, 255, 255, 0.42)"
      inputBase.style.paddingBottom = "0px"
    })

    // 입력 변경 시 자동 저장
    input.addEventListener("change", async () => {
      itemData.memo = input.value
      items[cardId] = itemData
      await saveItems()
    })

    inputBase.appendChild(input)
    inputWrapper.appendChild(inputLabel)
    inputWrapper.appendChild(inputBase)
    row.appendChild(inputWrapper)

    // 3. 공개 꺼내기 버튼
    const extractPubBtn = document.createElement("button")
    extractPubBtn.type = "button"
    extractPubBtn.className = "MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall css-xfvph6"
    extractPubBtn.title = "공개 꺼내기"
    extractPubBtn.innerHTML = `
      <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-vubbuv" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="VisibilityIcon">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path>
      </svg>
      <span class="MuiTouchRipple-root css-w0pj6f"></span>
    `
    extractPubBtn.addEventListener("click", async () => {
      try {
        await ccf.decks.extractCard(deckId, cardId, false)
        delete items[cardId]
        row.remove()
      } catch (err) {
        console.error("공개 꺼내기 실패", err)
      }
    })

    // 4. 비공개 꺼내기 버튼
    const extractPrivBtn = document.createElement("button")
    extractPrivBtn.type = "button"
    extractPrivBtn.className = "MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall css-xfvph6"
    extractPrivBtn.title = "비공개 꺼내기"
    extractPrivBtn.innerHTML = `
      <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-vubbuv" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="VisibilityOffIcon">
        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"></path>
      </svg>
      <span class="MuiTouchRipple-root css-w0pj6f"></span>
    `
    extractPrivBtn.addEventListener("click", async () => {
      try {
        await ccf.decks.extractCard(deckId, cardId, true)
        delete items[cardId]
        row.remove()
      } catch (err) {
        console.error("비공개 꺼내기 실패", err)
      }
    })

    // 5. 삭제 버튼
    const delBtn = document.createElement("button")
    delBtn.type = "button"
    delBtn.className = "MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall css-xfvph6"
    delBtn.title = "삭제"
    delBtn.innerHTML = `
      <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-vubbuv" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="DeleteIcon">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
      </svg>
      <span class="MuiTouchRipple-root css-w0pj6f"></span>
    `
    delBtn.addEventListener("click", async () => {
      delete items[cardId]
      row.remove()
      await saveItems()
    })

    const actionsWrap = document.createElement("div")
    actionsWrap.style.display = "flex"
    actionsWrap.style.gap = "4px"
    actionsWrap.appendChild(extractPubBtn)
    actionsWrap.appendChild(extractPrivBtn)
    actionsWrap.appendChild(delBtn)

    row.appendChild(actionsWrap)

    return row
  }

  // 초기 렌더링
  for (const cardId of Object.keys(items)) {
    listContainer.appendChild(renderItem(cardId, items[cardId]))
  }



  form.appendChild(container)
}
