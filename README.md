# Hanakotoba — 多言語花屋アシスタント

外国人を含む様々な国籍のお客様に、その日の在庫から最適な花を見繕う Web アプリ。

## 機能

- **接客チャット** (`/chat`) — お客様にタブレットを向けて使う。AI がお客様の言語を自動検出し、店員側に日本語で意図を伝えつつ、お客様側にその言語で返答する。在庫の中から候補を写真付きで表示。
- **花を提案** (`/suggest`) — 誕生日・花言葉・色・予算などから絞り込み検索。
- **在庫管理** (`/inventory`) — 当日入荷の登録、写真アップロード、在庫数の更新。

## 技術スタック

- Next.js 15 (App Router) + TypeScript
- Neon Postgres (`@neondatabase/serverless`) — Vercel Storage の Marketplace から1クリックで追加可能
- Vercel Blob (`@vercel/blob`) — 花の写真
- Google AI Studio / Gemini API (`@google/genai`, デフォルトは `gemini-2.5-flash`) — 言語検出・翻訳・花の提案

## API キーの取得 (Google AI Studio)

1. https://aistudio.google.com/app/apikey にアクセス
2. Google アカウントでサインイン
3. **「Create API key」** をクリック → 新規プロジェクトを選ぶか作成
4. 表示された `AIza...` で始まるキーをコピー
5. ローカル開発なら `.env.local` の `GEMINI_API_KEY` に貼り付け、Vercel なら Settings → Environment Variables に追加

## ローカル開発

```bash
npm install
cp .env.example .env.local
# .env.local に GEMINI_API_KEY と Vercel Storage の接続情報を記入
# (Vercel CLI なら DB/Blob は: vercel env pull .env.local)

npm run dev
# http://localhost:3000
```

### 初回 seed

スキーマ作成 + 花マスタの投入:

```bash
curl -X POST "http://localhost:3000/api/seed?secret=$SEED_SECRET"
```

その後 `/inventory` で本日入荷分を 3〜5 件登録すると `/chat` と `/suggest` が動きます。

## Vercel デプロイ

1. このリポジトリを Vercel に Import
2. プロジェクト → **Storage** タブで以下を追加 (環境変数は自動注入される):
   - **Neon (Postgres)** — Vercel Marketplace から選択。`DATABASE_URL` が自動で入る
   - **Blob** — `BLOB_READ_WRITE_TOKEN` が自動で入る
3. **Settings → Environment Variables** で以下を追加:
   - `GEMINI_API_KEY` — Google AI Studio (https://aistudio.google.com/app/apikey) で発行
   - `SEED_SECRET` — `/api/seed` への簡易ガード (任意)
   - `GEMINI_MODEL` — モデル指定 (任意、既定: `gemini-2.5-flash`。高品質優先なら `gemini-2.5-pro`)
4. 環境変数を追加したら **Deployments → 最新のデプロイ → Redeploy** で反映
5. デプロイ後、`POST https://<your-app>.vercel.app/api/seed?secret=...` を一度実行してテーブル作成 + 花マスタ投入

## ディレクトリ

```
app/
  layout.tsx, page.tsx        -- ナビとトップ
  chat/                       -- 接客チャット UI
  suggest/                    -- フォーム検索 UI
  inventory/                  -- 在庫管理 UI
  api/
    chat/                     -- Gemini による多言語応答+提案
    suggest/                  -- 構造化検索 + Gemini による並べ替え
    inventory/                -- CRUD
    upload/                   -- Vercel Blob へのアップロード
    seed/                     -- 初期化エンドポイント
    flowers/                  -- 花マスタ GET
lib/
  db.ts, flowers.ts, ai.ts, types.ts
data/
  schema.sql                  -- テーブル定義
  flowers-seed.json           -- 20種類の花の多言語マスタ
styles/
  globals.css
```

## 拡張のヒント

- 花マスタを増やしたい場合は `data/flowers-seed.json` に追記して `POST /api/seed` を再実行 (UPSERT)。
- モデルを切り替えたい場合は `GEMINI_MODEL` 環境変数で `gemini-2.5-pro` 等を指定。
- 音声入力を足すなら、`/chat` の `<textarea>` を Web Speech API でラップ。
