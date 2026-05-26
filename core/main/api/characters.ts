import type { CcfoliaCharacter } from "~utils/types"
import { generateRandomId } from "~utils/utils"

import { getServices } from "../hijack"

export const characters = {
  getCharacters: (
    filterType: "all" | "active" | "mine" | "status" = "all"
  ): CcfoliaCharacter[] => {
    const { store, selectors, rc } = getServices()
    const state = store.getState()

    // 1. Selector 모듈을 찾았다면 활용 (더 정확함)
    if (selectors) {
      let ids: string[] = []
      if (filterType === "active")
        ids = selectors.getRoomActiveCharacterIds(state)
      else if (filterType === "mine")
        ids = selectors.getMyRoomCharacterIds(state)
      else if (filterType === "status")
        ids = selectors.getRoomShowStatusCharacterIds(state)
      else ids = selectors.getRoomCharacterIds(state) // all
      return ids.map((id) => rc.entities[id]).filter(Boolean)
    }

    // 2. 못 찾았다면 수동 필터링 (Fallback)
    else {
      let chars = rc.ids.map((id: string) => rc.entities[id])
      if (filterType === "active") chars = chars.filter((c: any) => c.active)
      if (filterType === "mine") {
        const myUid = state.app.state.uid // 현재 내 UID
        chars = chars.filter((c: any) => c.owner === myUid)
      }
      return chars
    }
  },

  create: async (data: any = {}) => {
    const { fsTools, db, roomId, store } = getServices()
    const { addDoc, setDoc, doc, collection } = fsTools
    const state = store.getState()

    // 컬렉션 참조 생성
    const colRef = collection(db, "rooms", roomId, "characters")

    // 1. 템플릿 준비
    let template: any = {
      name: "",
      status: [{ label: "HP", value: 0, max: 0 }],
      params: [],
      active: true,
      secret: false,
      invisible: false,
      hideStatus: false,
      memo: "",
      externalUrl: "",
      color: "#888888",
      owner: state.app.state.uid, // 내 캐릭터로 생성
    }

    template = {
      ...template,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // 2. addDoc을 사용하여 새 문서 생성 (ID 자동 부여)
    const docRef = await addDoc(colRef, template)
    console.log(`[API] 캐릭터 생성 완료: ${template.name}, ID: ${docRef.id}`)

    return docRef.id
  },

  update: async (charId: string, payload: any) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools
    const target = characters.getById(charId)
    if (!target) throw new Error(`'${charId}' 캐릭터 없음`)
    const ref = doc(collection(db, "rooms", roomId, "characters"), target._id)
    await setDoc(ref, { ...payload, updatedAt: Date.now() }, { merge: true })
    console.log(`[API] ${target.name} 업데이트 완료`)
  },

  /**
   * [삭제] 캐릭터 삭제
   */
  delete: async (charId: string) => {
    const { fsTools, db, roomId } = getServices()
    const { doc, collection, deleteDoc } = fsTools // deleteDoc 사용

    if (!deleteDoc) throw new Error("deleteDoc 함수를 찾을 수 없습니다.")

    const target = characters
      .getCharacters("all")
      .find((c: any) => c._id === charId)
    if (!target) throw new Error(`'${charId}' 캐릭터 없음`)

    if (!confirm(`정말 '${target.name}' 캐릭터를 삭제하시겠습니까?`)) return

    const ref = doc(collection(db, "rooms", roomId, "characters"), target._id)
    await deleteDoc(ref)
    console.log(`[API] ${target.name} 삭제 완료`)
  },

  /**
   * 캐릭터 이름으로 캐릭터 객체 찾기
   */
  getByName: (name: string): CcfoliaCharacter | undefined => {
    const { rc } = getServices()
    return rc.ids
      .map((id: string) => rc.entities[id])
      .find((c: CcfoliaCharacter) => c.name === name)
  },

  getById: (charId: string): CcfoliaCharacter | undefined => {
    const { rc } = getServices()
    return rc.entities[charId]
  },

  /**
   * 캐릭터의 특정 스테이터스(HP, MP, SAN 등) 값 변경
   * - namePart: 캐릭터 이름
   * - labelPart: 스테이터스 라벨 (예: "HP", "정신력")
   * - value: 설정할 값
   */
  setStatus: async (name: string, labelPart: string, value: number) => {
    const { fsTools, db, roomId, rc } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getByName(name)
    if (!target) throw new Error(`캐릭터 '${name}'를 찾을 수 없습니다.`)

    const newStatus = target.status.map((s) => {
      if (s.label.includes(labelPart)) {
        let val = value
        return { ...s, value: val }
      }
      return s
    })

    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )
    await setDoc(
      targetRef,
      { status: newStatus, updatedAt: Date.now() },
      { merge: true }
    )
    console.log(`[API] ${target.name}: ${labelPart} -> ${value}`)
  },

  /**
   * 캐릭터의 파라미터(텍스트) 변경 (STR, DEX, 메모 등)
   * - newValue: 문자열로 입력해야 함
   */
  setParam: async (name: string, labelPart: string, newValue: string) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getByName(name)
    if (!target) throw new Error(`캐릭터 '${name}'를 찾을 수 없습니다.`)

    const newParams = target.params.map((p) => {
      if (p.label === labelPart) {
        return { ...p, value: newValue }
      }
      return p
    })

    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )
    await setDoc(
      targetRef,
      { params: newParams, updatedAt: Date.now() },
      { merge: true }
    )
    console.log(`[API] ${target.name}: ${labelPart} -> ${newValue}`)
  },

  /**
   * 캐릭터 속성 토글 (맵 표시, 투명화, 비밀 등)
   * - prop: 'active' | 'invisible' | 'secret'
   */
  toggleProp: async (
    namePart: string,
    prop: "active" | "invisible" | "secret" | "hideStatus"
  ) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getByName(namePart)
    if (!target) throw new Error(`캐릭터 '${namePart}'를 찾을 수 없습니다.`)

    const newValue = !target[prop]
    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )

    const payload: any = { updatedAt: Date.now() }
    payload[prop] = newValue

    await setDoc(targetRef, payload, { merge: true })
    console.log(`[API] ${target.name}: ${prop} -> ${newValue}`)
  },

  togglePropById: async (
    id: string,
    prop: "active" | "invisible" | "secret" | "hideStatus"
  ) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getById(id)
    if (!target) throw new Error(`캐릭터 '${id}'를 찾을 수 없습니다.`)

    const newValue = !target[prop]
    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )

    const payload: any = { updatedAt: Date.now() }
    payload[prop] = newValue

    await setDoc(targetRef, payload, { merge: true })
    console.log(`[API] ${target.name}: ${prop} -> ${newValue}`)
  },

  /**
   * 캐릭터 채팅 명령어(Palette) 수정
   */
  setCommands: async (name: string, newCommands: string) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getByName(name)
    if (!target) throw new Error(`캐릭터 '${name}'를 찾을 수 없습니다.`)

    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )
    await setDoc(
      targetRef,
      { commands: newCommands, updatedAt: Date.now() },
      { merge: true }
    )
    console.log(`[API] ${target.name}: 명령어 수정 완료`)
  },

  patch: async (
    name: string,
    updates: {
      initiative?: number
      status?: Record<string, number>
      params?: Record<string, string>
    }
  ) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    // 1. 캐릭터 찾기
    const target = characters.getByName(name)
    if (!target) throw new Error(`캐릭터 '${name}'를 찾을 수 없습니다.`)

    const updatePayload: any = { updatedAt: Date.now() }
    let hasChanges = false

    // 2. Status 업데이트 처리
    if (updates.initiative) {
      updatePayload.initiative = updates.initiative
      hasChanges = true
    }
    if (updates.status) {
      const newStatus = target.status.map((s: any) => {
        // updates.status 키 중에 s.label을 포함하는 것이 있는지 확인
        // (정확히 일치하는 것을 우선하고, 없으면 포함하는 것을 찾음 - 기존 로직 유지)

        // 정확한 일치 우선 검색
        if (updates.status![s.label] !== undefined) {
          hasChanges = true
          let val = updates.status![s.label]
          // val = Math.max(0, Math.min(val, s.max)) // 필요 시 주석 해제 (0~max 제한)
          return { ...s, value: val }
        }

        return s
      })
      updatePayload.status = newStatus
    }

    // 3. Params 업데이트 처리
    if (updates.params) {
      const newParams = target.params.map((p: any) => {
        if (updates.params![p.label] !== undefined) {
          hasChanges = true
          return { ...p, value: updates.params![p.label] }
        }
        return p
      })
      updatePayload.params = newParams
    }

    // 4. 변경 사항이 있을 때만 Firestore 저장
    if (hasChanges) {
      const targetRef = doc(
        collection(db, "rooms", roomId, "characters"),
        target._id
      )
      await setDoc(targetRef, updatePayload, { merge: true })
      console.log(`[API] Updated ${target.name}:`, updates)
    }
  },

  setFace: async (name: string, face: string) => {
    const { fsTools, db, roomId } = getServices()
    const { setDoc, doc, collection } = fsTools

    const target = characters.getByName(name)
    if (!target) throw new Error(`캐릭터 '${name}'를 찾을 수 없습니다.`)

    const faceUrl = target.faces.find((f) => f.label === face).iconUrl

    const targetRef = doc(
      collection(db, "rooms", roomId, "characters"),
      target._id
    )
    await setDoc(
      targetRef,
      { iconUrl: faceUrl, updatedAt: Date.now() },
      { merge: true }
    )
    console.log(`[API] ${target.name}: 표정 변경 완료`)
  },

  inspect: (name: string) => {
    const char = characters.getByName(name)
    console.log(`[API] Inspect '${name}':`, char)
    return char
  }
}
