import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlignedData } from 'uplot'
import { useContainerSize } from '../hooks/useContainerSize'
import { callQuery } from '../utils/jsonrpc'
import { tooltipPlugin } from '../utils/tooltipPlugin'
import { UPlotChart } from './UPlotChart'

interface QueryResult {
  columns: string[]
  rows: Array<Array<any>>
}

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

export function CustomChart() {
  const [sql, setSql] = useState(
    `
SELECT
  timestamp,
  cpu_percent,
  memory_percent
FROM system_metrics
ORDER BY timestamp DESC
LIMIT 60
`.trim(),
  )
  const [chartData, setChartData] = useState<AlignedData | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartSize = useContainerSize(chartContainerRef)

  const executeAndChart = useCallback(async () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query')
      return
    }

    setIsExecuting(true)
    setError(null)

    try {
      const result = (await callQuery(sql)) as QueryResult

      if (result.rows.length === 0) {
        setError('No data returned from query')
        setChartData(null)
        return
      }

      // 最初のカラムをX軸（タイムスタンプ）として使用
      const xValues: number[] = []
      const seriesData: number[][] = []

      // カラム名を保存（最初のカラムを除く）
      const dataColumns = result.columns.slice(1)
      setColumns(dataColumns)

      // 各カラムのデータ配列を初期化
      dataColumns.forEach(() => {
        seriesData.push([])
      })

      // データを変換
      result.rows.reverse().forEach((row) => {
        // X軸の値（タイムスタンプまたは数値）
        const xValue = row[0]
        if (typeof xValue === 'string' && xValue.includes('T')) {
          // ISO日付文字列の場合
          xValues.push(new Date(xValue).getTime() / 1000)
        } else if (typeof xValue === 'number') {
          xValues.push(xValue)
        } else {
          // その他の場合はインデックスを使用
          xValues.push(xValues.length)
        }

        // Y軸の値（数値データのみ）
        for (let i = 1; i < row.length; i++) {
          const value = row[i]
          const series = seriesData[i - 1]
          if (series) {
            series.push(typeof value === 'number' ? value : 0)
          }
        }
      })

      // uPlot用のデータ構造に変換
      const alignedData: AlignedData = [xValues, ...seriesData]
      setChartData(alignedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
      setChartData(null)
    } finally {
      setIsExecuting(false)
    }
  }, [sql])

  // 自動更新の設定
  useEffect(() => {
    if (!autoRefresh) return

    executeAndChart()
    const interval = setInterval(executeAndChart, 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, executeAndChart])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      executeAndChart()
    }
  }

  // グラフオプションを動的に生成
  const getChartOptions = () => {
    const series = [
      {}, // X軸
      ...columns.map((col, i) => ({
        label: col,
        stroke: CHART_COLORS[i % CHART_COLORS.length],
        width: 2,
      })),
    ]

    return {
      title: 'Custom Query Chart',
      width: chartSize.width,
      height: 400,
      plugins: [tooltipPlugin()],
      series,
      scales: {
        x: {
          time: sql.toLowerCase().includes('timestamp'),
        },
      },
      axes: [
        {
          stroke: '#9ca3af',
          grid: {
            stroke: '#e5e7eb',
            width: 1,
          },
        },
        {
          stroke: '#9ca3af',
          grid: {
            stroke: '#e5e7eb',
            width: 1,
          },
        },
      ],
      cursor: {
        points: {
          show: false,
        },
      },
      legend: {
        show: true,
        live: false,
      },
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Custom Chart</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="sql-query" className="block text-sm font-medium text-gray-700 mb-2">
            SQL Query (first column will be X-axis)
          </label>
          <textarea
            id="sql-query"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="SELECT timestamp, value FROM table..."
          />
          <p className="mt-1 text-xs text-gray-500">
            First column will be used as X-axis, subsequent numeric columns as Y-axis series
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <button
            type="button"
            onClick={executeAndChart}
            disabled={isExecuting || !sql.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Executing...' : 'Execute & Chart'}
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm text-gray-700">Auto-refresh (1s)</span>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {chartData && (
          <div ref={chartContainerRef} className="bg-white rounded-lg shadow p-6">
            <UPlotChart data={chartData} options={getChartOptions()} />
          </div>
        )}
      </div>
    </div>
  )
}
