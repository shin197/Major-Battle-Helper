import type { PlasmoCSConfig } from "plasmo"

import { ccf } from "../core/isolated/ccfolia-api" // (경로는 파일 위치에 맞게 수정)

// console.log("API 모듈을 불러왔습니다!", ccf)
export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"], // 도메인에 맞게 수정
  run_at: "document_idle"
}

// console.info("%cContent script loaded", "color: #4caf50")

// // ① 툴바 뱃지
// chrome.action.setBadgeBackgroundColor({ color: "#4caf50" })
// chrome.action.setBadgeText({ text: "ON" })

// contents/debug-probe.ts
chrome.runtime.sendMessage({
  type: "SET_BADGE",
  text: "ON", // 배지 글자
  bg: "#4caf50" // 배경색 바꾸고 싶다면 옵션으로
})
// setTimeout(async () => {
//   console.log("테스트 시작: asdf")

//   try {
//     // const chars = await ccf.getCharacters("all")
//     const chars = await ccf.characters.getCharacters("all")
//     console.log("Fetched via strongly-typed RPC:", chars)

//     // items 관련 함수명이 ccf.tokens.getAll() 로 바뀌셨군요!
//     const items = await ccf.getAllTokens()
//     console.log("Room Items:", items)
//   } catch (error) {
//     // 🚨 에러가 발생하면 여기서 정확한 원인을 출력해 줍니다.
//     console.error("❌ RPC 호출 중 에러 발생:", error)
//   }

//   // try {
//   //   const tokenId = "1993f37cb7a" // 예: "199413f3a0b"

//   //   // x 좌표와 y 좌표 변경 테스트
//   //   await ccf.tokens.patch(tokenId, {
//   //     x: 10,
//   //     y: 10,
//   //     width: 2, // 필요하다면 크기도 변경 가능!
//   //     height: 2
//   //   })

//   //   console.log("토큰 이동 성공!")
//   // } catch (e) {
//   //   console.error("패치 실패:", e)
//   // }

//   try {
//     console.log("🛠️ 토큰 생성/삭제 테스트 시작")

//     // 1. 스크린 패널(roomItem) 생성
//     // (이미지 url은 현재 룸에 업로드된 아무 이미지 URL이나 넣으시면 됩니다)
//     // const newPanelId = await ccf.tokens.create("roomItem", {
//     //   x: 10,
//     //   y: 10,
//     //   z: 1,
//     //   width: 2,
//     //   height: 2,
//     //   imageUrl:
//     //     "https://storage.ccfolia-cdn.net/users/WVlt9khBkddLydSXu6Gn0unTgYj2/files/78f8a058dae473e89f593ece446dbbf11b88bc2d52f80fe26394eefc303b6b26" // 임시 이미지
//     // })
//     // console.log("✅ 생성된 패널 ID:", newPanelId)
//     // const newMarkerId = await ccf.tokens.create("roomMarker", {
//     //   x: 0,
//     //   y: 0,
//     //   z: 1,
//     //   width: 2,
//     //   height: 2,
//     //   imageUrl:
//     //     "https://storage.ccfolia-cdn.net/users/WVlt9khBkddLydSXu6Gn0unTgYj2/files/78f8a058dae473e89f593ece446dbbf11b88bc2d52f80fe26394eefc303b6b26" // 임시 이미지
//     // })
//     // console.log("✅ 생성된 마커 ID:", newMarkerId)

//     // // 2. 2초 뒤에 위치 이동 (Patch 테스트)
//     // setTimeout(async () => {
//     //   await ccf.tokens.patch(newPanelId, { x: 15, y: 15 })
//     //   console.log("✅ 패널 이동 완료")
//     // }, 2000)

//     // 3. 4초 뒤에 삭제 (Delete 테스트)
//     // setTimeout(async () => {
//     //   await ccf.tokens.delete(newPanelId)
//     //   console.log("✅ 패널 삭제 완료")
//     // }, 4000)

//     // window.ccfoliaAPI.messages.modifyRollResult(
//     //   "3qwsaHGh8Y1W3olDYVMX",
//     //   "1D100<=50 ＞ 1 ＞ 결정적 성공",
//     //   {
//     //     success: true,
//     //     critical: true,
//     //     failure: false,
//     //     fumble: false
//     //   }
//     // )
//   } catch (error) {
//     console.error("❌ 테스트 중 에러:", error)
//   }
// }, 5000)
