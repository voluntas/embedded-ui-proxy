"""JSON-RPC 2.0 プロトコルハンドラー

汎用的な JSON-RPC 2.0 サーバー実装
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import Protocol

import structlog
from aiohttp import web

logger = structlog.get_logger()


class InvalidParamsError(Exception):
    """JSONRPCの不正なパラメータエラー"""


class DecimalEncoder(json.JSONEncoder):
    """Decimal や datetime オブジェクトを JSON シリアライズ可能にするエンコーダー"""

    def default(self, o: object) -> float | str | object:
        """Python オブジェクトを JSON シリアライズ可能な形式に変換する

        Args:
            o: 変換するオブジェクト

        Returns:
            JSON シリアライズ可能な値
        """
        if isinstance(o, Decimal):
            return float(o)
        elif isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)


class MethodHandler(Protocol):
    """JSON-RPC メソッドハンドラーのプロトコル"""

    async def __call__(
        self, params: dict | list | None
    ) -> dict | list | str | int | float | bool | None:
        """メソッドを実行する

        Args:
            params: メソッドパラメーター

        Returns:
            メソッドの実行結果
        """
        ...


class JSONRPCHandler:
    """汎用的な JSON-RPC 2.0 サーバーハンドラー"""

    def __init__(self):
        """JSONRPCHandler を初期化する"""
        self.methods: dict[str, MethodHandler] = {}
        self.json_encoder = DecimalEncoder

    def register_method(self, name: str, handler: MethodHandler) -> None:
        """メソッドをハンドラーに登録する

        Args:
            name: メソッド名
            handler: メソッドを処理する関数
        """
        self.methods[name] = handler

    def remove_method(self, name: str) -> None:
        """メソッドを削除する

        Args:
            name: 削除するメソッド名
        """
        self.methods.pop(name, None)

    async def handle_rpc(self, request: web.Request) -> web.Response:
        """JSON-RPC リクエストを処理する

        Args:
            request: HTTP リクエストオブジェクト

        Returns:
            JSON-RPC レスポンスを含む HTTP レスポンス
        """
        try:
            # リクエストをパース
            try:
                data = await request.json()
            except json.JSONDecodeError:
                return self._error_response(None, -32700, "Parse error")

            # バッチリクエストの処理
            if isinstance(data, list):
                if len(data) == 0:
                    return self._error_response(None, -32600, "Invalid Request")
                responses = []
                for req in data:
                    response = await self._handle_single_request(req)
                    if response is not None:  # 通知の場合は None
                        responses.append(response)
                if len(responses) == 0:
                    return web.Response(status=204)  # 全て通知の場合
                return web.json_response(
                    responses, dumps=lambda obj: json.dumps(obj, cls=self.json_encoder)
                )

            # 単一リクエストの処理
            response = await self._handle_single_request(data)
            if response is None:  # 通知の場合
                return web.Response(status=204)
            return web.json_response(
                response, dumps=lambda obj: json.dumps(obj, cls=self.json_encoder)
            )

        except Exception as e:
            logger.error("rpc_handler_error", error=str(e))
            return self._error_response(None, -32603, "Internal error")

    async def _handle_single_request(
        self, data: dict | list | str | int | float | bool | None
    ) -> dict | None:
        """単一の JSON-RPC リクエストを処理する

        Args:
            data: リクエストデータ

        Returns:
            レスポンスデータまたは None（通知の場合）
        """
        # 基本的な検証
        if not isinstance(data, dict):
            return self._error_dict(None, -32600, "Invalid Request")

        jsonrpc = data.get("jsonrpc")
        method = data.get("method")
        params = data.get("params")
        request_id = data.get("id")

        # JSON-RPC 2.0 チェック
        if jsonrpc != "2.0":
            return self._error_dict(request_id, -32600, "Invalid Request")

        # メソッド名チェック
        if not isinstance(method, str):
            return self._error_dict(request_id, -32600, "Invalid Request")

        # メソッドの存在チェック
        if method not in self.methods:
            return self._error_dict(request_id, -32601, "Method not found")

        # パラメーターの検証
        if params is not None and not isinstance(params, (dict, list)):
            return self._error_dict(request_id, -32602, "Invalid params")

        try:
            # メソッド実行
            handler = self.methods[method]
            result = await handler(params)

            # 通知の場合（id がない場合）
            if "id" not in data:
                return None

            # 成功レスポンス
            return {"jsonrpc": "2.0", "result": result, "id": request_id}

        except InvalidParamsError as e:
            logger.error("invalid_params_error", error=str(e))
            # 通知の場合はエラーも返さない
            if "id" not in data:
                return None
            return self._error_dict(request_id, -32602, str(e))
        except Exception as e:
            logger.error("method_execution_error", error=str(e))
            # 通知の場合はエラーも返さない
            if "id" not in data:
                return None
            return self._error_dict(request_id, -32603, str(e))

    def _error_dict(self, request_id: int | str | None, code: int, message: str) -> dict:
        """エラーレスポンス用の辞書を作成する

        Args:
            request_id: リクエスト ID
            code: エラーコード
            message: エラーメッセージ

        Returns:
            エラー情報を含む辞書
        """
        return {
            "jsonrpc": "2.0",
            "error": {"code": code, "message": message},
            "id": request_id,
        }

    def _error_response(
        self, request_id: int | str | None, code: int, message: str
    ) -> web.Response:
        """JSON-RPC エラーレスポンスを生成する

        Args:
            request_id: リクエスト ID
            code: エラーコード
            message: エラーメッセージ

        Returns:
            エラー情報を含む HTTP レスポンス
        """
        return web.json_response(self._error_dict(request_id, code, message))
