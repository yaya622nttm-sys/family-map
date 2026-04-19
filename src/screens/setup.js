// ─────────────────────────────────────────────────────────────
// セットアップ画面
//  ① 名前入力
//  ② アイコン選択（プリセット絵文字 or 写真アップロード）
//  ③ 新しいルーム作成 / ルームコードで参加
// ─────────────────────────────────────────────────────────────
import { compressToCircle, emojiToBase64 } from '../lib/image.js'
import { saveUser, ensureUserId }           from '../lib/storage.js'
import { roomExists }                       from '../lib/firebase.js'

// プリセットアイコン（絵文字 + 背景カラー）
const PRESET_ICONS = [
  { emoji: '😊', color: '#4285F4' },
  { emoji: '😎', color: '#EA4335' },
  { emoji: '🐱', color: '#34A853' },
  { emoji: '🐶', color: '#FBBC04' },
  { emoji: '🦊', color: '#FF6D00' },
  { emoji: '🐼', color: '#9C27B0' },
  { emoji: '🐸', color: '#00BCD4' },
  { emoji: '🦁', color: '#E91E63' },
  { emoji: '🐧', color: '#3F51B5' },
  { emoji: '🐻', color: '#795548' },
  { emoji: '🦄', color: '#F06292' },
  { emoji: '🐯', color: '#FF9800' },
]

/**
 * セットアップ画面を #app にマウントする
 * @param {function} onDone  完了時コールバック
 */
export function mountSetup(onDone) {
  const app = document.getElementById('app')
  app.innerHTML = ''
  app.appendChild(buildSetupHTML())
  bindSetupEvents(onDone)
}

// ── HTML 生成 ──────────────────────────────────────────────

function buildSetupHTML() {
  const wrap = document.createElement('div')
  wrap.className = 'setup-wrap'
  wrap.innerHTML = `
    <!-- ヘッダー -->
    <div class="setup-header">
      <div class="setup-logo">📍</div>
      <h1 class="setup-title">家族マップ</h1>
      <p class="setup-sub">家族の現在地をリアルタイムで共有</p>
    </div>

    <!-- カード -->
    <div class="setup-card">

      <!-- Step 1: 名前 -->
      <div class="setup-section">
        <label class="setup-label">
          <span class="step-badge">1</span> あなたの名前
        </label>
        <input
          id="inp-name"
          class="setup-input"
          type="text"
          maxlength="8"
          placeholder="名前を入力（最大8文字）"
          autocomplete="off"
        />
        <p id="err-name" class="setup-error"></p>
      </div>

      <!-- Step 2: アイコン -->
      <div class="setup-section">
        <label class="setup-label">
          <span class="step-badge">2</span> マップに表示するアイコン
        </label>

        <!-- プリセットグリッド -->
        <div class="icon-grid" id="icon-grid">
          ${PRESET_ICONS.map((p, i) => `
            <button
              type="button"
              class="icon-cell ${i === 0 ? 'selected' : ''}"
              data-index="${i}"
              data-emoji="${p.emoji}"
              data-color="${p.color}"
              title="${p.emoji}"
            >
              <span class="icon-emoji" style="background:${p.color}">${p.emoji}</span>
            </button>
          `).join('')}

          <!-- 写真アップロード -->
          <button type="button" class="icon-cell" id="btn-upload" title="写真をアップロード">
            <span class="icon-upload-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V8M8 12l4-4 4 4" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <span>写真</span>
            </span>
          </button>
        </div>

        <!-- 選択中プレビュー -->
        <div class="icon-preview-row">
          <img id="icon-preview" src="" alt="選択中のアイコン" class="icon-preview-img" />
          <span id="icon-preview-label" class="icon-preview-label">アイコンを選択してください</span>
        </div>

        <input id="inp-upload" type="file" accept="image/*" style="display:none" />
      </div>

      <!-- Step 3: ルーム -->
      <div class="setup-section">
        <label class="setup-label">
          <span class="step-badge">3</span> ルームを選択
        </label>

        <!-- 新規作成 -->
        <button id="btn-create" class="btn btn-primary">
          ＋ 新しいルームを作成
        </button>

        <div class="divider"><span>または</span></div>

        <!-- 参加 -->
        <div class="join-row">
          <input
            id="inp-code"
            class="setup-input join-input"
            type="text"
            maxlength="6"
            placeholder="6文字のルームコード"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="btn-join" class="btn btn-outline">参加</button>
        </div>
        <p id="err-code" class="setup-error"></p>
      </div>

    </div><!-- /card -->

    <!-- ローディングオーバーレイ -->
    <div id="setup-loading" class="loading-overlay" style="display:none">
      <div class="spinner"></div>
      <p>接続中…</p>
    </div>
  `
  return wrap
}

