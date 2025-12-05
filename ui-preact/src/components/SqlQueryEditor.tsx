import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { callQuery } from '../utils/jsonrpc'

interface QueryResult {
  columns: string[]
  rows: Array<Array<any>>
}

export function SqlQueryEditor() {
  const [sql, setSql] = useState('SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 10')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const executeQuery = async () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query')
      return
    }

    setIsExecuting(true)
    setError(null)

    try {
      const queryResult = (await callQuery(sql)) as QueryResult
      setResult(queryResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
      setResult(null)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter でクエリを実行
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      executeQuery()
    }
  }

  const formatValue = (value: any) => {
    if (value === null) return 'NULL'
    if (value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">SQL Query Editor</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="sql-editor" className="block text-sm font-medium text-gray-700 mb-2">
            SQL Query
          </label>
          <textarea
            id="sql-editor"
            value={sql}
            onChange={(e) => setSql(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="Enter your SQL query here..."
          />
          <p className="mt-1 text-xs text-gray-500">
            Press Ctrl+Enter (or Cmd+Enter on Mac) to execute
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={executeQuery}
            disabled={isExecuting || !sql.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Executing...' : 'Execute Query'}
          </button>

          <button
            type="button"
            onClick={() => {
              setSql('')
              setResult(null)
              setError(null)
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-medium text-gray-700">
                Query Results ({result.rows.length} rows)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {result.columns.map((col, i) => (
                      <th
                        key={i}
                        className="px-4 py-2 text-left font-medium text-gray-900 border-b"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {result.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={result.columns.length}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No results found
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2 text-gray-900 font-mono text-xs">
                            {formatValue(cell)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
