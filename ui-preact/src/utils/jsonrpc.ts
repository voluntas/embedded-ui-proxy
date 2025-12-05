// JSON-RPC 2.0 クライアント実装

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: number | string
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
  id: number | string
}

let requestId = 0

export class JsonRpcClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++requestId,
    }

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const jsonResponse: JsonRpcResponse<T> = await response.json()

    if (jsonResponse.error) {
      throw new Error(`JSON-RPC Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`)
    }

    return jsonResponse.result as T
  }
}

// デフォルトのクライアントインスタンス
// 現在の location を使用
const zakuroBaseUrl = window.location.origin
export const jsonRpcClient = new JsonRpcClient(zakuroBaseUrl)

// 便利な関数
export async function callVersion(): Promise<unknown> {
  return jsonRpcClient.call('version')
}

export async function callQuery(sql: string): Promise<unknown> {
  return jsonRpcClient.call('query', { sql })
}
