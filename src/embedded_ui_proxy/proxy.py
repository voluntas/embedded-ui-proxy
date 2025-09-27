"""HTTP リバースプロキシハンドラー

任意の HTTP サービスへのリバースプロキシ機能を提供
"""

import logging

import aiohttp
from aiohttp import web

logger = logging.getLogger(__name__)


class ProxyHandler:
    """UI アプリケーションへのリバースプロキシを提供するハンドラー"""

    def __init__(self, remote_url: str):
        """ProxyHandler を初期化する

        Args:
            remote_url: プロキシ先の URL
        """
        self.remote_url = remote_url.rstrip("/")

    async def handle_proxy(self, request: web.Request) -> web.Response:
        """リクエストをリモートサーバーに転送し、レスポンスを返す

        Args:
            request: HTTP リクエストオブジェクト

        Returns:
            リモートサーバーからのレスポンス
        """
        # ターゲット URL を構築 (パスとクエリパラメータを含む)
        target_url = f"{self.remote_url}{request.path_qs}"

        async with aiohttp.ClientSession() as session:
            try:
                # プロキシ不要なヘッダーを除外してヘッダーをコピー
                headers = {
                    k: v
                    for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length")
                }

                # リクエストボディがあれば読み込む
                data = await request.read() if request.body_exists else None

                async with session.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    data=data,
                    allow_redirects=False,
                ) as resp:
                    body = await resp.read()

                    # エンコーディング関連のヘッダーを除外してレスポンスヘッダーをコピー
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

                    return web.Response(body=body, status=resp.status, headers=response_headers)
            except aiohttp.ClientError as e:
                logger.error(f"Proxy client error: {e}")
                return web.Response(text=f"Proxy error: {str(e)}", status=502)
            except Exception as e:
                logger.error(f"Proxy error: {e}")
                return web.Response(text=f"Proxy error: {str(e)}", status=502)
