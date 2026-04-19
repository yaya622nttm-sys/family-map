// ─────────────────────────────────────────────────────────────
// localStorage ラッパー
// ─────────────────────────────────────────────────────────────
const KEY = 'familymap_user'

export function saveUser(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function loadUser() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearUser() {
  localStorage.removeItem(KEY)
}

// ── ユーザーID 生成（初回のみ）──────────────────────────────
export function ensureUserId() {
  const user = loadUser()
  if (user?.userId) return user.userId
  const userId = crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18)
  saveUser({ ...user, userId })
  return userId
}
