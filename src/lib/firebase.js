// ─────────────────────────────────────────────────────────────
// Firebase Realtime Database ヘルパー
//
// データ構造:
//   rooms/{roomCode}/members/{userId}
//     name, iconData, lat, lng, ts
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  off,
  serverTimestamp,
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
