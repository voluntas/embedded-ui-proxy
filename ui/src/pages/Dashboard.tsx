import { signal } from "@preact/signals";
import { CustomChart } from "../components/CustomChart";
import { SqlQueryEditor } from "../components/SqlQueryEditor";
import { SystemMetrics } from "../components/SystemMetrics";

type TabType = "metrics" | "query" | "chart";

const activeTab = signal<TabType>("metrics");

export function Dashboard() {
  const tabClass = (tab: TabType) =>
    `px-4 py-2 font-medium rounded-t-lg transition-colors ${
      activeTab.value === tab
        ? "bg-white text-blue-600 border-b-2 border-blue-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Embedded UI Proxy</h1>
          <p className="text-sm text-gray-600 mt-1">
            Browser-based real-time monitoring dashboard for Python application metrics with DuckDB
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg">
          <nav className="flex gap-2 px-6 pt-4">
            <button
              type="button"
              onClick={() => (activeTab.value = "metrics")}
              className={tabClass("metrics")}
            >
              System Metrics
            </button>
            <button
              type="button"
              onClick={() => (activeTab.value = "query")}
              className={tabClass("query")}
            >
              SQL Query
            </button>
            <button
              type="button"
              onClick={() => (activeTab.value = "chart")}
              className={tabClass("chart")}
            >
              Custom Chart
            </button>
          </nav>

          <div className="border-t">
            {activeTab.value === "metrics" && <SystemMetrics />}
            {activeTab.value === "query" && <SqlQueryEditor />}
            {activeTab.value === "chart" && <CustomChart />}
          </div>
        </div>
      </main>
    </div>
  );
}
