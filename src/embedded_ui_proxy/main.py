import argparse
import asyncio
import logging
import signal

from aiohttp import web

from .jsonrpc import InvalidParamsError, JSONRPCHandler
from .monitor import DuckDBManager, SystemMonitor
from .proxy import ProxyHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def create_app(db_manager: DuckDBManager, remote_url: str) -> web.Application:
    """Web アプリケーションを作成し、ルーティングを設定する

    Args:
        db_manager: DuckDB マネージャーインスタンス
        remote_url: プロキシ先の URL

    Returns:
        設定済みの aiohttp Application インスタンス
    """
    app = web.Application()

    # JSON-RPC ハンドラーを設定
    rpc_handler = JSONRPCHandler()

    # DuckDB クエリメソッドを登録
    async def query_method(params: dict | list | None) -> dict:
        """DuckDB クエリを実行するメソッド"""
        if not isinstance(params, dict) or "sql" not in params:
            raise InvalidParamsError("Invalid params: 'sql' parameter is required")
        return db_manager.execute_query(params["sql"])

    rpc_handler.register_method("query", query_method)

    proxy_handler = ProxyHandler(remote_url)

    # JSON-RPC エンドポイントを登録
    app.router.add_post("/rpc", rpc_handler.handle_rpc)

    # その他のすべてのリクエストをプロキシハンドラーに転送
    app.router.add_route("*", "/{path:.*}", proxy_handler.handle_proxy)

    return app


async def main():
    """メインの非同期エントリーポイント

    コマンドライン引数を解析し、サーバーとモニタリングを起動する
    """
    parser = argparse.ArgumentParser(
        description="Embedded UI Proxy - Embedded UI proxy with real-time metrics monitoring using DuckDB"
    )
    parser.add_argument(
        "--ui-remote-url",
        type=str,
        default="http://localhost:5173",
        help="Remote URL for UI proxy (default: http://localhost:5173)",
    )
    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Server host (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default="metrics.duckdb",
        help="DuckDB database path (default: metrics.duckdb)",
    )

    args = parser.parse_args()

    db_manager = DuckDBManager(args.db_path)
    monitor = SystemMonitor(db_manager)

    monitor_task = asyncio.create_task(monitor.start_monitoring())

    app = create_app(db_manager, args.ui_remote_url)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, args.host, args.port)

    logger.info(f"Starting Embedded UI Proxy on {args.host}:{args.port}")
    logger.info(f"Proxying UI requests to {args.ui_remote_url}")
    logger.info(f"Using database: {args.db_path}")
    logger.info(f"Access the UI at: http://localhost:{args.port}/")

    # シャットダウンイベント (グレースフルシャットダウン用)
    shutdown_event = asyncio.Event()

    def signal_handler(_signum, _frame):
        """シグナルを受信したらシャットダウンイベントをセットする"""
        shutdown_event.set()

    # SIGINT (Ctrl+C) と SIGTERM シグナルをハンドリング
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await site.start()
        # シャットダウンシグナルを待機
        await shutdown_event.wait()
    finally:
        logger.info("Shutting down gracefully...")
        # モニタリングを停止
        monitor.stop_monitoring()
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            # タスクキャンセルは正常な動作なので無視
            pass
        await runner.cleanup()
        logger.info("Server shutdown complete")


def run_server():
    """エントリポイント用のラッパー関数

    非同期メイン関数を実行し、KeyboardInterrupt を適切に処理する
    """
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # Ctrl-C を優雅に処理
        pass


if __name__ == "__main__":
    run_server()
