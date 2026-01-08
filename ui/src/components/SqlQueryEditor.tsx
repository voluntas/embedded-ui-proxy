import { signal } from "@preact/signals";
import type { JSX } from "preact";
import { callQuery } from "../utils/jsonrpc";

interface QueryResult {
  columns: string[];
  rows: Array<Array<unknown>>;
}

const sql = signal("SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 10");
const result = signal<QueryResult | null>(null);
const error = signal<string | null>(null);
const isExecuting = signal(false);

async function executeQuery() {
  if (!sql.value.trim()) {
    error.value = "Please enter a SQL query";
    return;
  }

  isExecuting.value = true;
  error.value = null;

  try {
    const queryResult = (await callQuery(sql.value)) as QueryResult;
    result.value = queryResult;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Query execution failed";
    result.value = null;
  } finally {
    isExecuting.value = false;
  }
}

function handleKeyDown(e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    void executeQuery();
  }
}

function formatValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function SqlQueryEditor() {
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
            value={sql.value}
            onInput={(e) => (sql.value = e.currentTarget.value)}
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
            disabled={isExecuting.value || !sql.value.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting.value ? "Executing..." : "Execute Query"}
          </button>

          <button
            type="button"
            onClick={() => {
              sql.value = "";
              result.value = null;
              error.value = null;
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear
          </button>
        </div>

        {error.value && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error.value}
          </div>
        )}

        {result.value && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-medium text-gray-700">
                Query Results ({result.value.rows.length} rows)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {result.value.columns.map((col, i) => (
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
                  {result.value.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={result.value.columns.length}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No results found
                      </td>
                    </tr>
                  ) : (
                    result.value.rows.map((row, i) => (
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
  );
}
