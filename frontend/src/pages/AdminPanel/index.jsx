import React, { useState, useEffect, useCallback } from 'react';
import './AdminPanel.css';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

// ── API yardımcısı ──────────────────────────────────────────────
async function adminFetch(path, options = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ──────────────────────────────────────────────────────────────────
// Ana Admin Paneli
// ──────────────────────────────────────────────────────────────────
export default function AdminPanel({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('tenants');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminFetch('/api/admin/stats')
      .then((d) => setStats(d.stats))
      .catch(() => {});
  }, []);

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div className="admin-logo-icon">🏛️</div>
          <div>
            <div className="admin-logo-title">Admin Paneli</div>
            <div className="admin-logo-sub">B2B Yönetim</div>
          </div>
        </div>

        <nav className="admin-nav">
          {[
            { id: 'tenants',  icon: '🏢', label: 'Tenantlar',    sub: stats ? `${stats.activeTenants} aktif` : '...' },
            { id: 'apikeys',  icon: '🔑', label: 'API Key Yönet', sub: 'Oluştur / Yenile' },
            { id: 'webhooks', icon: '🪝', label: 'Webhook Logları', sub: 'Teslimat geçmişi' },
            { id: 'metrics',  icon: '📊', label: 'Kullanım',      sub: 'Kota & istatistik' },
          ].map((item) => (
            <button
              key={item.id}
              className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>
                <div className="admin-nav-label">{item.label}</div>
                <div className="admin-nav-sub">{item.sub}</div>
              </span>
            </button>
          ))}
        </nav>

        <button className="admin-back-btn" onClick={() => onNavigate && onNavigate('instructor-dashboard')}>
          ← Panele Dön
        </button>
      </aside>

      {/* Content */}
      <main className="admin-main">
        {/* Stats bar */}
        {stats && (
          <div className="admin-stats-bar">
            {[
              { label: 'Toplam Tenant', value: stats.totalTenants },
              { label: 'Aktif',         value: stats.activeTenants },
              { label: 'Free',          value: stats.byPlan?.free?.count ?? 0 },
              { label: 'Pro',           value: stats.byPlan?.pro?.count ?? 0 },
              { label: 'Enterprise',    value: stats.byPlan?.enterprise?.count ?? 0 },
            ].map((s) => (
              <div key={s.label} className="admin-stat-pill">
                <div className="admin-stat-value">{s.value ?? 0}</div>
                <div className="admin-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-content">
          {activeTab === 'tenants'  && <TenantManagement />}
          {activeTab === 'apikeys'  && <ApiKeyManager />}
          {activeTab === 'webhooks' && <WebhookLogs />}
          {activeTab === 'metrics'  && <UsageMetrics stats={stats} />}
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tenant Yönetimi
// ──────────────────────────────────────────────────────────────────
function TenantManagement() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newCred, setNewCred] = useState(null);
  const [form, setForm] = useState({
    name: '', contactEmail: '', plan: 'free', webhookUrl: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    adminFetch(`/api/admin/tenants?search=${encodeURIComponent(search)}`)
      .then((d) => setTenants(d.tenants || []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const data = await adminFetch('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setNewCred(data.credentials);
      setShowCreate(false);
      load();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const handleDeactivate = async (tenantId) => {
    if (!confirm('Bu tenantı deaktive etmek istediğinizden emin misiniz?')) return;
    try {
      await adminFetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const planBadge = (plan) => {
    const map = { free: 'badge-free', pro: 'badge-pro', enterprise: 'badge-enterprise' };
    return <span className={`badge ${map[plan] || 'badge-free'}`}>{plan.toUpperCase()}</span>;
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <div>
          <h2>🏢 Tenant Yönetimi</h2>
          <p>Kurumsal müşteri hesaplarını ve API erişimlerini yönetin.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Yeni Tenant</button>
      </div>

      <div className="search-bar">
        <input
          placeholder="🔍 Kurum adı, e-posta veya tenant ID ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Yeni API Key bildirimi */}
      {newCred && (
        <div className="cred-alert">
          <div className="cred-alert-title">⚠️ API Key — Sadece Bir Kez Gösterilir!</div>
          <div className="cred-row">
            <span className="cred-label">API Key:</span>
            <code className="cred-value">{newCred.apiKey}</code>
          </div>
          <div className="cred-row">
            <span className="cred-label">Webhook Secret:</span>
            <code className="cred-value">{newCred.webhookSecret}</code>
          </div>
          <button className="btn-close" onClick={() => setNewCred(null)}>Anladım, Kapat ✕</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Yeni Tenant Oluştur</h3>
            {[
              { key: 'name', label: 'Kurum Adı', type: 'text', ph: 'İstanbul Üniversitesi' },
              { key: 'contactEmail', label: 'İletişim E-posta', type: 'email', ph: 'admin@univ.edu.tr' },
              { key: 'webhookUrl', label: 'Webhook URL (Opsiyonel)', type: 'url', ph: 'https://...' },
            ].map(({ key, label, type, ph }) => (
              <div key={key} className="form-field">
                <label>{label}</label>
                <input
                  type={type}
                  placeholder={ph}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="form-field">
              <label>Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="free">Free (100 sınav/ay)</option>
                <option value="pro">Pro (1000 sınav/ay)</option>
                <option value="enterprise">Enterprise (Sınırsız)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
              <button className="btn-primary" onClick={handleCreate}>Oluştur</button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant listesi */}
      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kurum</th><th>Plan</th><th>API Key Prefix</th>
                <th>Sınav Kullanım</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.tenantId}>
                  <td>
                    <div className="tenant-name">{t.name}</div>
                    <div className="tenant-email">{t.contactEmail}</div>
                    <div className="tenant-id">{t.tenantId}</div>
                  </td>
                  <td>{planBadge(t.plan)}</td>
                  <td><code className="key-prefix">{t.apiKeyPrefix || '—'}</code></td>
                  <td>
                    <div className="quota-bar">
                      <div
                        className="quota-fill"
                        style={{
                          width: `${Math.min(((t.usage?.currentMonthExams || 0) / (t.quota?.examLimit || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="quota-text">
                      {t.usage?.currentMonthExams || 0} / {t.quota?.examLimit || '∞'}
                    </div>
                  </td>
                  <td>
                    <span className={`status-dot ${t.isActive ? 'active' : 'inactive'}`}>
                      {t.isActive ? '● Aktif' : '● Deaktif'}
                    </span>
                  </td>
                  <td>
                    {t.isActive && (
                      <button className="btn-danger-sm" onClick={() => handleDeactivate(t.tenantId)}>
                        Deaktive Et
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} className="empty-row">Tenant bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// API Key Yönetimi
// ──────────────────────────────────────────────────────────────────
function ApiKeyManager() {
  const [tenantId, setTenantId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const regenerate = async () => {
    if (!tenantId.trim()) return alert('Tenant ID girin.');
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/tenants/${tenantId}/regenerate-key`, {
        method: 'POST',
      });
      setResult(data.credentials);
    } catch (err) {
      alert(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const regenerateWebhookSecret = async () => {
    if (!tenantId.trim()) return alert('Tenant ID girin.');
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/tenants/${tenantId}/regenerate-webhook-secret`, {
        method: 'POST',
      });
      setResult({ webhookSecret: data.webhookSecret });
    } catch (err) {
      alert(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <div>
          <h2>🔑 API Key Yönetimi</h2>
          <p>Tenant API key'lerini ve webhook secret'larını yenileyin.</p>
        </div>
      </div>

      <div className="key-manager-card">
        <div className="form-field">
          <label>Tenant ID</label>
          <input
            placeholder="tenant_xxxxxxxxxxxx"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>

        <div className="key-actions">
          <button className="btn-primary" onClick={regenerate} disabled={loading}>
            {loading ? '...' : '🔄 API Key Yenile'}
          </button>
          <button className="btn-secondary" onClick={regenerateWebhookSecret} disabled={loading}>
            {loading ? '...' : '🔒 Webhook Secret Yenile'}
          </button>
        </div>

        {result && (
          <div className="cred-alert" style={{ marginTop: 20 }}>
            <div className="cred-alert-title">⚠️ Sadece Bir Kez Görüntülenir</div>
            {result.apiKey && (
              <div className="cred-row">
                <span className="cred-label">Yeni API Key:</span>
                <code className="cred-value">{result.apiKey}</code>
              </div>
            )}
            {result.webhookSecret && (
              <div className="cred-row">
                <span className="cred-label">Webhook Secret:</span>
                <code className="cred-value">{result.webhookSecret}</code>
              </div>
            )}
            <button className="btn-close" onClick={() => setResult(null)}>Anladım ✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Webhook Logları
// ──────────────────────────────────────────────────────────────────
function WebhookLogs() {
  const [tenantId, setTenantId] = useState('');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    if (!tenantId.trim()) return;
    setLoading(true);
    try {
      const [logData, statsData] = await Promise.all([
        adminFetch(`/api/webhooks/logs/${tenantId}?status=${statusFilter}`).catch(() => ({ logs: [] })),
        adminFetch(`/api/webhooks/stats/${tenantId}`).catch(() => null),
      ]);
      setLogs(logData.logs || []);
      if (statsData) setStats(statsData.stats);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    const map = { delivered: 'green', failed: 'red', retrying: 'yellow', pending: 'gray' };
    return map[status] || 'gray';
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <div>
          <h2>🪝 Webhook Teslimat Logları</h2>
          <p>HMAC-SHA256 imzalı webhook teslimat geçmişi ve hata raporları.</p>
        </div>
      </div>

      <div className="webhook-search">
        <input
          placeholder="Tenant ID girin..."
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="delivered">Teslim Edildi</option>
          <option value="failed">Başarısız</option>
          <option value="retrying">Tekrar Deneniyor</option>
          <option value="pending">Bekliyor</option>
        </select>
        <button className="btn-primary" onClick={load} disabled={loading}>
          {loading ? '...' : 'Sorgula'}
        </button>
      </div>

      {stats && (
        <div className="webhook-stats">
          {[
            { label: 'Toplam',   value: stats.total,     color: 'default' },
            { label: 'Teslim',   value: stats.delivered, color: 'green' },
            { label: 'Başarısız', value: stats.failed,   color: 'red' },
            { label: 'Başarı %', value: stats.successRate, color: 'green' },
          ].map((s) => (
            <div key={s.label} className="webhook-stat-pill">
              <div className={`webhook-stat-value ${s.color}`}>{s.value}</div>
              <div className="webhook-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Event</th><th>URL</th><th>Durum</th>
              <th>HTTP</th><th>Süre</th><th>Deneme</th><th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td><code className="event-tag">{log.event}</code></td>
                <td className="url-cell" title={log.url}>{log.url?.slice(0, 40)}...</td>
                <td>
                  <span className={`status-dot ${statusColor(log.status)}`}>
                    ● {log.status}
                  </span>
                </td>
                <td>{log.responseStatus ?? '—'}</td>
                <td>{log.durationMs ? `${log.durationMs}ms` : '—'}</td>
                <td>{log.attempts}/{log.maxAttempts}</td>
                <td className="date-cell">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR') : '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} className="empty-row">Log bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Kullanım Metrikleri
// ──────────────────────────────────────────────────────────────────
function UsageMetrics({ stats }) {
  if (!stats) return <div className="loading">İstatistikler yükleniyor...</div>;

  const plans = [
    { name: 'Free',       key: 'free',       color: '#64748b', icon: '🆓' },
    { name: 'Pro',        key: 'pro',        color: '#6366f1', icon: '⚡' },
    { name: 'Enterprise', key: 'enterprise', color: '#f59e0b', icon: '🏆' },
  ];

  return (
    <div className="admin-section">
      <div className="section-header">
        <div>
          <h2>📊 Kullanım Metrikleri</h2>
          <p>Platform genelinde tenant ve kullanım istatistikleri.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card big">
          <div className="metric-icon">🏢</div>
          <div className="metric-value">{stats.totalTenants}</div>
          <div className="metric-label">Toplam Tenant</div>
        </div>
        <div className="metric-card big">
          <div className="metric-icon">✅</div>
          <div className="metric-value">{stats.activeTenants}</div>
          <div className="metric-label">Aktif Tenant</div>
        </div>

        {plans.map((p) => {
          const planStats = stats.byPlan?.[p.key] || { count: 0, totalExams: 0 };
          return (
            <div key={p.key} className="metric-card" style={{ borderColor: `${p.color}33` }}>
              <div className="metric-icon">{p.icon}</div>
              <div className="metric-value" style={{ color: p.color }}>{planStats.count}</div>
              <div className="metric-label">{p.name} Tenantlar</div>
              <div className="metric-sub">{planStats.totalExams.toLocaleString()} toplam sınav</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
