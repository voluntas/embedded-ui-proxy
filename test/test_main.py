import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.main import DuckDBManager, create_app


@pytest.fixture
def temp_db():
    # 一時ディレクトリを使用
    tmpdir = tempfile.mkdtemp(prefix="test_duckdb_")
    db_path = os.path.join(tmpdir, "test.duckdb")
    yield db_path
    # クリーンアップ: DuckDB関連ファイルを含めディレクトリごと削除
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def db_manager(temp_db):
    manager = DuckDBManager(temp_db)
    yield manager
    # 接続を明示的に閉じる
    try:
        manager.conn.close()
    except Exception:
        pass


@pytest.fixture
def app(db_manager):
    return create_app(db_manager, "http://localhost:5173")


@pytest.mark.asyncio
async def test_query_success(aiohttp_client, app, db_manager):
    # 実際のテストデータを挿入
    db_manager.conn.execute("CREATE TABLE test (col1 INT, col2 INT, col3 INT)")
    db_manager.conn.execute("INSERT INTO test VALUES (1, 2, 3)")
    db_manager.conn.commit()

    client = await aiohttp_client(app)

    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {"sql": "SELECT * FROM test"},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    assert data["jsonrpc"] == "2.0"
    assert "result" in data
    assert data["result"]["columns"] == ["col1", "col2", "col3"]
    assert data["result"]["rows"] == [[1, 2, 3]]
    assert data["id"] == 1


@pytest.mark.asyncio
async def test_invalid_method(aiohttp_client, app):
    client = await aiohttp_client(app)

    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "invalid",
        "params": {"sql": "SELECT 1"},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    assert "error" in data
    assert data["error"]["code"] == -32601
    assert data["error"]["message"] == "Method not found"


@pytest.mark.asyncio
async def test_missing_sql_param(aiohttp_client, app):
    client = await aiohttp_client(app)

    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    assert "error" in data
    assert data["error"]["code"] == -32602
    assert data["error"]["message"] == "Invalid params"


@pytest.mark.asyncio
async def test_invalid_json(aiohttp_client, app):
    client = await aiohttp_client(app)

    response = await client.post('/rpc', data="invalid json")

    assert response.status == 200
    data = await response.json()
    assert "error" in data
    assert data["error"]["code"] == -32700
    assert data["error"]["message"] == "Parse error"


@pytest.mark.asyncio
async def test_query_execution_error(aiohttp_client, app):
    client = await aiohttp_client(app)

    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {"sql": "SELECT * FROM non_existent_table"},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    assert "error" in data
    assert data["error"]["code"] == -32603


def test_init_tables():
    with tempfile.TemporaryDirectory(prefix="test_duckdb_") as tmpdir:
        db_path = os.path.join(tmpdir, "test.duckdb")
        db = DuckDBManager(db_path)

        try:
            # テーブルが作成されていることを確認
            result = db.conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            table_names = [row[0] for row in result]
            assert "system_metrics" in table_names
        finally:
            # 接続を閉じる
            db.conn.close()


def test_insert_metrics():
    with tempfile.TemporaryDirectory(prefix="test_duckdb_") as tmpdir:
        db_path = os.path.join(tmpdir, "test.duckdb")
        manager = DuckDBManager(db_path)

        try:
            manager.insert_metrics(50.0, 60.0, 1024.0)

            # データが挿入されたことを確認
            result = manager.conn.execute("SELECT COUNT(*) FROM system_metrics").fetchone()
            assert result[0] == 1

            # 挿入されたデータの内容を確認
            result = manager.conn.execute("SELECT cpu_percent, memory_percent, memory_mb FROM system_metrics").fetchone()
            assert result[0] == 50.0
            assert result[1] == 60.0
            assert result[2] == 1024.0
        finally:
            # 接続を閉じる
            manager.conn.close()


def test_execute_query():
    with tempfile.TemporaryDirectory(prefix="test_duckdb_") as tmpdir:
        db_path = os.path.join(tmpdir, "test.duckdb")
        manager = DuckDBManager(db_path)

        try:
            # テストテーブルを作成
            manager.conn.execute("CREATE TABLE test_table (id INT, name VARCHAR)")
            manager.conn.execute("INSERT INTO test_table VALUES (1, 'test')")
            manager.conn.commit()

            result = manager.execute_query("SELECT * FROM test_table")

            assert result["columns"] == ["id", "name"]
            assert result["rows"] == [(1, "test")]
        finally:
            # 接続を閉じる
            manager.conn.close()


def test_execute_query_error():
    with tempfile.TemporaryDirectory(prefix="test_duckdb_") as tmpdir:
        db_path = os.path.join(tmpdir, "test.duckdb")
        manager = DuckDBManager(db_path)

        try:
            with pytest.raises(ValueError, match="Query execution failed"):
                manager.execute_query("INVALID SQL")
        finally:
            # 接続を閉じる
            manager.conn.close()


@pytest.mark.asyncio
async def test_system_metrics_endpoint(aiohttp_client, app, db_manager):
    # いくつかのメトリクスを挿入
    db_manager.insert_metrics(10.5, 45.3, 2048.0)
    db_manager.insert_metrics(20.7, 50.1, 2100.0)

    client = await aiohttp_client(app)

    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {"sql": "SELECT COUNT(*) as count FROM system_metrics"},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    # 初期化時のテーブル作成 + 2つの挿入で少なくとも2行
    assert data["result"]["rows"][0][0] >= 2


@pytest.mark.asyncio
async def test_complex_query(aiohttp_client, app, db_manager):
    # テスト用のテーブルとデータを作成
    db_manager.conn.execute("""
        CREATE TABLE products (
            id INT PRIMARY KEY,
            name VARCHAR,
            price DECIMAL
        )
    """)
    db_manager.conn.execute("INSERT INTO products VALUES (1, 'Product A', 100.50)")
    db_manager.conn.execute("INSERT INTO products VALUES (2, 'Product B', 200.75)")
    db_manager.conn.execute("INSERT INTO products VALUES (3, 'Product C', 150.00)")
    db_manager.conn.commit()

    client = await aiohttp_client(app)

    # 複雑なクエリを実行
    response = await client.post('/rpc', json={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {"sql": "SELECT name, price FROM products WHERE price > 100 ORDER BY price DESC"},
        "id": 1
    })

    assert response.status == 200
    data = await response.json()
    assert data["result"]["columns"] == ["name", "price"]
    assert len(data["result"]["rows"]) == 3
    # 価格の降順でソートされていることを確認
    assert data["result"]["rows"][0][1] > data["result"]["rows"][1][1]


@pytest.mark.asyncio
async def test_cleanup_verification():
    """テスト後にDuckDB関連ファイルがクリーンアップされることを確認"""
    tmpdir = tempfile.mkdtemp(prefix="test_cleanup_")
    db_path = os.path.join(tmpdir, "test.duckdb")

    # DuckDBを使用
    manager = DuckDBManager(db_path)
    manager.insert_metrics(10.0, 20.0, 1024.0)

    # DuckDB関連ファイルが作成されていることを確認
    assert os.path.exists(db_path)
    # WALファイルが存在する場合もある
    wal_path = db_path + ".wal"

    # 接続を閉じる
    manager.conn.close()

    # クリーンアップ
    shutil.rmtree(tmpdir, ignore_errors=True)

    # ディレクトリが削除されていることを確認
    assert not os.path.exists(tmpdir)
    assert not os.path.exists(db_path)
    assert not os.path.exists(wal_path)