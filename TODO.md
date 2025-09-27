# TODO

## DuckDB + Python + aiohttp + JSON-RPC 2.0 over HTTP/1.1

- [ ] python で aiohttp で POST で SQL を実行できる JSON-RPC 2.0 over HTTP/1.1 を /rpcに追加 method を query にする
- [ ] main.py に /rpc を追加する
- [ ] / にアクセスすると別の React で作ったフロントエンドページに HTTP Proxy を行う
- [ ] Proxy 先は main.py 起動時に - --ui-remote-url で指定出来る
- [ ] psutil でメモリ使用量と CPU 使用率を取得して DuckDB に保存する
- [ ] duckdb のデータベースは永続化して毎回同じファイルを利用する

## React UI フロントエンド

- [ ] JSON-RPC 2.0 over HTTP/1.1 で /rpc に POST で SQL を実行して結果をグラフに表示する
