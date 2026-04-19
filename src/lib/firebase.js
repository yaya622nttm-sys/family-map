// ─────────────────────────────────────────────────────────────
// Firebase Realtime Database ヘルパー
//
// データ構造:
//   rooms/{roomCode}/members/{userId}
//     name, iconData, lat, lng, ts
//   rooms/{roomCode}/history/{userId}/{pushKey}
//     lat, lng, ts
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
  off,
} from 'firebase/database'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

let app, db

function getDB() {
  if (!db) {
    app = initializeApp(firebaseConfig)
    db  = getDatabase(app)
  }
  return db
}

// ── 自分の位置情報・アイコンを書き込む ─────────────────────
export async function updateMember(roomCode, userId, data) {
  const database = getDB()
  const memberRef = ref(database, `rooms/${roomCode}/members/${userId}`)
  await set(memberRef, {
    ...data,
    ts: Date.now(),
  })
}

// ── ルームの全メンバーをリアルタイム購読 ───────────────────
// callback(members: Array<{userId, name, iconData, lat, lng, ts}>)
export function subscribeMembers(roomCode, callback) {
  const database = getDB()
  const membersRef = ref(database, `rooms/${roomCode}/members`)

  onValue(membersRef, (snapshot) => {
    const members = []
    snapshot.forEach((child) => {
      members.push({ userId: child.key, ...child.val() })
    })
    callback(members)
  })

  // 購読解除関数を返す
  return () => off(membersRef)
}

// ── ルームの存在確認（参加時）──────────────────────────────
// membersノードは全員退出後に消えてしまうため、
// コード形式チェックのみ行う（存在しないルームは参加後に自動生成される）
export async function roomExists(roomCode) {
  return /^[A-Z0-9]{6}$/.test(roomCode)
}

// ── メンバー削除（退出時）──────────────────────────────────
export async function removeMember(roomCode, userId) {
  const database = getDB()
  await set(ref(database, `rooms/${roomCode}/members/${userId}`), null)
}

// ── 移動履歴を1件書き込む ────────────────────────────────────
export async function writeHistory(roomCode, userId, lat, lng) {
  const database = getDB()
  await set(push(ref(database, `rooms/${roomCode}/history/${userId}`)), {
    lat, lng, ts: Date.now(),
  })
}

// ── ルーム全員の過去7日分の移動履歴を取得 ───────────────────
// 戻り値: { [userId]: [{lat, lng, ts}, ...] } ts昇順
export async function loadHistory(roomCode) {
  const database = getDB()
  const snap = await get(ref(database, `rooms/${roomCode}/history`))
  if (!snap.exists()) return {}

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const result = {}
  snap.forEach((userSnap) => {
    const pts = []
    userSnap.forEach((ptSnap) => {
      const d = ptSnap.val()
      if (d.ts > weekAgo) pts.push({ lat: d.lat, lng: d.lng, ts: d.ts })
    })
    if (pts.length) result[userSnap.key] = pts.sort((a, b) => a.ts - b.ts)
  })
  return result
}
