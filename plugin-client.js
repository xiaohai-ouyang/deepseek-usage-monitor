/**
 * DeepSeek Usage Monitor — DSH 动态 Cordis 插件（Client 半）
 *
 * 本文件内容即 cordis_define 的 code.client 参数（纯 JavaScript 函数体，
 * 无 JSX/TypeScript，UI 全部使用 React.createElement）。
 *
 * 注册位置：
 *  - settings.section「DeepSeek 用量监控」：设置面板固定入口（总览/设置 双页签）
 *  - tool.view.cordis（key: self）：cordis_run 卡片内的同款面板
 *
 * 依赖：host.call 与 Host 半的 RPC 通信；timer 服务做自动刷新；
 * 配色全部使用 DSH 主题变量（--dsw-alias-*），自动适配明暗主题。
 */
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
.dsm-root { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px; font-size: 13px; color: var(--dsw-alias-label-primary, #d7dce4); }
.dsm-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsm-title { font-size: 15px; font-weight: 650; letter-spacing: 0.2px; }
.dsm-header-actions { display: flex; align-items: center; gap: 8px; }
.dsm-updated { font-size: 11px; color: var(--dsw-alias-label-secondary, #8a94a3); }
.dsm-btn { border: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.35)); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05)); color: inherit; border-radius: 8px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.dsm-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary, #4d6bfe); color: var(--dsw-alias-brand-primary, #4d6bfe); }
.dsm-btn:disabled { opacity: .5; cursor: default; }
.dsm-btn-primary { background: var(--dsw-alias-brand-primary, #4d6bfe); border-color: transparent; color: #fff; }
.dsm-btn-primary:hover:not(:disabled) { color: #fff; }
.dsm-btn-ghost { background: transparent; }
.dsm-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.25)); }
.dsm-tab { background: none; border: none; color: var(--dsw-alias-label-secondary, #8a94a3); font-size: 13px; padding: 6px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.dsm-tab-active { color: var(--dsw-alias-brand-primary, #4d6bfe); border-bottom-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.dsm-card { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.03)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.22)); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.dsm-card-title { font-size: 12px; color: var(--dsw-alias-label-secondary, #8a94a3); font-weight: 600; }
.dsm-balance-big { font-size: 22px; font-weight: 700; }
.dsm-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dsm-model-card { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.04)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.22)); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.dsm-model-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.dsm-model-name { font-weight: 650; font-size: 13.5px; }
.dsm-model-cost { font-weight: 700; color: var(--dsw-alias-brand-primary, #4d6bfe); }
.dsm-stat-row { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.dsm-stat { display: flex; flex-direction: column; gap: 2px; }
.dsm-stat-label { font-size: 11px; color: var(--dsw-alias-label-secondary, #8a94a3); }
.dsm-stat-value { font-size: 13px; font-weight: 600; }
.dsm-error { color: var(--dsw-alias-state-error-primary, #f87171); font-size: 12.5px; }
.dsm-ok { color: var(--dsw-alias-state-success-primary, #34d399); font-size: 12.5px; }
.dsm-muted { color: var(--dsw-alias-label-secondary, #8a94a3); font-size: 12px; }
.dsm-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; padding-top: 6px; }
.dsm-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; min-width: 0; }
.dsm-chart-bar { width: 100%; max-width: 26px; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; border-radius: 4px 4px 0 0; }
.dsm-bar-flash { background: #4d6bfe; }
.dsm-bar-pro { background: #9d7bf6; }
.dsm-chart-label { font-size: 10px; color: var(--dsw-alias-label-secondary, #8a94a3); }
.dsm-legend { display: flex; gap: 12px; font-size: 11px; color: var(--dsw-alias-label-secondary, #8a94a3); }
.dsm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dsm-dot-flash { background: #4d6bfe; }
.dsm-dot-pro { background: #9d7bf6; }
.dsm-input { flex: 1; min-width: 0; background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.35)); border-radius: 8px; color: inherit; padding: 6px 10px; font-size: 12.5px; }
.dsm-field { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsm-check { display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer; }
.dsm-select { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.05)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,137,150,.35)); border-radius: 8px; color: inherit; padding: 5px 8px; font-size: 12.5px; }
.dsm-note { line-height: 1.6; }
`)

    const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US')
    const fmtTokens = (n) => {
      n = Number(n) || 0
      if (n >= 1e8) return (n / 1e6).toFixed(0) + 'M'
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
      return String(Math.round(n))
    }
    const fmtMoney = (n) => '¥' + (Number(n) || 0).toFixed(2)
    const mmdd = (date) => {
      const parts = String(date).split('-')
      return parts.length === 3 ? Number(parts[1]) + '/' + Number(parts[2]) : date
    }
    const dateKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const recentDays = (days) => {
      const map = {}
      for (const d of days || []) map[d.date] = d
      const today = new Date()
      const out = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = dateKey(d)
        out.push(map[key] || { date: key, flashTokens: 0, proTokens: 0, totalTokens: 0, totalCost: 0 })
      }
      return out
    }

    const INTERVALS = [
      { label: '1 分钟', value: 60 },
      { label: '5 分钟', value: 300 },
      { label: '30 分钟', value: 1800 },
      { label: '1 小时', value: 3600 },
    ]

    const stat = (label, value) =>
      React.createElement('div', { className: 'dsm-stat', key: label },
        React.createElement('span', { className: 'dsm-stat-label' }, label),
        React.createElement('span', { className: 'dsm-stat-value' }, value),
      )

    function BarChart(props) {
      const days = props.days
      const max = Math.max.apply(null, [1].concat(days.map((d) => Number(d.totalTokens) || 0)))
      return React.createElement('div', { className: 'dsm-chart' },
        days.map((d) => {
          const flashH = Math.max(0, Math.round(((Number(d.flashTokens) || 0) / max) * 100))
          const proH = Math.max(0, Math.round(((Number(d.proTokens) || 0) / max) * 100))
          return React.createElement('div', { className: 'dsm-chart-col', key: d.date },
            React.createElement('div', { className: 'dsm-chart-bar' },
              React.createElement('div', { className: 'dsm-bar-flash', style: { height: flashH + '%' }, title: 'V4 Flash ' + fmtTokens(d.flashTokens) }),
              React.createElement('div', { className: 'dsm-bar-pro', style: { height: proH + '%' }, title: 'V4 Pro ' + fmtTokens(d.proTokens) }),
            ),
            React.createElement('span', { className: 'dsm-chart-label' }, mmdd(d.date)),
          )
        }),
      )
    }

    function Panel() {
      const [state, setState] = React.useState(null)
      const [balance, setBalance] = React.useState(null)
      const [usage, setUsage] = React.useState(null)
      const [balanceError, setBalanceError] = React.useState('')
      const [usageError, setUsageError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [updatedAt, setUpdatedAt] = React.useState(null)
      const [tab, setTab] = React.useState('dashboard')
      const [apiKey, setApiKey] = React.useState('')
      const [usageToken, setUsageToken] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [savedMsg, setSavedMsg] = React.useState('')

      const loadAll = React.useCallback(async () => {
        setBusy(true)
        try {
          const result = await host.call('refresh-all', {})
          if (result && typeof result === 'object') {
            if (result.balance) {
              if (result.balance.ok) { setBalance(result.balance.data); setBalanceError('') }
              else setBalanceError(String(result.balance.error || '余额查询失败'))
            }
            if (result.usage) {
              if (result.usage.ok) { setUsage(result.usage.data); setUsageError('') }
              else setUsageError(String(result.usage.error || '用量查询失败'))
            }
            if (result.lastUpdatedAt) setUpdatedAt(result.lastUpdatedAt)
          }
        } catch (error) {
          setBalanceError('刷新失败：' + String(error && error.message ? error.message : error))
        }
        setBusy(false)
      }, [])

      React.useEffect(() => {
        let alive = true
        void (async () => {
          try {
            const s = await host.call('get-state', {})
            if (!alive || !s) return
            setState(s)
            if (s.lastBalance) setBalance(s.lastBalance)
            if (s.lastUsage) setUsage(s.lastUsage)
            if (s.lastUpdatedAt) setUpdatedAt(s.lastUpdatedAt)
          } catch (error) {
            console.error('dsmon: get-state failed', error)
          }
        })()
        return () => { alive = false }
      }, [])

      const autoEnabled = !!(state && state.autoRefreshEnabled)
      const intervalSec = state && state.refreshIntervalSeconds ? state.refreshIntervalSeconds : 60
      React.useEffect(() => {
        if (!autoEnabled) return
        void loadAll()
        return ctx.interval(() => { void loadAll() }, intervalSec * 1000)
      }, [autoEnabled, intervalSec, loadAll])

      const saveCred = async (field, value) => {
        setSaving(true)
        setSavedMsg('')
        try {
          const patch = field === 'apiKey' ? { apiKey: value } : { usageToken: value }
          const result = await host.call('save-config', patch)
          const s = await host.call('get-state', {})
          setState(s)
          if (field === 'usageToken') {
            if (result && result.tokenValid === true) {
              setSavedMsg('用量 Token 已保存并验证通过')
              setUsageToken('')
            } else if (result && result.tokenValid === false) {
              setSavedMsg('已保存，但验证失败：' + (result.tokenError || '未知错误'))
            } else {
              setSavedMsg('已保存')
            }
          } else {
            setSavedMsg('API Key 已保存')
            setApiKey('')
          }
          if (field === 'apiKey' && value.trim()) {
            const r = await host.call('fetch-balance', {})
            if (r && r.ok) { setBalance(r.data); setBalanceError(''); setUpdatedAt(Date.now()) }
            else setBalanceError(String((r && r.error) || '余额查询失败'))
          }
        } catch (error) {
          setSavedMsg('保存失败：' + String(error && error.message ? error.message : error))
        }
        setSaving(false)
      }

      const clearCred = async (field) => {
        setSaving(true)
        setSavedMsg('')
        try {
          await host.call('clear-credentials', { field })
          const s = await host.call('get-state', {})
          setState(s)
          if (field === 'apiKey') { setBalance(null); setBalanceError('') }
          if (field === 'usageToken') { setUsage(null); setUsageError('') }
          setSavedMsg(field === 'apiKey' ? 'API Key 已清除' : '用量 Token 已清除')
        } catch (error) {
          setSavedMsg('清除失败：' + String(error && error.message ? error.message : error))
        }
        setSaving(false)
      }

      const saveAuto = async (patch) => {
        try {
          await host.call('save-config', patch)
          const s = await host.call('get-state', {})
          setState(s)
        } catch (error) {
          console.error('dsmon: save auto failed', error)
        }
      }

      const modelCard = (m) =>
        React.createElement('div', { className: 'dsm-model-card', key: m.key },
          React.createElement('div', { className: 'dsm-model-head' },
            React.createElement('span', { className: 'dsm-model-name' }, m.name),
            React.createElement('span', { className: 'dsm-model-cost' }, fmtMoney(m.cost)),
          ),
          React.createElement('div', { className: 'dsm-stat-row' },
            stat('总 Token', fmtTokens(m.totalTokens)),
            stat('请求数', fmtInt(m.requestCount)),
          ),
          React.createElement('div', { className: 'dsm-stat-row' },
            stat('缓存命中', fmtTokens(m.cacheHitTokens)),
            stat('缓存未命中', fmtTokens(m.cacheMissTokens)),
            stat('输出', fmtTokens(m.responseTokens)),
          ),
        )

      const renderDashboard = () => {
        const monthLabel = usage && usage.month && usage.year ? usage.year + ' 年 ' + usage.month + ' 月' : '本月'
        const totalTokens = usage && usage.models ? usage.models.reduce((a, m) => a + (Number(m.totalTokens) || 0), 0) : 0
        const totalRequests = usage && usage.models ? usage.models.reduce((a, m) => a + (Number(m.requestCount) || 0), 0) : 0
        return React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, '账户余额'),
            balance ? React.createElement(React.Fragment, null,
              React.createElement('div', { className: 'dsm-balance-big' }, (balance.currency || '') + ' ' + (balance.totalBalance || '0')),
              React.createElement('div', { className: 'dsm-stat-row' },
                stat('赠送余额', (balance.currency || '') + ' ' + (balance.grantedBalance || '0')),
                stat('充值余额', (balance.currency || '') + ' ' + (balance.toppedUpBalance || '0')),
                stat('状态', balance.isAvailable ? '可用' : '不可用'),
              ),
            ) : balanceError
              ? React.createElement('div', { className: 'dsm-error' }, balanceError)
              : React.createElement('div', { className: 'dsm-muted' }, '暂无数据，请先在“设置”中保存 API Key'),
          ),
          React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, monthLabel + ' 用量'),
            usage ? React.createElement(React.Fragment, null,
              React.createElement('div', { className: 'dsm-stat-row' },
                stat('本月消费', fmtMoney(usage.monthCost)),
                stat('模型 Token', fmtTokens(totalTokens) + '（' + fmtInt(totalTokens) + '）'),
                stat('请求数', fmtInt(totalRequests)),
              ),
              React.createElement('div', { className: 'dsm-grid' },
                (usage.models || []).map((m) => modelCard(m)),
              ),
            ) : usageError
              ? React.createElement('div', { className: 'dsm-error' }, usageError)
              : React.createElement('div', { className: 'dsm-muted' }, '暂无数据，请先在“设置”中配置用量 Token'),
          ),
          usage && usage.days && usage.days.length > 0 ? React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, '最近 7 天 Token 趋势'),
            React.createElement(BarChart, { days: recentDays(usage.days) }),
            React.createElement('div', { className: 'dsm-legend' },
              React.createElement('span', null, React.createElement('span', { className: 'dsm-dot dsm-dot-flash' }), 'V4 Flash'),
              React.createElement('span', null, React.createElement('span', { className: 'dsm-dot dsm-dot-pro' }), 'V4 Pro'),
            ),
          ) : null,
        )
      }

      const renderSettings = () =>
        React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, 'API Key · 查询余额'),
            React.createElement('div', { className: 'dsm-field' },
              React.createElement('input', { className: 'dsm-input', type: 'password', placeholder: 'sk-…（platform.deepseek.com → API Keys）', value: apiKey, autoComplete: 'off', onChange: (e) => setApiKey(e.target.value) }),
              React.createElement('button', { className: 'dsm-btn dsm-btn-primary', disabled: saving || !apiKey.trim(), onClick: () => { void saveCred('apiKey', apiKey) } }, '保存'),
              React.createElement('button', { className: 'dsm-btn dsm-btn-ghost', disabled: saving || !(state && state.apiKeyConfigured), onClick: () => { void clearCred('apiKey') } }, '清除'),
            ),
            state && state.apiKeyConfigured
              ? React.createElement('div', { className: 'dsm-muted' }, '已保存：' + (state.apiKeyPreview || '已保存'))
              : React.createElement('div', { className: 'dsm-muted' }, '尚未配置。API Key 来自 DeepSeek 开放平台的 API Keys 页面。'),
          ),
          React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, '用量 Token · 平台用量统计'),
            React.createElement('div', { className: 'dsm-field' },
              React.createElement('input', { className: 'dsm-input', type: 'password', placeholder: '控制台执行 JSON.parse(localStorage.userToken).value', value: usageToken, autoComplete: 'off', onChange: (e) => setUsageToken(e.target.value) }),
              React.createElement('button', { className: 'dsm-btn dsm-btn-primary', disabled: saving || !usageToken.trim(), onClick: () => { void saveCred('usageToken', usageToken) } }, '保存并验证'),
              React.createElement('button', { className: 'dsm-btn dsm-btn-ghost', disabled: saving || !(state && state.usageTokenConfigured), onClick: () => { void clearCred('usageToken') } }, '清除'),
            ),
            React.createElement('div', { className: 'dsm-muted' },
              state && state.usageTokenConfigured
                ? '已保存：' + (state.usageTokenPreview || '已保存') + '。Token 过期后用量查询会报 401，重新获取即可。'
                : '尚未配置。DeepSeek 官方未提供用量 API，需网页登录 Token：在已登录 platform.deepseek.com 的浏览器控制台执行 JSON.parse(localStorage.userToken).value 获取。',
            ),
          ),
          React.createElement('div', { className: 'dsm-card' },
            React.createElement('div', { className: 'dsm-card-title' }, '自动刷新'),
            React.createElement('div', { className: 'dsm-field' },
              React.createElement('label', { className: 'dsm-check' },
                React.createElement('input', { type: 'checkbox', checked: !!(state && state.autoRefreshEnabled), onChange: (e) => { void saveAuto({ autoRefreshEnabled: e.target.checked }) } }),
                ' 启用自动刷新',
              ),
              React.createElement('select', { className: 'dsm-select', value: state && state.refreshIntervalSeconds ? state.refreshIntervalSeconds : 60, onChange: (e) => { void saveAuto({ refreshIntervalSeconds: Number(e.target.value) }) } },
                INTERVALS.map((opt) => React.createElement('option', { key: opt.value, value: opt.value }, opt.label)),
              ),
            ),
          ),
          savedMsg ? React.createElement('div', { className: savedMsg.indexOf('失败') >= 0 ? 'dsm-error' : 'dsm-ok' }, savedMsg) : null,
          React.createElement('div', { className: 'dsm-note dsm-muted' },
            '凭据明文保存在本机 ' + (state && state.configPath ? state.configPath : '.deepseek-monitor.config.json') + '，请勿外传、勿截图公开。本插件仅用于个人用量监控，请遵守 DeepSeek 使用条款，避免频繁请求。',
          ),
        )

      return React.createElement('div', { className: 'dsm-root' },
        React.createElement('div', { className: 'dsm-header' },
          React.createElement('span', { className: 'dsm-title' }, 'DeepSeek 用量监控'),
          React.createElement('div', { className: 'dsm-header-actions' },
            updatedAt ? React.createElement('span', { className: 'dsm-updated' }, '更新于 ' + new Date(updatedAt).toLocaleTimeString()) : null,
            React.createElement('button', { className: 'dsm-btn', disabled: busy, onClick: () => { void loadAll() } }, busy ? '刷新中…' : '刷新'),
          ),
        ),
        React.createElement('div', { className: 'dsm-tabs' },
          React.createElement('button', { className: 'dsm-tab' + (tab === 'dashboard' ? ' dsm-tab-active' : ''), onClick: () => setTab('dashboard') }, '总览'),
          React.createElement('button', { className: 'dsm-tab' + (tab === 'settings' ? ' dsm-tab-active' : ''), onClick: () => setTab('settings') }, '设置'),
        ),
        tab === 'dashboard' ? renderDashboard() : renderSettings(),
      )
    }

    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      () => React.createElement(Panel, null),
    ))

    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'deepseek-monitor', order: 25, label: 'DeepSeek 用量监控' },
      () => React.createElement(Panel, null),
    ))
  },
}
