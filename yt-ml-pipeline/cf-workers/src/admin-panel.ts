/**
 * Admin Panel HTML/JS
 * Password protected, alert history, manual sync triggers
 * Zero cost, 100% serverless
 */

export const ADMIN_PANEL_HTML = `
<style>
  .admin-section {
    margin-top: 40px;
    padding-top: 30px;
    border-top: 2px solid #334155;
  }
  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .admin-login {
    background: #1e293b;
    padding: 30px;
    border-radius: 12px;
    border: 1px solid #334155;
    max-width: 400px;
    margin: 0 auto;
  }
  .admin-login input {
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
  }
  .admin-login button {
    width: 100%;
    padding: 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .admin-login button:hover { background: #2563eb; }
  .alert-table {
    width: 100%;
    border-collapse: collapse;
    background: #1e293b;
    border-radius: 12px;
    overflow: hidden;
  }
  .alert-table th, .alert-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #334155;
  }
  .alert-table th {
    background: #0f172a;
    color: #94a3b8;
  }
  .sync-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 30px;
  }
  .sync-btn {
    padding: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    color: white;
  }
  .sync-btn-us { background: #3b82f6; }
  .sync-btn-in { background: #10b981; }
  .sync-btn-af { background: #f59e0b; }
  .sync-btn:hover { opacity: 0.9; }
  .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .hidden { display: none; }
</style>

<div class="admin-section">
  <div class="admin-header">
    <h2>🔐 Admin Panel</h2>
    <button id="admin-logout" class="hidden" onclick="logoutAdmin()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Logout</button>
  </div>

  <div id="admin-login-form" class="admin-login">
    <h3 style="margin-bottom: 15px;">Admin Login</h3>
    <input type="text" id="admin-user" placeholder="Username" />
    <input type="password" id="admin-pass" placeholder="Password" />
    <button onclick="loginAdmin()">Login</button>
    <p id="admin-error" style="color: #fca5a5; margin-top: 10px; display: none;"></p>
  </div>

  <div id="admin-content" class="hidden">
    <!-- Manual Sync -->
    <div style="margin-bottom: 40px;">
      <h3 style="margin-bottom: 15px;">🔄 Manual Sync</h3>
      <div class="sync-buttons">
        <button class="sync-btn sync-btn-us" onclick="triggerSync('us')">🇺🇸 Sync USA</button>
        <button class="sync-btn sync-btn-in" onclick="triggerSync('in')">🇮🇳 Sync India</button>
        <button class="sync-btn sync-btn-af" onclick="triggerSync('af')">🌍 Sync Africa</button>
      </div>
      <p id="sync-status" style="color: #94a3b8;"></p>
    </div>

    <!-- Alert History -->
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3>🚨 Alert History</h3>
        <button onclick="exportAlertsCSV()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">📥 Export CSV</button>
      </div>
      <table class="alert-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Market</th>
            <th>Message</th>
            <th>Job ID</th>
          </tr>
        </thead>
        <tbody id="alert-tbody">
          <tr><td colspan="5" style="text-align: center; color: #94a3b8;">Loading alerts...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  async function loginAdmin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const errorEl = document.getElementById('admin-error');
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass })
      });
      
      const data = await response.json();
      
      if (data.success) {
        sessionStorage.setItem('adminAuth', btoa(user + ':' + pass));
        showAdminContent();
      } else {
        errorEl.textContent = 'Invalid credentials';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Login failed';
      errorEl.style.display = 'block';
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem('adminAuth');
    document.getElementById('admin-login-form').classList.remove('hidden');
    document.getElementById('admin-content').classList.add('hidden');
    document.getElementById('admin-logout').classList.add('hidden');
  }

  async function showAdminContent() {
    document.getElementById('admin-login-form').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');
    document.getElementById('admin-logout').classList.remove('hidden');
    
    // Load alerts
    try {
      const auth = sessionStorage.getItem('adminAuth');
      const response = await fetch('/api/admin/alerts', {
        headers: { 'Authorization': 'Basic ' + auth }
      });
      const data = await response.json();
      
      const tbody = document.getElementById('alert-tbody');
      if (data.alerts && data.alerts.length > 0) {
        tbody.innerHTML = data.alerts.map(alert => {
          const bgColor = alert.type === 'ctr_critical' ? 'rgba(239, 68, 68, 0.1)' : 
                         alert.type === 'ctr_low' ? 'rgba(245, 158, 11, 0.1)' : 
                         'rgba(239, 68, 68, 0.05)';
          return \`<tr style="background: \${bgColor};">
            <td>\${new Date(alert.timestamp).toLocaleString()}</td>
            <td>\${alert.type}</td>
            <td>\${alert.market?.toUpperCase()}</td>
            <td>\${alert.message}</td>
            <td>\${alert.jobId || '-'}</td>
          </tr>\`;
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No alerts</td></tr>';
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }

  async function triggerSync(market) {
    const statusEl = document.getElementById('sync-status');
    const btn = document.querySelector(\`.sync-btn-\${market}\`);
    btn.disabled = true;
    btn.textContent = '⏳ Syncing...';
    statusEl.textContent = \`Triggering sync for \${market.toUpperCase()}...\`;
    
    try {
      const auth = sessionStorage.getItem('adminAuth');
      const response = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify({ market })
      });
      
      const data = await response.json();
      statusEl.textContent = \`✅ Sync triggered for \${market.toUpperCase()}. Check logs for progress.\`;
    } catch (err) {
      statusEl.textContent = \`❌ Sync failed: \${err.message}\`;
    }
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = market === 'us' ? '🇺🇸 Sync USA' : market === 'in' ? '🇮🇳 Sync India' : '🌍 Sync Africa';
    }, 5000);
  }

  // Auto-login if session exists
  window.addEventListener('load', () => {
    const auth = sessionStorage.getItem('adminAuth');
    if (auth) showAdminContent();
  });

  // Export alerts to CSV
  async function exportAlertsCSV() {
    try {
      const auth = sessionStorage.getItem('adminAuth');
      const response = await fetch('/api/admin/alerts', {
        headers: { 'Authorization': 'Basic ' + auth }
      });
      const data = await response.json();
      
      if (!data.alerts || data.alerts.length === 0) {
        alert('No alerts to export');
        return;
      }

      // Build CSV with BOM for Excel compatibility
      let csv = '\\uFEFFTimestamp,Type,Market,Message,Job ID\\n';
      data.alerts.forEach(alert => {
        const ts = new Date(alert.timestamp).toISOString();
        const type = alert.type || '';
        const market = alert.market || '';
        const message = (alert.message || '').replace(/"/g, '""');
        const jobId = alert.jobId || '';
        csv += '"' + ts + '","' + type + '","' + market + '","' + message + '","' + jobId + '"\\n';
      });

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'alerts_' + new Date().toISOString().split('T')[0] + '.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV');
    }
  }
</script>
`;
