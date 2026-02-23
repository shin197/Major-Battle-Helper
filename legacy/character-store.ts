// localStorage 전용 동기 스토어 (await 없음)
// 파일명: characterStore.simple.ts

// ===== 타입 =====
export type CharacterData = {
  name: string
  initiative: number
  iconUrl: string
  faces: { iconUrl: string; label: string }[]
  status: { label: string; cur: number; max: number }[]
  params: { label: string; value: string }[]
}
