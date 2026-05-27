# Hanakotoba — 多言語花屋アシスタント

外国人を含む様々な国籍のお客様に、その日の在庫から最適な花を見繕う Web アプリ。

## 機能

- **接客チャット** (`/chat`) — お客様にタブレットを向けて使う。AI がお客様の言語を自動検出し、店員側に日本語で意図を伝えつつ、お客様側にその言語で返答する。在庫の中から候補を写真付きで表示。
- **花を提案** (`/suggest`) — 誕生日・花言葉・色・予算などから絞り込み検索。
- **在庫管理** (`/inventory`) — 当日入荷の登録、写真アップロード、在庫数の更新。

## 技術スタック

- Next.js 15 (App Router) + TypeScript
- Vercel Postgres (`@vercel/postgres`)
- Vercel Blob (`@vercel/blob`) — 花の写真
- Claude API (`@anthropic-ai/sdk`, デフォルトは `claude-opus-4-7`) — 言語検出・翻訳・花の提案

## ローカル開発

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY と Vercel Storage の接続情報を記入
# (Vercel CLI なら: vercel env pull .env.local)

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
2. **Storage** タブで以下を追加 (環境変数は自動注入される):
   - **Postgres**
   - **Blob**
3. **Settings → Environment Variables** で以下を追加:
   - `ANTHROPIC_API_KEY` — Anthropic Console で発行
   - `SEED_SECRET` — `/api/seed` への簡易ガード (任意)
   - `CLAUDE_MODEL` — モデル指定 (任意、既定: `claude-opus-4-7`。コスト削減なら `claude-sonnet-4-6`)
4. デプロイ後、`POST https://<your-app>.vercel.app/api/seed?secret=...` を一度実行

## ディレクトリ

```
app/
  layout.tsx, page.tsx        -- ナビとトップ
  chat/                       -- 接客チャット UI
  suggest/                    -- フォーム検索 UI
  inventory/                  -- 在庫管理 UI
  api/
    chat/                     -- Claude による多言語応答+提案
    suggest/                  -- 構造化検索 + Claude による並べ替え
    inventory/                -- CRUD
    upload/                   -- Vercel Blob へのアップロード
    seed/                     -- 初期化エンドポイント
    flowers/                  -- 花マスタ GET
lib/
  db.ts, flowers.ts, claude.ts, types.ts
data/
  schema.sql                  -- テーブル定義
  flowers-seed.json           -- 20種類の花の多言語マスタ
styles/
  globals.css
```

## 拡張のヒント

- 花マスタを増やしたい場合は `data/flowers-seed.json` に追記して `POST /api/seed` を再実行 (UPSERT)。
- モデルを切り替えたい場合は `CLAUDE_MODEL` 環境変数で `claude-sonnet-4-6` 等を指定。
- 音声入力を足すなら、`/chat` の `<textarea>` を Web Speech API でラップ。
