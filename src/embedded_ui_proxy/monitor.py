"""システムモニタリングと DuckDB データ管理

システムリソースを監視し、メトリクスを DuckDB に記録する
"""

import asyncio
from datetime import datetime

import duckdb
import psutil
import structlog

logger = structlog.get_logger()


class DuckDBManager:
    """DuckDB を使用してメトリクスデータを管理するクラス"""

    def __init__(self, db_path: str = "metrics.duckdb"):
        """DuckDB 接続を初期化し、必要なテーブルを作成する

        Args:
            db_path: データベースファイルのパス
        """
        self.db_path = db_path
        self.conn = duckdb.connect(db_path)
        self._init_tables()

    def _init_tables(self):
        """システムメトリクスを保存するためのテーブルを初期化する"""
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics (
                timestamp TIMESTAMP,
                cpu_percent DOUBLE,
                memory_percent DOUBLE,
                memory_mb DOUBLE
            )
        """)
        self.conn.commit()

    def insert_metrics(self, cpu_percent: float, memory_percent: float, memory_mb: float):
        """システムメトリクスをデータベースに挿入する

        Args:
            cpu_percent: CPU 使用率 (パーセント)
            memory_percent: メモリ使用率 (パーセント)
            memory_mb: メモリ使用量 (MB)
        """
        self.conn.execute(
            """
            INSERT INTO system_metrics (timestamp, cpu_percent, memory_percent, memory_mb)
            VALUES (?, ?, ?, ?)
            """,
            (datetime.now(), cpu_percent, memory_percent, memory_mb),
        )
        self.conn.commit()

    def execute_query(self, query: str) -> dict:
        """任意の SQL クエリを実行し、結果を返す

        Args:
            query: 実行する SQL クエリ

        Returns:
            クエリ結果を含む辞書 (columns と rows を含む)

        Raises:
            ValueError: クエリ実行に失敗した場合
        """
        try:
            cursor = self.conn.execute(query)
            result = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]

            # datetime オブジェクトを文字列に変換
            converted_rows = []
            for row in result:
                converted_row = []
                for cell in row:
                    if isinstance(cell, datetime):
                        converted_row.append(cell.isoformat())
                    else:
                        converted_row.append(cell)
                converted_rows.append(converted_row)

            return {"columns": columns, "rows": converted_rows}
        except Exception as e:
            raise ValueError(f"Query execution failed: {str(e)}")

    def close(self):
        """データベース接続を閉じる"""
        if hasattr(self, "conn"):
            self.conn.close()


class SystemMonitor:
    """システムリソースを監視し、定期的にメトリクスを記録するクラス"""

    def __init__(self, db_manager: DuckDBManager):
        """SystemMonitor を初期化する

        Args:
            db_manager: メトリクスを保存する DuckDBManager インスタンス
        """
        self.db_manager = db_manager
        self.monitoring = False

    async def start_monitoring(self, interval_seconds: float = 1.0):
        """システム監視を開始し、指定された間隔でメトリクスを記録する

        Args:
            interval_seconds: メトリクス記録の間隔（秒）。デフォルトは 1 秒
        """
        self.monitoring = True
        while self.monitoring:
            try:
                cpu_percent = psutil.cpu_percent(interval=0)
                memory = psutil.virtual_memory()
                memory_percent = memory.percent
                memory_mb = memory.used / 1024 / 1024

                self.db_manager.insert_metrics(cpu_percent, memory_percent, memory_mb)
                logger.debug(
                    "metrics_recorded", cpu_percent=cpu_percent, memory_percent=memory_percent
                )
            except Exception as e:
                logger.error("recording_metrics_error", error=str(e))

            await asyncio.sleep(interval_seconds)

    def stop_monitoring(self):
        """システム監視を停止する"""
        self.monitoring = False
