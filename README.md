# Embedded Web UI with DuckDB and React

- / にアクセスすると React で作ったフロントエンドページに HTTP Proxy を行う
- Proxy 先は main.py 起動時に --ui-remote-url で指定
- aiohttp で POST で SQL を実行できる JSON-RPC 2.0 over HTTP/1.1 を /rpc に追加 method を query にする
- aiohttp で HTTP Proxy を実装する
  - デフォルトは <http://localhost:5173>
  - --ui-remote-url で指定出来る
  - GET / でフロントエンドページにアクセス出来る
- psutil で 1 秒単位で取得したメモリ使用量と CPU 使用率を DuckDB に保存する
- React で作ったフロントエンドで SQL を実行してグラフに表示する
- SQL を JSON-RPC 2.0 over HTTP/1.1 で実行する
  - method は query
- fetch API で JSON-RPC 2.0 over HTTP/1.1 で SQL を実行する
  
## 動作方法

```bash
uv run main.py
```

### React UI フロントエンドの起動

```bash
pnpm dev
```
