// scripts/set-icon.js
const fs = require("fs")
const path = require("path")

const sourcePath = path.resolve(__dirname, `assets/icon-majorbattle.png`)
const targetPath = path.resolve(__dirname, "assets/icon.png")

// 4. 선택된 아이콘을 icon.png로 복사(덮어쓰기) 합니다.
try {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath)
    console.log(
      `🎨 [Icon Manager] 확장 프로그램 아이콘이 'icon-majorbattle.png'(으)로 설정되었습니다.`
    )
  } else {
    console.warn(
      `⚠️ [Icon Manager] 원본 아이콘을 찾을 수 없습니다: ${sourcePath}`
    )
  }
} catch (error) {
  console.error("❌ 아이콘 복사 중 에러 발생:", error)
}
