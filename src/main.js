// ─────────────────────────────────────────────────────────────
// エントリーポイント & SPA ルーター
// ─────────────────────────────────────────────────────────────
import { loadUser } from './lib/storage.js'
import { mountSetup } from './screens/setup.js'
import { mountMap }   from './screens/map.js'

function router() {
  const user = loadUser()

  if (user?.name && user?.iconData && user?.roomCode) {
    // セットアップ済み → マップへ
    mountMap(user, () => router())
  } else {
    // 未セットアップ → セットアップへ
    mountSetup((newUser) => {
      mountMap(newUser, () => router())
    })
  }
}

// アプリ起動
router()
