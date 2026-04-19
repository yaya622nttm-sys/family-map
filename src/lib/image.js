// ─────────────────────────────────────────────────────────────
// 画像アップロード・圧縮ユーティリティ
// ─────────────────────────────────────────────────────────────

/**
 * File オブジェクトを 80×80 の円形クロップ済み base64 に変換する
 * @param {File} file
 * @returns {Promise<string>} base64 data URL
 */
export function compressToCircle(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const SIZE = 80
        const canvas = document.createElement('canvas')
        canvas.width  = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')

        // 円形クリップ
        ctx.beginPath()
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
        ctx.clip()

        // 中央クロップで正方形に収める
        const side = Math.min(img.width, img.height)
        const sx   = (img.width  - side) / 2
        const sy   = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)

        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * 絵文字を 80×80 の canvas に描画して base64 に変換する
 * @param {string} emoji
 * @param {string} bgColor  背景色 hex
 * @returns {string} base64 data URL
 */
export function emojiToBase64(emoji, bgColor = '#4285F4') {
  const SIZE = 80
  const canvas = document.createElement('canvas')
  canvas.width  = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // 背景円
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
  ctx.fillStyle = bgColor
  ctx.fill()

  // 絵文字
  ctx.font = '42px serif'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, SIZE / 2, SIZE / 2 + 2)

  return canvas.toDataURL('image/png')
}
