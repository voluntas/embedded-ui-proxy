import argparse
import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal

import aiohttp
import duckdb
import psutil
from aiohttp import web

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DuckDBManager:
    def __init__(self, db_path: str = "metrics.duckdb"):
        self.db_path = db_path
        self.conn = duckdb.connect(db_path)
        self._init_tables()

    def _init_tables(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics (
                timestamp TIMESTAMP,
                cpu_percent DOUBLE,
                memory_percent DOUBLE,
                memory_mb DOUBLE
            )
        """)
        self.conn.commit()

    def insert_metrics(
        self, cpu_percent: float, memory_percent: float, memory_mb: float
    ):
        self.conn.execute(
            """
            INSERT INTO system_metrics (timestamp, cpu_percent, memory_percent, memory_mb)
            VALUES (?, ?, ?, ?)
            """,
            (datetime.now(), cpu_percent, memory_percent, memory_mb),
        )
        self.conn.commit()

    def execute_query(self, query: str):
        try:
            cursor = self.conn.execute(query)
            result = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return {"columns": columns, "rows": result}
        except Exception as e:
            raise ValueError(f"Query execution failed: {str(e)}")


class SystemMonitor:
    def __init__(self, db_manager: DuckDBManager):
        self.db_manager = db_manager
        self.monitoring = False

    async def start_monitoring(self):
        self.monitoring = True
        while self.monitoring:
            try:
                cpu_percent = psutil.cpu_percent(interval=0)
                memory = psutil.virtual_memory()
                memory_percent = memory.percent
                memory_mb = memory.used / 1024 / 1024

                self.db_manager.insert_metrics(cpu_percent, memory_percent, memory_mb)
                logger.debug(
                    f"Metrics recorded - CPU: {cpu_percent}%, Memory: {memory_percent}%"
                )
            except Exception as e:
                logger.error(f"Error recording metrics: {e}")

            await asyncio.sleep(1)

    def stop_monitoring(self):
        self.monitoring = False


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


class JSONRPCHandler:
    def __init__(self, db_manager: DuckDBManager):
        self.db_manager = db_manager

    async def handle_rpc(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()

            if not isinstance(data, dict):
                return self._error_response(None, -32700, "Parse error")

            jsonrpc = data.get("jsonrpc")
            method = data.get("method")
            params = data.get("params", {})
            request_id = data.get("id")

            if jsonrpc != "2.0":
                return self._error_response(request_id, -32600, "Invalid Request")

            if method != "query":
                return self._error_response(request_id, -32601, "Method not found")

            if not isinstance(params, dict) or "sql" not in params:
                return self._error_response(request_id, -32602, "Invalid params")

            sql = params["sql"]

            try:
                result = self.db_manager.execute_query(sql)
                return web.json_response(
                    {"jsonrpc": "2.0", "result": result, "id": request_id},
                    dumps=lambda obj: json.dumps(obj, cls=DecimalEncoder),
                )
            except ValueError as e:
                return self._error_response(request_id, -32603, str(e))

        except json.JSONDecodeError:
            return self._error_response(None, -32700, "Parse error")
        except Exception as e:
            logger.error(f"RPC handler error: {e}")
            return self._error_response(None, -32603, "Internal error")

    def _error_response(self, request_id, code: int, message: str) -> web.Response:
        return web.json_response(
            {
                "jsonrpc": "2.0",
                "error": {"code": code, "message": message},
                "id": request_id,
            }
        )


class ProxyHandler:
    def __init__(self, remote_url: str):
        self.remote_url = remote_url.rstrip("/")

    async def handle_proxy(self, request: web.Request) -> web.Response:
        target_url = f"{self.remote_url}{request.path_qs}"

        async with aiohttp.ClientSession() as session:
            try:
                headers = {
                    k: v
                    for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length")
                }

                data = await request.read() if request.body_exists else None

                async with session.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    data=data,
                    allow_redirects=False,
                ) as resp:
                    body = await resp.read()

                    response_headers = {
                        k: v
                        for k, v in resp.headers.items()
                        if k.lower()
                        not in (
                            "content-encoding",
                            "content-length",
                            "transfer-encoding",
                        )
                    }

                    return web.Response(
                        body=body, status=resp.status, headers=response_headers
                    )
            except Exception as e:
                logger.error(f"Proxy error: {e}")
                return web.Response(text=f"Proxy error: {str(e)}", status=502)


def create_app(db_manager: DuckDBManager, remote_url: str) -> web.Application:
    app = web.Application()

    rpc_handler = JSONRPCHandler(db_manager)
    proxy_handler = ProxyHandler(remote_url)

    app.router.add_post("/rpc", rpc_handler.handle_rpc)

    app.router.add_route("*", "/{path:.*}", proxy_handler.handle_proxy)

    return app


async def main():
    parser = argparse.ArgumentParser(description="Embedded DuckDB Web UI Server")
    parser.add_argument(
        "--ui-remote-url",
        type=str,
        default="http://localhost:5173",
        help="Remote URL for UI proxy (default: http://localhost:5173)",
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Server port (default: 8000)"
    )
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

    logger.info(f"Starting server on {args.host}:{args.port}")
    logger.info(f"Proxying UI requests to {args.ui_remote_url}")
    logger.info(f"Using database: {args.db_path}")

    try:
        await site.start()
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        monitor.stop_monitoring()
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
