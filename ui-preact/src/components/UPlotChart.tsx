import { useEffect, useRef } from 'preact/hooks'
import uPlot, { type AlignedData, type Options } from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface UPlotChartProps {
  data: AlignedData
  options: Options
  className?: string
}

export function UPlotChart({ data, options, className = '' }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  // チャートの作成/再作成
  useEffect(() => {
    if (!containerRef.current) return

    // 既存のチャートがあれば破棄
    if (plotRef.current) {
      plotRef.current.destroy()
      plotRef.current = null
    }

    // 新しいチャートを作成
    plotRef.current = new uPlot(options, data, containerRef.current)

    // クリーンアップ
    return () => {
      if (plotRef.current) {
        plotRef.current.destroy()
        plotRef.current = null
      }
    }
  }, [options, data]) // optionsが変更された時に再作成

  // データのみ更新された場合
  useEffect(() => {
    if (plotRef.current && data) {
      plotRef.current.setData(data)
    }
  }, [data])

  return <div ref={containerRef} className={className} />
}
