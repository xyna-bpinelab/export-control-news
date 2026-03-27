# 輸出管理情報ポータル

政府機関等の信頼性の高い組織から輸出管理・安全保障貿易に関する情報を自動収集し、AI要約付きで公開するサイトです。

## 機能

- **自動収集**（毎時）: RSS・Webスクレイピング・メール受信の3方式に対応
- **AI要約**: Claude API による日本語要約・重要ポイント・影響度・関連法令の自動生成
- **公開サイト**: 認証不要。検索・機関別/カテゴリ別フィルタ・ページネーション対応
- **RSS配信**: `/feed` エンドポイントでサイト自身もRSS配信

## 収集対象機関

| 機関 | 国/地域 | 収集方式 |
|---|---|---|
| 経済産業省（安全保障貿易管理） | 🇯🇵 日本 | スクレイピング |
| 外務省（制裁・資産凍結情報） | 🇯🇵 日本 | スクレイピング |
| CISTEC（安全保障貿易情報センター） | 🇯🇵 日本 | スクレイピング |
| BIS（産業安全保障局） | 🇺🇸 米国 | RSS |
| OFAC（外国資産管理局） | 🇺🇸 米国 | RSS |
| 欧州委員会（輸出管理・二重用途規制） | 🇪🇺 EU | RSS |

## 技術スタック

- **フロントエンド**: Next.js 14 App Router + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL + RLS)
- **ホスティング**: Vercel (Cron Jobs 含む)
- **AI**: Anthropic Claude API
- **メール受信**: SendGrid Inbound Parse

---

## セットアップ

### 前提条件

