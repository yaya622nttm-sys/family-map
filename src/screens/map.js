// ─────────────────────────────────────────────────────────────
// マップ画面
//  - Google Maps AdvancedMarkerElement でカスタムアイコンピン
//  - Firebase リアルタイム購読でメンバー位置を更新
//  - Geolocation watchPosition で自分の位置を継続送信
// ─────────────────────────────────────────────────────────────
import { updateMember, subscribeMembers, removeMember } from '../lib/firebase.js'
import { saveUser, clearUser }                          from '../lib/storage.js'

const MAPS_API_KEY = import.meta.env.VITE_MAPS_API_KEY

// Google Maps API をロード（一度だけ）
let mapsApiLoaded = false
function loadMapsApi() {
  if (mapsApiLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=marker&v=beta`
    script.async = true
    script.defer = true
    script.onload  = () => { mapsApiLoaded = true; resolve() }
    script.onerror = () => reject(new Error('Google Maps の読み込みに失敗しました'))
    document.head.appendChild(script)
  })
}

/**
 * マップ画面を #app にマウントする
 * @param {{ userId, name, iconData, roomCode }} user
 * @param {function} onLogout  ログアウト時コールバック
 */
export async function mountMap(user, onLogout) {
  const app = document.getElementById('app')
  app.innerHTML = getMapHTML(user.roomCode)

  // Google Maps ロード
  try {
    await loadMapsApi()
  } catch (e) {
    document.getElementById('map-error').textContent =
      'Google Maps APIキーを確認してください: ' + e.message
    document.getElementById('map-error').style.display = 'block'
    return
  }

  // マップ初期化
  const map = initMap()

  // マーカー管理
  const markers = new Map()   // userId → AdvancedMarkerElement

  // Firebase 購読
  const unsubscribe = subscribeMembers(user.roomCode, (members) => {
    updateMarkers(map, markers, members, user.userId)
    updateMemberChips(members, user.userId, (targetUserId) => {
      flyToMember(map, markers, targetUserId)
    })
    updateMemberCount(members.length)
  })

  // 自分の位置情報を取得・送信
  startGeolocation(user, map, markers)

  // イベントバインド
  bindMapEvents(user, unsubscribe, onLogout)
}

// ── マップ HTML ─────────────────────────────────────────────

function getMapHTML(roomCode) {
  return `
    <div class="map-container">

      <!-- エラー表示 -->
      <div id="map-error" class="map-error-banner" style="display:none"></div>

      <!-- Google マップ -->
      <div id="gmap"></div>

      <!-- 上部バー -->
      <div class="map-topbar">
        <div class="topbar-left">
          <span class="topbar-logo">📍</span>
          <span class="topbar-title">家族マップ</span>
          <span class="live-badge">LIVE</span>
          <span id="member-count" class="member-count">👥 0人</span>
        </div>
        <div class="topbar-right">
          <button id="btn-share" class="topbar-btn" title="ルームコードをシェア">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="white" stroke-width="1.8"/>
              <circle cx="6"  cy="12" r="3" stroke="white" stroke-width="1.8"/>
              <circle cx="18" cy="19" r="3" stroke="white" stroke-width="1.8"/>
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
                    stroke="white" stroke-width="1.8"/>
            </svg>
          </button>
          <button id="btn-mypos" class="topbar-btn" title="自分の位置へ戻る">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" stroke-width="1.8"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>
          </button>
          <button id="btn-logout" class="topbar-btn topbar-btn--danger" title="ログアウト">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ルームコードバナー（初回のみ表示） -->
      <div id="room-banner" class="room-banner">
        <span>ルームコード：<strong id="room-code-text">${roomCode}</strong></span>
        <button id="btn-copy-code" class="copy-btn">コピー</button>
        <button id="btn-close-banner" class="banner-close">✕</button>
      </div>

      <!-- 位置情報許可中インジケーター -->
      <div id="geo-status" class="geo-status">📡 現在地を取得中…</div>

      <!-- 下部メンバーチップ -->
      <div id="member-chips" class="member-chips"></div>

      <!-- シェアモーダル -->
      <div id="share-modal" class="modal-overlay" style="display:none">
        <div class="modal-card">
          <button id="modal-close" class="modal-close">✕</button>
          <h2 class="modal-title">ルームコードをシェア</h2>
          <p class="modal-sub">家族にこのコードを伝えてください</p>
          <div class="modal-code">${roomCode}</div>
          <div class="modal-actions">
            <button id="modal-copy" class="btn btn-primary">📋 コピー</button>
            <button id="modal-share" class="btn btn-outline">🔗 シェア</button>
          </div>
        </div>
      </div>

    </div>
  `
}

// ── Google マップ初期化 ────────────────────────────────────

function initMap() {
  return new google.maps.Map(document.getElementById('gmap'), {
    center:            { lat: 35.6812, lng: 139.7671 },
    zoom:              14,
    disableDefaultUI:  true,
    zoomControl:       true,
    mapId:             'DEMO_MAP_ID', // AdvancedMarkerElement に必要
    gestureHandling:   'greedy',
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
    ],
  })
}

// ── カスタムマーカー作成 ───────────────────────────────────

function createPinElement(member, isMe) {
  const outer = document.createElement('div')
  outer.className = 'map-pin' + (isMe ? ' map-pin--me' : '')
  if (isMe) outer.setAttribute('data-me', '1')

  // アイコン画像
  const img = document.createElement('img')
  img.src       = member.iconData || ''
  img.alt       = member.name
  img.className = 'map-pin__icon'

  // 名前ラベル
  const label = document.createElement('div')
  label.className   = 'map-pin__label'
  label.textContent = member.name

  // しっぽ（三角）
  const tail = document.createElement('div')
  tail.className = 'map-pin__tail'

  outer.appendChild(img)
  outer.appendChild(label)
  outer.appendChild(tail)

  // 5分以上更新なし → 半透明
  const age = Date.now() - (member.ts || 0)
  if (age > 5 * 60 * 1000) {
    outer.classList.add('map-pin--stale')
  }

  return outer
}

// ── マーカー更新 ───────────────────────────────────────────

function updateMarkers(map, markersMap, members, myUserId) {
  const activIds = new Set(members.map(m => m.userId))

  // 消えたメンバーを削除
  for (const [uid, marker] of markersMap) {
    if (!activIds.has(uid)) {
      marker.map = null
      markersMap.delete(uid)
    }
  }

  members.forEach((member) => {
    if (!member.lat || !member.lng) return
    const pos   = { lat: member.lat, lng: member.lng }
    const isMe  = member.userId === myUserId

    if (markersMap.has(member.userId)) {
      // 位置とアイコン更新
      const marker = markersMap.get(member.userId)
      marker.position = pos
      // ピン要素を差し替え
      const newEl = createPinElement(member, isMe)
      marker.content = newEl
    } else {
      // 新規マーカー
      const pinEl = createPinElement(member, isMe)
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        content:  pinEl,
        title:    member.name,
        zIndex:   isMe ? 999 : undefined,
      })
      markersMap.set(member.userId, marker)
    }
  })
}

// ── メンバーチップ更新 ─────────────────────────────────────

function updateMemberChips(members, myUserId, onChipClick) {
  const container = document.getElementById('member-chips')
  container.innerHTML = ''

  members.forEach((member) => {
    const isMe  = member.userId === myUserId
    const stale = Date.now() - (member.ts || 0) > 5 * 60 * 1000
    const chip  = document.createElement('button')
    chip.className = 'member-chip' + (isMe ? ' member-chip--me' : '') + (stale ? ' member-chip--stale' : '')
    chip.innerHTML = `
      <img src="${member.iconData || ''}" alt="${member.name}" class="chip-icon" />
      <span class="chip-name">${member.name}${isMe ? '（自分）' : ''}</span>
      ${stale ? '<span class="chip-stale">5分以上更新なし</span>' : ''}
    `
    chip.addEventListener('click', () => onChipClick(member.userId))
    container.appendChild(chip)
  })
}

function flyToMember(map, markersMap, userId) {
  const marker = markersMap.get(userId)
  if (!marker?.position) return
  map.panTo(marker.position)
  map.setZoom(16)
}

function updateMemberCount(count) {
  const el = document.getElementById('member-count')
  if (el) el.textContent = `👥 ${count}人`
}

// ── 自分の位置情報 ─────────────────────────────────────────

function startGeolocation(user, map, markersMap) {
  const geoStatus = document.getElementById('geo-status')

  if (!navigator.geolocation) {
    geoStatus.textContent = '⚠️ このブラウザは位置情報に対応していません'
    return
  }

  let firstFix = true

  const watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      geoStatus.style.display = 'none'

      const { latitude: lat, longitude: lng } = pos.coords

      // 最新の iconData を localStorage から読む
      const { loadUser } = await import('../lib/storage.js')
      const saved = loadUser()

      try {
        await updateMember(user.roomCode, user.userId, {
          name:     user.name,
          iconData: user.iconData,
          lat,
          lng,
        })
      } catch { /* オフライン時は無視 */ }

      // 初回取得時はカメラを自分の位置へ
      if (firstFix) {
        firstFix = false
        map.panTo({ lat, lng })
        map.setZoom(15)
      }
    },
    (err) => {
      geoStatus.textContent = `⚠️ 位置情報が取得できません（${getGeoErrorMsg(err)}）`
      geoStatus.style.display = 'block'
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )

  // クリーンアップ用にグローバルに持つ
  window._geoWatchId = watchId
}

function getGeoErrorMsg(err) {
  switch (err.code) {
    case 1: return '位置情報の使用を許可してください'
    case 2: return '位置情報を取得できませんでした'
    case 3: return 'タイムアウトしました'
    default: return '不明なエラー'
  }
}

// ── ボタンイベント ─────────────────────────────────────────

function bindMapEvents(user, unsubscribe, onLogout) {
  // シェアボタン
  document.getElementById('btn-share').addEventListener('click', () => {
    document.getElementById('share-modal').style.display = 'flex'
  })

  // モーダルを閉じる
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('share-modal').style.display = 'none'
  })
  document.getElementById('share-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'
  })

  // コードコピー（モーダル内）
  document.getElementById('modal-copy').addEventListener('click', () => {
    copyToClipboard(user.roomCode, 'ルームコードをコピーしました')
  })

  // ネイティブシェア
  document.getElementById('modal-share').addEventListener('click', () => {
    const text = `家族マップに参加しよう！\nルームコード：${user.roomCode}\n${location.origin}`
    if (navigator.share) {
      navigator.share({ title: '家族マップ', text })
    } else {
      copyToClipboard(text, 'シェアテキストをコピーしました')
    }
  })

  // バナーのコピーボタン
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    copyToClipboard(user.roomCode, 'ルームコードをコピーしました')
  })

  // バナーを閉じる
  document.getElementById('btn-close-banner').addEventListener('click', () => {
    document.getElementById('room-banner').style.display = 'none'
  })

  // 自分の位置へ戻る
  document.getElementById('btn-mypos').addEventListener('click', () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      map?.panTo({ lat, lng })
    })
  })

  // ログアウト
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (!confirm('ルームを退出しますか？')) return
    try { await removeMember(user.roomCode, user.userId) } catch { /* ignore */ }
    unsubscribe()
    if (window._geoWatchId != null) {
      navigator.geolocation?.clearWatch(window._geoWatchId)
    }
    clearUser()
    onLogout()
  })
}

// ── クリップボード ─────────────────────────────────────────

function copyToClipboard(text, successMsg) {
  navigator.clipboard?.writeText(text)
    .then(() => showToast(successMsg))
    .catch(() => {
      // フォールバック
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      showToast(successMsg)
    })
}

// ── トースト通知 ───────────────────────────────────────────

function showToast(msg) {
  let toast = document.getElementById('toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast'
    toast.className = 'toast'
    document.body.appendChild(toast)
  }
  toast.textContent = msg
  toast.classList.add('toast--show')
  setTimeout(() => toast.classList.remove('toast--show'), 2500)
}