// ── イベント ───────────────────────────────────────────────

function bindSetupEvents(onDone) {
  let selectedIconData = null  // base64

  // 初期選択（プリセット0番）
  const first = PRESET_ICONS[0]
  selectedIconData = emojiToBase64(first.emoji, first.color)
  updatePreview(selectedIconData, first.emoji)

  // プリセット選択
  document.getElementById('icon-grid').addEventListener('click', async (e) => {
    const cell = e.target.closest('.icon-cell')
    if (!cell || cell.id === 'btn-upload') return

    document.querySelectorAll('.icon-cell').forEach(c => c.classList.remove('selected'))
    cell.classList.add('selected')

    const emoji = cell.dataset.emoji
    const color = cell.dataset.color
    selectedIconData = emojiToBase64(emoji, color)
    updatePreview(selectedIconData, emoji)
  })

  // 写真アップロード
  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('inp-upload').click()
  })

  document.getElementById('inp-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      showLoading(true)
      const compressed = await compressToCircle(file)
      selectedIconData = compressed
      document.querySelectorAll('.icon-cell').forEach(c => c.classList.remove('selected'))
      document.getElementById('btn-upload').classList.add('selected')
      updatePreview(selectedIconData, '写真')
    } catch {
      alert('画像の読み込みに失敗しました')
    } finally {
      showLoading(false)
    }
  })

  // ルームコード → 大文字変換
  document.getElementById('inp-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase()
    document.getElementById('err-code').textContent = ''
  })

  // 名前入力 → エラークリア
  document.getElementById('inp-name').addEventListener('input', () => {
    document.getElementById('err-name').textContent = ''
  })

  // ── 新規ルーム作成 ──
  document.getElementById('btn-create').addEventListener('click', async () => {
    const name = document.getElementById('inp-name').value.trim()
    if (!validateName(name)) return
    if (!selectedIconData) { alert('アイコンを選択してください'); return }

    const roomCode = generateRoomCode()
    finishSetup({ name, iconData: selectedIconData, roomCode }, onDone)
  })

  // ── ルーム参加 ──
  document.getElementById('btn-join').addEventListener('click', async () => {
    const name = document.getElementById('inp-name').value.trim()
    const code = document.getElementById('inp-code').value.trim().toUpperCase()

    if (!validateName(name)) return
    if (!selectedIconData) { alert('アイコンを選択してください'); return }

    if (code.length !== 6) {
      document.getElementById('err-code').textContent = '6文字のコードを入力してください'
      return
    }

    showLoading(true)
    try {
      const exists = await roomExists(code)
      if (!exists) {
        document.getElementById('err-code').textContent =
          'ルームが見つかりません。コードを確認してください'
        return
      }
      finishSetup({ name, iconData: selectedIconData, roomCode: code }, onDone)
    } catch {
      document.getElementById('err-code').textContent =
        '接続エラーが発生しました。再度お試しください'
    } finally {
      showLoading(false)
    }
  })
}

// ── ヘルパー ───────────────────────────────────────────────

function validateName(name) {
  if (!name) {
    document.getElementById('err-name').textContent = '名前を入力してください'
    document.getElementById('inp-name').focus()
    return false
  }
  return true
}

function updatePreview(iconData, label) {
  const img = document.getElementById('icon-preview')
  const lbl = document.getElementById('icon-preview-label')
  img.src = iconData
  lbl.textContent = label
}

function showLoading(show) {
  document.getElementById('setup-loading').style.display = show ? 'flex' : 'none'
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function finishSetup({ name, iconData, roomCode }, onDone) {
  const userId = ensureUserId()
  saveUser({ userId, name, iconData, roomCode })
  onDone({ userId, name, iconData, roomCode })
}
