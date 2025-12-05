import type uPlot from 'uplot'

export function tooltipPlugin(): uPlot.Plugin {
  let tooltip: HTMLDivElement | null = null
  let over: HTMLDivElement | null = null

  function init(u: uPlot) {
    over = u.over

    tooltip = document.createElement('div')
    tooltip.style.position = 'absolute'
    tooltip.style.display = 'none'
    tooltip.style.pointerEvents = 'none'
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
    tooltip.style.color = 'white'
    tooltip.style.padding = '8px 12px'
    tooltip.style.borderRadius = '4px'
    tooltip.style.fontSize = '12px'
    tooltip.style.fontFamily = 'monospace'
    tooltip.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)'
    tooltip.style.zIndex = '1000'
    tooltip.style.whiteSpace = 'pre'
    tooltip.style.lineHeight = '1.5'

    over?.appendChild(tooltip)
  }

  function setTooltip(u: uPlot) {
    const { left, top, idx } = u.cursor

    if (idx == null || left == null || top == null) {
      if (tooltip) tooltip.style.display = 'none'
      return
    }

    const xVal = u.data[0]?.[idx]
    let tooltipContent = ''

    // X軸の値(タイムスタンプの場合はフォーマット)
    if (u.scales['x']?.time && xVal !== undefined) {
      const date = new Date(xVal * 1000)
      tooltipContent = `${date.toLocaleString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}\n`
    } else {
      tooltipContent = `X: ${xVal}\n`
    }

    // 各シリーズの値を追加
    u.series.forEach((s, i) => {
      if (i === 0 || !s.show || !s.label) return

      const val = u.data[i]?.[idx]
      if (val != null) {
        const label = s.label
        const formattedVal = typeof val === 'number' ? val.toFixed(2) : val

        tooltipContent += `${label}: ${formattedVal}\n`
      }
    })

    if (tooltip && over) {
      tooltip.textContent = tooltipContent.trim()
      tooltip.style.display = 'block'

      // ツールチップの位置を計算
      const rect = over.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()

      let tooltipLeft = left + 15
      let tooltipTop = top - tooltipRect.height - 10

      // 画面外に出ないように調整
      if (tooltipLeft + tooltipRect.width > rect.width) {
        tooltipLeft = left - tooltipRect.width - 15
      }

      if (tooltipTop < 0) {
        tooltipTop = top + 15
      }

      tooltip.style.left = `${tooltipLeft}px`
      tooltip.style.top = `${tooltipTop}px`
    }
  }

  function hide() {
    if (tooltip) {
      tooltip.style.display = 'none'
    }
  }

  return {
    hooks: {
      init: [init],
      setCursor: [setTooltip],
      drawClear: [hide],
    },
  }
}