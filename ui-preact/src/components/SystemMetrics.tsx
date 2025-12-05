import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { AlignedData } from 'uplot'
import { useContainerSize } from '../hooks/useContainerSize'
import { callQuery } from '../utils/jsonrpc'
import { tooltipPlugin } from '../utils/tooltipPlugin'
import { UPlotChart } from './UPlotChart'

interface MetricsData {
  columns: string[]
  rows: Array<Array<number | string>>
}

const MAX_POINTS = 60 // 最大60ポイント(1分間)を表示

export function SystemMetrics() {
  const [cpuData, setCpuData] = useState<AlignedData>([[], []])
  const [memoryData, setMemoryData] = useState<AlignedData>([[], []])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const cpuContainerRef = useRef<HTMLDivElement>(null)
  const memoryContainerRef = useRef<HTMLDivElement>(null)
  const cpuSize = useContainerSize(cpuContainerRef)
  const memorySize = useContainerSize(memoryContainerRef)

  // メトリクスデータを取得
  const fetchMetrics = useCallback(async () => {
    try {
      const result = (await callQuery(`
        SELECT
          timestamp,
          cpu_percent,
          memory_percent,
          memory_mb
        FROM system_metrics
        ORDER BY timestamp DESC
        LIMIT ${MAX_POINTS}
      `)) as MetricsData

      if (result.rows.length > 0) {
        // タイムスタンプとデータを分離
        const timestamps: number[] = []
        const cpuValues: number[] = []
        const memoryValues: number[] = []

        // 古い順にソート(グラフ表示のため)
        result.rows.reverse().forEach((row) => {
          const timestamp = new Date(row[0] as string).getTime() / 1000
          timestamps.push(timestamp)
          cpuValues.push(row[1] as number)
          memoryValues.push(row[2] as number)
        })

        setCpuData([timestamps, cpuValues])
        setMemoryData([timestamps, memoryValues])
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 定期的にデータを更新
  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 1000) // 1秒ごとに更新
    return () => clearInterval(interval)
  }, [fetchMetrics])

  // CPU グラフのオプション
  const cpuOptions = useMemo(
    () => ({
      title: 'CPU Usage (%)',
      width: cpuSize.width,
      height: cpuSize.height,
      plugins: [tooltipPlugin()],
      series: [
        {},
        {
          label: 'CPU %',
          stroke: '#3b82f6',
          width: 2,
          fill: 'rgba(59, 130, 246, 0.1)',
        },
      ],
      scales: {
        x: {
          time: true,
        },
        y: {
          range: () => [0, 100] as [number, number],
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
          values: (_self: any, ticks: number[]) => ticks.map((v) => `${v}%`),
        },
      ],
      cursor: {
        points: {
          show: false,
        },
      },
    }),
    [cpuSize.width, cpuSize.height],
  )

  // メモリグラフのオプション
  const memoryOptions = useMemo(
    () => ({
      title: 'Memory Usage (%)',
      width: memorySize.width,
      height: memorySize.height,
      plugins: [tooltipPlugin()],
      series: [
        {},
        {
          label: 'Memory %',
          stroke: '#10b981',
          width: 2,
          fill: 'rgba(16, 185, 129, 0.1)',
        },
      ],
      scales: {
        x: {
          time: true,
        },
        y: {
          range: () => [0, 100] as [number, number],
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
          values: (_self: any, ticks: number[]) => ticks.map((v) => `${v}%`),
        },
      ],
      cursor: {
        points: {
          show: false,
        },
      },
    }),
    [memorySize.width, memorySize.height],
  )

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse text-gray-600">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Metrics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div ref={cpuContainerRef} className="bg-white rounded-lg shadow p-4">
          <UPlotChart data={cpuData} options={cpuOptions} />
        </div>

        <div ref={memoryContainerRef} className="bg-white rounded-lg shadow p-4">
          <UPlotChart data={memoryData} options={memoryOptions} />
        </div>
      </div>
    </div>
  )
}
