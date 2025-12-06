# Embedded UI Proxy

![Static Badge](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[![Image from Gyazo](https://i.gyazo.com/dc9a958c11734412959e175be170e4b1.jpg)](https://gyazo.com/dc9a958c11734412959e175be170e4b1)

## 概要

`Embedded UI Proxy` は、Python アプリケーションにあたかも Web UI が埋め込まれているかのように、外部の Web UI をプロキシして、単一のポートで API と UI を提供する方法を示すサンプルアプリケーションです。

UI は別途ホスティングされ、Python アプリケーションがそこへのプロキシとして動作します。

この仕組みにより、Python アプリケーションが API サーバーとプロキシサーバーの両方の役割を果たします。

```text
Browser → :8080 → Python App → Proxy → UI Remote URL (Static Page)
                       ↓
                    /rpc API
```

デフォルトは `http://localhost:5173` ですが、`--ui-remote-url` で任意の URL に変更できます。

## 背景

CLI ツールに Web UI を組み込む際、バイナリに静的ファイルを埋め込んだりするのが嫌だなとおもっていたのですが、 [DuckDB UI](https://github.com/duckdb/duckdb-ui) が HTTP Proxy を利用しているのを見て、マネしてみました。

実際に C++ 製の負荷試験ツールに [DuckDB (C API)](https://duckdb.org/docs/stable/clients/c/overview) を組み込み、さらに [Boost](https://www.boost.org/) の [Beast](https://github.com/boostorg/beast) を利用して、HTTP Proxy を実装し UI を組み込む事に成功しました。

やってること自体はただのリバースプロキシなので難しい話ではありませんが、この仕組みは DuckDB との相性がとても良くて、DuckDB にメトリクスを保存して、ブラウザから SQL クエリで分析したり、グラフ化したりすることがバイナリデータを埋め込むことなく、実現できます。

## 注意

- Python や SQL は適当です
- React や TypeScript も適当です
- セキュリティは **まったく** 考慮していません

## 機能

- [psutil](https://github.com/giampaolo/psutil) を利用したメトリクス監視ダッシュボード
- [DuckDB](https://github.com/duckdb/duckdb) に時系列データを保存
- [Tailwind CSS](https://tailwindcss.com/) と [uPlot](https://github.com/leeoniya/uPlot) でリアルタイムダッシュボード
  - [React](https://github.com/facebook/react) + [wouter](https://github.com/molefrog/wouter) 版 (`ui/`)
  - [Preact](https://github.com/preactjs/preact) + [preact-iso](https://github.com/preactjs/preact-iso) 版 (`ui-preact/`)
- [JSON-RPC 2.0 over HTTP/1.1](https://www.simple-is-better.org/json-rpc/transport_http.html)

## セットアップ

### 必要要件

- Python 3.13 以上
  - [uv](https://docs.astral.sh/uv/)
- Node.js 24 以上
  - [pnpm](https://pnpm.io/ja/)

## UI の機能

### System Metrics タブ

psutil を使って CPU とメモリの使用率を 1 秒ごとに収集し、DuckDB に保存します。UI は API 経由で最新データを取得してグラフ化します。

- 現在の CPU 使用率をリアルタイムグラフで表示
- メモリ使用率と使用量（MB）をリアルタイムグラフで表示
- 1 秒ごとに最新データを自動取得
- 直近 60 秒間のメトリクス推移を可視化

[![Image from Gyazo](https://i.gyazo.com/4cb7807a757d0989782778aa47d01b20.gif)](https://gyazo.com/4cb7807a757d0989782778aa47d01b20)

### SQL Query タブ

DuckDB に対して直接 SQL クエリを実行できます。

```sql
-- 直近 10 件のメトリクスを取得
SELECT * FROM system_metrics
ORDER BY timestamp DESC
LIMIT 10
```

```sql
-- 平均 CPU 使用率を計算
SELECT AVG(cpu_percent) as avg_cpu
FROM system_metrics
```

```sql
-- 時系列でグループ化
SELECT
  DATE_TRUNC('minute', timestamp) as minute,
  AVG(cpu_percent) as avg_cpu,
  AVG(memory_percent) as avg_memory
FROM system_metrics
GROUP BY minute
ORDER BY minute DESC
```

[![Image from Gyazo](https://i.gyazo.com/326a6859e929e62fcac9e9e042eda637.png)](https://gyazo.com/326a6859e929e62fcac9e9e042eda637)

### Custom Chart タブ

SQL クエリの結果をカスタムチャートで可視化します。

[![Image from Gyazo](https://i.gyazo.com/a5a2765690904d6601f4cb7023d36812.gif)](https://gyazo.com/a5a2765690904d6601f4cb7023d36812)

## 使用方法

Python アプリケーションを起動してください。

```bash
uv sync
uv run server
```

UI 開発サーバーを起動してください。

### React 版を使用する場合

```bash
cd ui
pnpm install
pnpm dev
```

### Preact 版を使用する場合

```bash
cd ui-preact
pnpm install
pnpm dev
```

その後、ブラウザで <http://localhost:8080> にアクセスしてください。

## 動作の仕組み

- `/rpc` への API リクエストは Python アプリケーションが処理
- その他のリクエストは UI の開発サーバーにプロキシ

### プロキシ先の変更

```bash
# 別の URL にプロキシする例
uv run server --ui-remote-url https://ui.example.com
```

## コマンドラインオプション

```bash
uv run server [OPTIONS]

オプション:
  --ui-remote-url URL   UI プロキシ先の URL (デフォルト: http://localhost:5173)
  --port PORT          サーバーポート (デフォルト: 8080)
  --host HOST          サーバーホスト (デフォルト: 0.0.0.0)
  --db-path PATH       DuckDB データベースパス (デフォルト: metrics.duckdb)
```

### Tailscale を利用したアクセス制限

Tailscale の IP アドレスを指定して起動することで UI へのアクセスを制限することが出来ます。

```bash
uv run server --host 100.x.y.z
```

## ライセンス

Apache License 2.0

```text
Copyright 2025-2025, @voluntas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
