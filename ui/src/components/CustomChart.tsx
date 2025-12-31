import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import type { AlignedData } from "uplot";
import { useContainerSize } from "../hooks/useContainerSize";
import { callQuery } from "../utils/jsonrpc";
import { tooltipPlugin } from "../utils/tooltipPlugin";
import { UPlotChart } from "./UPlotChart";

interface QueryResult {
  columns: string[];
  rows: Array<Array<unknown>>;
}

const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

const sql = signal(`SELECT
  timestamp,
  cpu_percent,
  memory_percent
FROM system_metrics
ORDER BY timestamp DESC
LIMIT 60`);
const chartData = signal<AlignedData | null>(null);
const columns = signal<string[]>([]);
const error = signal<string | null>(null);
const isExecuting = signal(false);
const autoRefresh = signal(true);

async function executeAndChart() {
  if (!sql.value.trim()) {
    error.value = "Please enter a SQL query";
    return;
  }

  isExecuting.value = true;
  error.value = null;

  try {
    const result = (await callQuery(sql.value)) as QueryResult;

    if (result.rows.length === 0) {
      error.value = "No data returned from query";
      chartData.value = null;
      return;
    }

    const xValues: number[] = [];
    const seriesData: number[][] = [];

    const dataColumns = result.columns.slice(1);
    columns.value = dataColumns;

    dataColumns.forEach(() => {
      seriesData.push([]);
    });

    result.rows.reverse().forEach((row) => {
      const xValue = row[0];
      if (typeof xValue === "string" && xValue.includes("T")) {
        xValues.push(new Date(xValue).getTime() / 1000);
      } else if (typeof xValue === "number") {
        xValues.push(xValue);
      } else {
        xValues.push(xValues.length);
      }

      for (let i = 1; i < row.length; i++) {
        const value = row[i];
        const series = seriesData[i - 1];
        if (series) {
          series.push(typeof value === "number" ? value : 0);
        }
      }
    });

    const alignedData: AlignedData = [xValues, ...seriesData];
    chartData.value = alignedData;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Query execution failed";
    chartData.value = null;
  } finally {
    isExecuting.value = false;
  }
}

function handleKeyDown(e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    void executeAndChart();
  }
}

export function CustomChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartSize = useContainerSize(chartContainerRef);

  // 自動更新の設定
  useEffect(() => {
    if (!autoRefresh.value) return;

    void executeAndChart();
    const interval = setInterval(() => void executeAndChart(), 1000);
    return () => clearInterval(interval);
  }, []);

  // autoRefresh が変わった時も再設定
  useEffect(() => {
    if (!autoRefresh.value) return;

    const interval = setInterval(() => void executeAndChart(), 1000);
    return () => clearInterval(interval);
  }, [autoRefresh.value]);

  const getChartOptions = () => {
    const series = [
      {},
      ...columns.value.map((col, i) => ({
        label: col,
        stroke: CHART_COLORS[i % CHART_COLORS.length],
        width: 2,
      })),
    ];

    return {
      title: "Custom Query Chart",
      width: chartSize.width,
      height: 400,
      plugins: [tooltipPlugin()],
      series,
      scales: {
        x: {
          time: sql.value.toLowerCase().includes("timestamp"),
        },
      },
      axes: [
        {
          stroke: "#9ca3af",
          grid: {
            stroke: "#e5e7eb",
            width: 1,
          },
        },
        {
          stroke: "#9ca3af",
          grid: {
            stroke: "#e5e7eb",
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
    };
  };

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
            value={sql.value}
            onInput={(e) => (sql.value = e.currentTarget.value)}
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
            disabled={isExecuting.value || !sql.value.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting.value ? "Executing..." : "Execute & Chart"}
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh.value}
              onChange={(e) => (autoRefresh.value = e.currentTarget.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm text-gray-700">Auto-refresh (1s)</span>
          </label>
        </div>

        {error.value && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error.value}
          </div>
        )}

        {chartData.value && (
          <div ref={chartContainerRef} className="bg-white rounded-lg shadow p-6">
            <UPlotChart data={chartData.value} options={getChartOptions()} />
          </div>
        )}
      </div>
    </div>
  );
}
