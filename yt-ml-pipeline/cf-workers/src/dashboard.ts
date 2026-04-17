/**
 * Multi-Market Dashboard HTML with Admin Panel
 * Served directly from CF Worker - Zero hosting cost
 * Chart.js via CDN (jsdelivr, cached globally)
 */

import { ADMIN_PANEL_HTML } from "./admin-panel";

export function generateDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Shorts Pipeline - Multi-Market Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1e293b;
    }
    h1 {
      font-size: 28px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    .stat-card h3 {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #f8fafc;
    }
    .market-section {
      margin-bottom: 40px;
    }
    .market-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .market-flag {
      font-size: 32px;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-card {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    .chart-card h4 {
      margin-bottom: 15px;
      color: #cbd5e1;
    }
    .ab-table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b;
      border-radius: 12px;
      overflow: hidden;
    }
    .ab-table th, .ab-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    .ab-table th {
      background: #0f172a;
      color: #94a3b8;
      font-weight: 600;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-green { background: #065f46; color: #6ee7b7; }
    .badge-yellow { background: #78350f; color: #fcd34d; }
    .badge-red { background: #7f1d1d; color: #fca5a5; }
    .badge-blue { background: #1e40af; color: #93c5fd; }
    .refresh-btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .refresh-btn:hover { background: #2563eb; }
    .loading {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
    }
    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🎬 AI Shorts Pipeline</h1>
        <p style="color: #94a3b8; margin-top: 8px;">Multi-Market Analytics Dashboard</p>
      </div>
      <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
    </header>

    <div id="loading" class="loading">
      <p>Loading dashboard...</p>
    </div>

    <div id="dashboard" style="display: none;">
      <!-- Global Stats -->
      <div class="stats-grid" id="global-stats"></div>

      <!-- Markets -->
      <div id="markets"></div>

      <!-- A/B Testing Results -->
      <div class="market-section">
        <h2 style="margin-bottom: 20px;">🧪 A/B Testing Results</h2>
        <table class="ab-table" id="ab-results">
          <thead>
            <tr>
              <th>Market</th>
              <th>Variant</th>
              <th>Videos</th>
              <th>Avg CTR</th>
              <th>Avg Eng.</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <!-- Admin Panel -->
      ${ADMIN_PANEL_HTML}
    </div>
  </div>

  <script>
    let charts = {};

    async function loadData() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        renderGlobalStats(data);
        renderMarkets(data);
        renderABTesting(data);
      } catch (err) {
        console.error('Failed to load data:', err);
        document.getElementById('loading').innerHTML = '<p style="color: #fca5a5;">Error loading dashboard. Please refresh.</p>';
      }
    }

    function renderGlobalStats(data) {
      const container = document.getElementById('global-stats');
      const totalVideos = Object.values(data.markets || {}).reduce((sum, m) => sum + m.videos, 0);
      const totalCost = Object.values(data.markets || {}).reduce((sum, m) => sum + m.cost, 0);
      const avgCTR = data.analytics?.avgCTR || 0;
      const avgEngagement = data.analytics?.avgEngagement || 0;

      container.innerHTML = \`
        <div class="stat-card">
          <h3>Total Videos</h3>
          <div class="value">\${totalVideos}</div>
        </div>
        <div class="stat-card">
          <h3>Monthly Cost</h3>
          <div class="value">€\${totalCost.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <h3>Avg CTR</h3>
          <div class="value">\${avgCTR.toFixed(1)}%</div>
        </div>
        <div class="stat-card">
          <h3>Avg Engagement</h3>
          <div class="value">\${avgEngagement.toFixed(1)}%</div>
        </div>
      \`;
    }

    function renderMarkets(data) {
      const container = document.getElementById('markets');
      container.innerHTML = '';

      const marketConfigs = {
        us: { flag: '🇺🇸', name: 'United States' },
        in: { flag: '🇮🇳', name: 'India' },
        af: { flag: '🌍', name: 'Africa' }
      };

      Object.entries(data.markets || {}).forEach(([code, market]) => {
        const config = marketConfigs[code] || { flag: '📊', name: code };
        
        const section = document.createElement('div');
        section.className = 'market-section';
        section.innerHTML = \`
          <div class="market-header">
            <span class="market-flag">\${config.flag}</span>
            <div>
              <h2>\${config.name}</h2>
              <p style="color: #94a3b8;">\${market.videos} videos • €\${market.cost.toFixed(2)} this month</p>
            </div>
          </div>
          <div class="charts-grid">
            <div class="chart-card">
              <h4>📈 Daily Videos</h4>
              <canvas id="chart-\${code}-daily"></canvas>
            </div>
            <div class="chart-card">
              <h4>💰 Cost Trend</h4>
              <canvas id="chart-\${code}-cost"></canvas>
            </div>
          </div>
        \`;
        container.appendChild(section);

        // Render charts
        setTimeout(() => {
          renderChart(\`chart-\${code}-daily\`, 'line', {
            labels: market.dailyData?.map(d => d.date) || [],
            datasets: [{
              label: 'Videos',
              data: market.dailyData?.map(d => d.count) || [],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true
            }]
          });

          renderChart(\`chart-\${code}-cost\`, 'bar', {
            labels: market.dailyData?.map(d => d.date) || [],
            datasets: [{
              label: 'Cost (€)',
              data: market.dailyData?.map(d => d.cost) || [],
              backgroundColor: '#8b5cf6'
            }]
          });
        }, 100);
      });
    }

    function renderABTesting(data) {
      const tbody = document.querySelector('#ab-results tbody');
      tbody.innerHTML = '';

      (data.abTesting || []).forEach(row => {
        const tr = document.createElement('tr');
        const statusBadge = row.isWinner 
          ? '<span class="badge badge-green">🏆 Winner</span>' 
          : row.videos > 5 
            ? '<span class="badge badge-yellow">📊 Testing</span>'
            : '<span class="badge badge-blue">🆕 New</span>';
        
        tr.innerHTML = \`
          <td>\${row.market.toUpperCase()}</td>
          <td>\${row.variant}</td>
          <td>\${row.videos}</td>
          <td>\${row.ctr?.toFixed(1) || '-'}%</td>
          <td>\${row.engagement?.toFixed(1) || '-'}%</td>
          <td>\${row.score?.toFixed(2) || '-'}</td>
          <td>\${statusBadge}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderChart(canvasId, type, chartData) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      
      if (charts[canvasId]) {
        charts[canvasId].destroy();
      }

      charts[canvasId] = new Chart(canvas, {
        type,
        data: chartData,
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { 
              ticks: { color: '#94a3b8' },
              grid: { color: '#334155' }
            },
            y: { 
              ticks: { color: '#94a3b8' },
              grid: { color: '#334155' }
            }
          }
        }
      });
    }

    // Auto-refresh every 60 seconds
    setInterval(loadData, 60000);
    
    // Initial load
    loadData();
  </script>
</body>
</html>
`;
}

export const DASHBOARD_HTML = generateDashboardHTML();
