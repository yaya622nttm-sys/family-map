# 家族マップ 🗺️

家族の現在地をリアルタイムで共有できるWebアプリです。  
ルームコードを共有するだけで家族全員の位置が地図上にリアルタイム表示されます。

---

## ✨ 機能

| 機能 | 詳細 |
|------|------|
| 📍 リアルタイム位置共有 | Firebase Realtime DB でメンバーの位置がリアルタイム更新 |
| 🎨 カスタムアイコン | 12種の絵文字プリセット＋スマホの写真をアップロード可能 |
| 🔑 ルームコード方式 | 6文字のコードで家族だけが参加（認証不要）|
| 🗺️ カスタムピン | 名前＋アイコン付きの吹き出し型マーカー |
| 📱 スマホ対応 | モバイルファーストのレスポンシブデザイン |
| 🌙 ダークUI | 地図に映えるダーク系オーバーレイ |

---

## 🚀 Netlify へのデプロイ手順（推奨）

### Step 1 — Firebase プロジェクトを作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」→ 任意の名前（例：`family-map-app`）
3. Google アナリティクス：OFF でも可

### Step 2 — Realtime Database を有効化

1. 左メニュー「構築」→「Realtime Database」
2. 「データベースを作成」
3. リージョン：`asia-southeast1（シンガポール）` を選択
4. セキュリティルール：「テストモードで開始」→「完了」

**ルールを以下に変更**（「ルール」タブ → 「公開」）:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        "members": {
          "$userId": {
            ".read": "auth == null",
            ".write": "auth == null"
          }
        }
      }
    }
  }
}
```

### Step 3 — Firebase 設定値を取得

1. Firebase Console → 歯車アイコン → 「プロジェクトの設定」
2. 「マイアプリ」→「ウェブアプリを追加」（`</>`アイコン）
3. アプリ名：`family-map-web`、Firebase Hosting：OFF
4. 「アプリを登録」後に表示される `firebaseConfig` の値をコピー

### Step 4 — Google Maps API キーを取得

1. [Google Cloud Console](https://console.cloud.google.com/)
2. Firebase と同じプロジェクトを選択（または自動作成されたもの）
3. 「APIとサービス」→「ライブラリ」→「**Maps JavaScript API**」→「有効にする」
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」
5. 作成されたキーをコピー

> **セキュリティ推奨**: 「APIキーを制限」→ HTTP リファラーに `https://あなたのサイト.netlify.app/*` を追加

### Step 5 — GitHub にリポジトリを作成してプッシュ

```bash
cd familymap-web
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/あなたのGitHubユーザー名/family-map.git
git push -u origin main
```

### Step 6 — Netlify でサイトを作成

1. [Netlify](https://app.netlify.com/) にログイン
2. 「Add new site」→「Import an existing project」
3. GitHub を選択 → リポジトリを選択
4. ビルド設定（自動検出されるはずですが確認）:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. 「**Add environment variables**」を展開して以下を登録：

| キー | 値 |
|------|----|
| `VITE_MAPS_API_KEY` | Google Maps APIキー |
| `VITE_FIREBASE_API_KEY` | Firebase `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | Firebase `databaseURL`（`https://...firebasedatabase.app` の形式）|
| `VITE_FIREBASE_PROJECT_ID` | Firebase `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Firebase `appId` |

6. 「Deploy site」をクリック → 2〜3分でデプロイ完了！

---

## 💻 ローカル開発

```bash
# 依存関係インストール
npm install

# .env.local を作成
cp .env.example .env.local
# .env.local を開いて各値を設定

# 開発サーバー起動（http://localhost:5173）
npm run dev

# ビルド
npm run build

# ビルド結果をプレビュー
npm run preview
```

---

## 📱 使い方

### 初回セットアップ（全員が行う）

1. アプリのURLにアクセス
2. **名前**を入力（最大8文字）
3. **アイコン**を選択（絵文字プリセット or 写真アップロード）
4. ルームを作成 or 参加：
   - **新しいルームを作成** → 6文字のコードが自動生成される
   - **参加** → 家族から共有されたコードを入力

### 地図画面

| 操作 | 機能 |
|------|------|
| 📤 シェアボタン（上部） | ルームコードをコピー or ネイティブシェア |
| 🎯 照準ボタン（上部） | 自分の現在地にカメラを移動 |
| 下部のメンバーチップ | タップでそのメンバーの位置にジャンプ |
| ドアアイコン（上部） | ルームから退出 |

---

## 📁 プロジェクト構成

```
familymap-web/
├── public/
│   └── favicon.svg
├── src/
│   ├── lib/
│   │   ├── firebase.js    Firebase Realtime DB ヘルパー
│   │   ├── storage.js     localStorage ヘルパー
│   │   └── image.js       画像圧縮・絵文字→canvas 変換
│   ├── screens/
│   │   ├── setup.js       セットアップ画面
│   │   └── map.js         マップ画面（Google Maps + ピン）
│   ├── main.js            エントリーポイント・ルーター
│   └── style.css          全スタイル
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml           Netlify ビルド設定
└── .env.example           環境変数サンプル
```

---

## ⚠️ 注意事項

- **位置情報**: ブラウザから「位置情報を許可」してください（HTTP では動作しません。必ず HTTPS の URL で使用）
- **データ**: 認証なし構成のため、ルームコードを知っている人は誰でも参加できます
- **画像**: アップロードした写真は 80×80px に圧縮されて Firebase に保存されます
- **オフライン**: ネットワーク切断中は位置情報の送信が停止しますが、地図の閲覧は継続できます