- Node.js 18 以上
- [Vercel アカウント](https://vercel.com)
- [Supabase アカウント](https://supabase.com)
- [Anthropic API キー](https://console.anthropic.com)
- （メール受信を使う場合）SendGrid アカウント・独自ドメイン

---

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <your-repo-url>
cd export-control-news
npm install
```

---

### 2. Supabase プロジェクトの作成

1. [Supabase ダッシュボード](https://app.supabase.com) で新規プロジェクトを作成する
2. プロジェクトの **Settings > API** から以下の値をメモする
   - `Project URL`
   - `anon` キー（公開用）
   - `service_role` キー（サーバー専用・非公開）

#### データベースのセットアップ

Supabase ダッシュボードの **SQL Editor** で、以下のファイルを上から順に実行する。

```sql
-- 1. テーブル定義
-- supabase/migrations/001_initial_schema.sql の内容を貼り付けて実行

-- 2. インデックス定義
-- supabase/migrations/002_indexes.sql の内容を貼り付けて実行

-- 3. RLS ポリシー設定
-- supabase/migrations/003_rls_policies.sql の内容を貼り付けて実行

-- 4. 収集元機関マスタの初期データ投入
-- supabase/seed/sources.sql の内容を貼り付けて実行
```

---

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、各値を設定する。

```bash
cp .env.example .env.local
```

```bash
# .env.local

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# --- Anthropic Claude API ---
ANTHROPIC_API_KEY=sk-ant-api03-...

# --- Vercel Cron 認証シークレット（下記コマンドで生成） ---
# openssl rand -hex 32
CRON_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# --- SendGrid Inbound Parse（メール受信を使う場合） ---
SENDGRID_WEBHOOK_SECRET=your-sendgrid-webhook-secret
INBOUND_EMAIL_ALLOWED_DOMAINS=meti.go.jp,mofa.go.jp,bis.doc.gov,ofac.treasury.gov

# --- サイト設定 ---
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_PUBLIC_SITE_NAME=輸出管理情報ポータル

# --- 動作設定（任意・デフォルト値あり） ---
SCRAPE_MIN_INTERVAL_MS=3000   # スクレイピング間隔（ミリ秒）
SUMMARIZE_BATCH_SIZE=10        # 1回の要約バッチ件数
CLAUDE_MODEL=claude-haiku-4-5-20251001
```

---

### 4. ローカル動作確認

```bash
npm run dev
```

`http://localhost:3000` でサイトが起動します。

#### 手動で収集・要約を実行する（ローカル確認用）

Cron Job は通常 Vercel から呼び出されますが、ローカルでも手動実行できます。

```bash
# 収集実行
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/collect

# AI要約実行
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/summarize
```

---

### 5. Vercel へのデプロイ

#### 5-1. Vercel CLI でデプロイ

```bash
npm install -g vercel
vercel --prod
```

#### 5-2. Vercel ダッシュボードで環境変数を設定

**Settings > Environment Variables** にて、`.env.local` と同じキー・値をすべて登録する。

> **注意**: `SUPABASE_SERVICE_ROLE_KEY` と `ANTHROPIC_API_KEY` は **Production** 環境のみに設定し、Preview 環境には設定しないことを推奨します。

#### 5-3. Vercel Cron Jobs の確認

`vercel.json` に以下の設定が含まれており、デプロイ後に自動で有効になります。

```json
{
  "crons": [
    { "path": "/api/cron/collect",   "schedule": "0 * * * *"  },
    { "path": "/api/cron/summarize", "schedule": "15 * * * *" }
  ]
}
```

Vercel ダッシュボードの **Cron Jobs** タブで実行状況を確認できます。

> **Vercel プランについて**: Hobby プランはサーバーレス関数のタイムアウトが 10 秒のため、多数の機関を同時にスクレイピングするとタイムアウトする場合があります。収集機関が増えたら **Pro プラン**（タイムアウト 60 秒）を推奨します。

---

### 6. SendGrid Inbound Parse の設定（メール受信を使う場合）

政府機関のメール配信サービスを受信するために設定します。

#### 6-1. ドメインの MX レコードを設定

独自ドメインの DNS に以下の MX レコードを追加します。

| ホスト名 | タイプ | 値 | 優先度 |
|---|---|---|---|
| `inbound.your-domain.com` | MX | `mx.sendgrid.net` | 10 |

#### 6-2. SendGrid ダッシュボードで Inbound Parse を設定

1. **Settings > Inbound Parse** を開く
2. **Add Host & URL** をクリック
3. 以下を設定する
   - **Receiving Domain**: `inbound.your-domain.com`
   - **Destination URL**: `https://your-project.vercel.app/api/inbound-email`
   - **POST the raw, full MIME message**: チェックを外す

#### 6-3. 政府機関のメール配信に登録

各機関のメール配信サービスに `news@inbound.your-domain.com` で登録します。

---

## スクレイパーのカスタマイズ

政府機関のサイトはページ構造が変わることがあります。セレクタが機能しなくなった場合は、該当ファイルを修正してください。

| 機関 | ファイル |
|---|---|
| 経済産業省 | `lib/collectors/sources/meti.ts` |
| 外務省 | `lib/collectors/sources/mofa.ts` |
| CISTEC | `lib/collectors/sources/cistec.ts` |

```typescript
// lib/collectors/sources/meti.ts の extract() メソッドで
// セレクタを実際のHTMLに合わせて調整します
const selectors = [
  '.news-list li',       // ← 実際のセレクタに変更
  'table.news-table tr',
]
```

新しい機関を追加する場合は以下の手順です。

1. `lib/collectors/sources/` に新しいスクレイパーファイルを作成（`BaseScraper` を継承）
2. `lib/collectors/index.ts` の `SCRAPERS` オブジェクトに登録
3. Supabase の `sources` テーブルに機関データを INSERT

---

## データフロー

```
毎時 :00  Vercel Cron
    └── GET /api/cron/collect
            ├── RSSフィード取得（BIS / OFAC / 欧州委員会）
            ├── Webスクレイピング（METI / 外務省 / CISTEC）
            ├── 重複排除（SHA-256 URL ハッシュ）
            └── Supabase articles テーブルに保存（status: 'collected'）

毎時 :15  Vercel Cron
    └── GET /api/cron/summarize
            ├── status='collected' の記事を最大10件取得
            ├── Claude API で日本語要約・ポイント・影響度を生成
            └── summaries テーブルに保存（status: 'summarized'）

随時      SendGrid Inbound Parse
    └── POST /api/inbound-email
            ├── 送信元ドメイン検証
            ├── メール本文からURLを抽出
            └── articles テーブルに保存
```

---

## ディレクトリ構造

```
export-control-news/
├── app/
│   ├── page.tsx                    # トップページ
│   ├── articles/
│   │   ├── page.tsx                # 記事一覧（検索・フィルタ）
│   │   └── [id]/page.tsx           # 記事詳細（AI要約表示）
│   ├── sources/page.tsx            # 収集元機関一覧
│   ├── feed/route.ts               # RSS配信
│   └── api/
│       ├── cron/collect/route.ts   # 収集Cron（毎時:00）
│       ├── cron/summarize/route.ts # AI要約Cron（毎時:15）
│       ├── inbound-email/route.ts  # SendGrid Webhook
│       └── articles/route.ts       # 記事一覧API
├── components/
│   └── article/ArticleCard.tsx     # 記事カードコンポーネント
├── lib/
│   ├── ai/                         # Claude API要約ロジック
│   ├── collectors/                 # 収集ロジック（RSS/スクレイパー/メール）
│   ├── supabase/                   # Supabaseクライアント
│   └── utils/                      # 和暦変換・テキスト処理等
├── supabase/
│   ├── migrations/                 # DBマイグレーションSQL
│   └── seed/                       # 初期データSQL
├── types/index.ts                  # 共通型定義
└── vercel.json                     # Cron Jobs 設定
```

---

## 免責事項

本サイトは政府機関等の公開情報を自動収集・AI要約して掲載しています。AI要約は参考情報であり、情報の正確性については各機関の公式発表を必ずご確認ください。
