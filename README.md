# Hanakotoba — 多言語花屋アシスタント

外国人を含む様々な国籍のお客様と、花でつながるための営業ツール集。データベース不要、AI のみで動きます。

## 4つのモード

| 画面 | パス | 用途 |
| --- | --- | --- |
| 🎨 **イメージで提案** | `/consult` | お客様の希望 (どの言語でも) を日本語に要約。キーワード抽出と確認すべき追加質問も提示。店員さんが店内の花を見繕えるように。 |
| 📸 **花を撮って見せる** | `/show` | お客様の希望を聞いた後、店員さんがスマホで店内の花を撮影 (写真 or 5秒以内の動画)。AI がお客様の言語で説明し、感想を促す。 |
| 🗣️ **通訳モード** | `/interpret` | 店員さん⇄お客様 の双方向通訳。音声入力・自動読み上げ対応。 |
| 🏪 **店舗紹介** | `/welcome` | お店のホームページや Google マップ URL を入れると、AI が読み取って 7 言語の店舗紹介文を自動生成。 |

すべて Web Speech API による音声入力 (Chrome/Edge/Safari) と音声合成 (読み上げ) に対応しています。

## 技術スタック

- Next.js 15 (App Router) + TypeScript + CSS Modules
- Google AI Studio / Gemini API (`@google/genai`, デフォルトは `gemini-2.5-flash` — マルチモーダル対応)
- Vercel デプロイ前提 (DB・ストレージ不要)

## API キーの取得 (Google AI Studio)

1. https://aistudio.google.com/app/apikey にアクセス
2. Google アカウントでサインイン
3. **「Create API key」** をクリック → 新規プロジェクトを選ぶか作成
4. 表示された `AIza...` で始まるキーをコピー

## ローカル開発

```bash
npm install
cp .env.example .env.local
# .env.local の GEMINI_API_KEY に貼り付け

npm run dev
# http://localhost:3000
```

## Vercel デプロイ

1. このリポジトリを Vercel に Import
2. **Settings → Environment Variables** に追加:
   - `GEMINI_API_KEY` — Google AI Studio で発行
   - (任意) `GEMINI_MODEL` — 既定 `gemini-2.5-flash`、高品質優先なら `gemini-2.5-pro`
3. デプロイ

DB やストレージは使わないので Storage タブの設定は不要です。

## ディレクトリ

```
app/
  layout.tsx, page.tsx        -- ナビとトップ (4つのモードへのカード)
  consult/                    -- モードA: イメージで提案
  show/                       -- モードB: 花を撮って見せる
  interpret/                  -- モードC: 通訳
  welcome/                    -- モードD: 店舗紹介
  api/
    consult/                  -- お客様の発話 → 日本語要約 + キーワード
    visual/                   -- 写真/動画 + 希望 → お客様の言語で説明
    interpret/                -- 双方向翻訳
    intro/                    -- URL を fetch → 多言語店舗紹介
lib/
  ai.ts                       -- Gemini SDK のラッパー (4機能)
  speech.ts                   -- Web Speech API のフック・関数
  types.ts                    -- 型定義 + 対応言語マスタ
styles/
  globals.css
```

## 動作確認の流れ

1. `/welcome` でお店の URL を入れて多言語紹介を生成 → 観光客向けに見せる
2. `/consult` で「どんなお花をお探しですか？」をお客様に話してもらう → 店員さんが日本語要約を読んで花を選ぶ
3. `/show` で選んだ花をスマホで撮影 → AI がお客様の言語で説明 → 反応を見る
4. 細かな質問・お会計時のやり取りは `/interpret` で通訳

## 拡張のヒント

- 対応言語の追加: `lib/types.ts` の `SUPPORTED_LANGS` に行を足す
- モデル切替: `GEMINI_MODEL` 環境変数で `gemini-2.5-pro` 等に変更
- 動画の最大秒数を変更: `app/show/page.tsx` の `MAX_VIDEO_SECONDS`
