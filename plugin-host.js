/**
 * DeepSeek Usage Monitor — DSH 动态 Cordis 插件（Host 半）
 *
 * 本文件内容即 cordis_define 的 code.host 参数（纯 JavaScript 函数体）。
 * 在 DSH 会话中安装时，将整个函数体复制到 cordis_define 的 code.host。
 *
 * 职责：
 *  - 通过系统 curl 调 DeepSeek 官方余额接口（api.deepseek.com/user/balance，需 API Key）
 *  - 通过平台内部接口拉取用量与费用（platform.deepseek.com/api/v0/usage/amount|cost，需网页登录 Token）
 *  - 凭据持久化到工作区根目录的 .deepseek-monitor.config.json
 *  - 通过 harness.handle 向 Client 暴露 RPC：get-state / save-config / clear-credentials /
 *    fetch-balance / fetch-usage / refresh-all
 *
 * 参考项目：https://github.com/JayHome137/DeepSeekMonitorWindows（MIT）
 */
return {
  inject: ['fs', 'subprocess'],
  apply(ctx) {
    const CONFIG_FILE = '.deepseek-monitor.config.json'
    const ALLOWED_INTERVALS = [60, 300, 1800, 3600]

    const sandboxPolicy = ctx.get('sandboxPolicy')
    const workspaceRoot =
      sandboxPolicy && typeof sandboxPolicy.workspaceRoot === 'string'
        ? sandboxPolicy.workspaceRoot
        : ''

    let config = {
      apiKey: '',
      usageToken: '',
      refreshIntervalSeconds: 60,
      autoRefreshEnabled: false,
    }
    let lastBalance = null
    let lastUsage = null
    let lastUpdatedAt = null

    const configTarget = () =>
      ctx.fs.resolve(CONFIG_FILE, workspaceRoot ? { cwd: workspaceRoot } : {})

    const loadConfig = async () => {
      try {
        const target = await configTarget()
        const info = await ctx.fs.stat(target)
        if (info === undefined) return
        const text = await ctx.fs.readText(target)
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          config = {
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
            usageToken: typeof parsed.usageToken === 'string' ? parsed.usageToken : '',
            refreshIntervalSeconds:
              ALLOWED_INTERVALS.indexOf(parsed.refreshIntervalSeconds) >= 0
                ? parsed.refreshIntervalSeconds
                : 60,
            autoRefreshEnabled: parsed.autoRefreshEnabled === true,
          }
        }
      } catch (error) {
        console.error('dsmon: load config failed:', error)
      }
    }
    const ready = loadConfig()

    const persistConfig = async () => {
      const target = await configTarget()
      await ctx.fs.writeText(target, JSON.stringify(config, null, 2))
    }

    const maskSecret = (value) => {
      if (!value) return ''
      if (value.length <= 12) return '已保存'
      return value.slice(0, 7) + '...' + value.slice(-4)
    }

    const configPathLabel = () =>
      (workspaceRoot ? workspaceRoot.replace(/[\\/]+$/, '') + '\\' : '') + CONFIG_FILE

    const resolveCurl = async () => {
      const candidates = ['curl', 'curl.exe', 'C:\\Windows\\System32\\curl.exe']
      for (const candidate of candidates) {
        try {
          return await ctx.subprocess.resolveExecutable(candidate)
        } catch (error) {
          /* try next */
        }
      }
      throw new Error('未找到 curl 可执行文件')
    }

    const runCurl = async (url, token, timeoutSeconds) => {
      const exe = await resolveCurl()
      const argv = [
        exe,
        '--silent', '--show-error', '--max-time', String(timeoutSeconds),
        '--header', 'Authorization: Bearer ' + token,
        '--header', 'x-app-version: 1.0.0',
        '--header', 'Accept: */*',
        '--header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        '--output', '-',
        '--write-out', '\\n__DSM_STATUS__%{http_code}',
        url,
      ]
      const handle = ctx.subprocess.spawn({
        argv,
        cwd: workspaceRoot || '.',
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 4 * 1024 * 1024, spill: { maxBytes: 16 * 1024 * 1024 } },
          stderr: { maxBytes: 256 * 1024 },
        },
        graceMs: 3000,
      })
      const outcome = await handle.done
      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      const marker = '__DSM_STATUS__'
      const markerIndex = stdout.lastIndexOf(marker)
      let body = stdout
      let status = 0
      if (markerIndex >= 0) {
        status = parseInt(stdout.slice(markerIndex + marker.length).trim(), 10) || 0
        body = stdout.slice(0, markerIndex)
      }
      return { exitCode: outcome.exitCode, status, body, stderr }
    }

    const httpJson = async (url, token, timeoutSeconds) => {
      const res = await runCurl(url, token, timeoutSeconds)
      if (res.exitCode !== 0) {
        throw new Error('网络请求失败（curl 退出码 ' + res.exitCode + '）' + (res.stderr ? '：' + res.stderr.trim().slice(0, 200) : ''))
      }
      if (res.status === 401) throw new Error('凭据无效或已过期（HTTP 401）')
      if (res.status === 429) throw new Error('请求过于频繁，请稍后再试（HTTP 429）')
      if (res.status >= 500) throw new Error('DeepSeek 服务器错误：HTTP ' + res.status)
      if (res.status !== 200) throw new Error('请求失败：HTTP ' + res.status)
      try {
        return JSON.parse(res.body)
      } catch (error) {
        throw new Error('解析响应 JSON 失败')
      }
    }

    const fetchBalanceRaw = async () => {
      if (!config.apiKey) throw new Error('未配置 API Key')
      const data = await httpJson('https://api.deepseek.com/user/balance', config.apiKey, 15)
      if (!data || typeof data !== 'object' || !Array.isArray(data.balance_infos) || data.balance_infos.length === 0) {
        throw new Error('余额信息为空')
      }
      const info = data.balance_infos[0]
      return {
        isAvailable: data.is_available === true,
        currency: String(info.currency || ''),
        totalBalance: String(info.total_balance || ''),
        grantedBalance: String(info.granted_balance || ''),
        toppedUpBalance: String(info.topped_up_balance || ''),
      }
    }

    const tokenBreakdown = (usage) => {
      let total = 0, request = 0, hit = 0, miss = 0, response = 0
      if (!Array.isArray(usage)) return { total, request, hit, miss, response }
      for (const entry of usage) {
        const value = Math.round(parseFloat(entry.amount) || 0)
        if (entry.type === 'REQUEST') request = value
        else if (entry.type === 'PROMPT_CACHE_HIT_TOKEN') { hit = value; total += value }
        else if (entry.type === 'PROMPT_CACHE_MISS_TOKEN') { miss = value; total += value }
        else if (entry.type === 'RESPONSE_TOKEN') { response = value; total += value }
        else if (entry.type === 'PROMPT_TOKEN') total += value
      }
      return { total, request, hit, miss, response }
    }

    const costSum = (usage) => {
      if (!Array.isArray(usage)) return 0
      let sum = 0
      for (const entry of usage) {
        if (entry.type === 'REQUEST') continue
        sum += parseFloat(entry.amount) || 0
      }
      return sum
    }

    const fetchUsageForMonth = async (month, year) => {
      if (!config.usageToken) throw new Error('未配置用量 Token')
      const amountUrl = 'https://platform.deepseek.com/api/v0/usage/amount?month=' + month + '&year=' + year
      const costUrl = 'https://platform.deepseek.com/api/v0/usage/cost?month=' + month + '&year=' + year
      const amount = await httpJson(amountUrl, config.usageToken, 15)
      const cost = await httpJson(costUrl, config.usageToken, 15)
      const biz = amount && amount.data && amount.data.biz_data
      if (!biz || !Array.isArray(biz.total) || !Array.isArray(biz.days)) throw new Error('用量数据格式异常')

      const costBiz = cost && cost.data && Array.isArray(cost.data.biz_data) ? cost.data.biz_data : []
      const costTotal = costBiz.length > 0 ? costBiz[0] : null

      const costForModel = (model) => {
        if (!costTotal || !Array.isArray(costTotal.total)) return 0
        const found = costTotal.total.find((m) => m.model === model)
        return found ? costSum(found.usage) : 0
      }

      const models = []
      const known = {
        'deepseek-v4-flash': ['flash', 'V4 Flash'],
        'deepseek-v4-pro': ['pro', 'V4 Pro'],
      }
      for (const modelUsage of biz.total) {
        const label = known[modelUsage.model]
        if (!label) continue
        const bd = tokenBreakdown(modelUsage.usage)
        models.push({
          key: label[0], name: label[1], model: modelUsage.model,
          totalTokens: bd.total, requestCount: bd.request,
          cacheHitTokens: bd.hit, cacheMissTokens: bd.miss, responseTokens: bd.response,
          cost: costForModel(modelUsage.model),
        })
      }
      if (models.length === 0) {
        for (const modelUsage of biz.total) {
          const bd = tokenBreakdown(modelUsage.usage)
          models.push({
            key: String(modelUsage.model), name: String(modelUsage.model), model: String(modelUsage.model),
            totalTokens: bd.total, requestCount: bd.request,
            cacheHitTokens: bd.hit, cacheMissTokens: bd.miss, responseTokens: bd.response,
            cost: costForModel(modelUsage.model),
          })
        }
      }

      const costByDate = {}
      if (costTotal && Array.isArray(costTotal.days)) {
        for (const day of costTotal.days) {
          costByDate[day.date] = (day.data || []).reduce((acc, m) => acc + costSum(m.usage), 0)
        }
      }

      const days = []
      for (const day of biz.days) {
        const agg = { flash: 0, flashHit: 0, flashMiss: 0, flashResp: 0, pro: 0, proHit: 0, proMiss: 0, proResp: 0, total: 0 }
        for (const modelUsage of (day.data || [])) {
          const bd = tokenBreakdown(modelUsage.usage)
          agg.total += bd.total
          if (modelUsage.model === 'deepseek-v4-flash') {
            agg.flash += bd.total; agg.flashHit += bd.hit; agg.flashMiss += bd.miss; agg.flashResp += bd.response
          } else if (modelUsage.model === 'deepseek-v4-pro') {
            agg.pro += bd.total; agg.proHit += bd.hit; agg.proMiss += bd.miss; agg.proResp += bd.response
          }
        }
        days.push({
          date: String(day.date),
          flashTokens: agg.flash, flashCacheHit: agg.flashHit, flashCacheMiss: agg.flashMiss, flashResponse: agg.flashResp,
          proTokens: agg.pro, proCacheHit: agg.proHit, proCacheMiss: agg.proMiss, proResponse: agg.proResp,
          totalTokens: agg.total,
          totalCost: costByDate[day.date] || 0,
        })
      }

      const monthCost = costTotal && Array.isArray(costTotal.total)
        ? costTotal.total.reduce((acc, m) => acc + costSum(m.usage), 0)
        : 0

      return { models, days, monthCost, month, year }
    }

    const fetchUsageAll = async () => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const current = await fetchUsageForMonth(month, year)
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(now.getDate() - 6)
      if (sevenDaysAgo.getMonth() !== now.getMonth()) {
        try {
          const prev = new Date(year, month - 2, 1)
          const previous = await fetchUsageForMonth(prev.getMonth() + 1, prev.getFullYear())
          current.days = previous.days.concat(current.days)
        } catch (error) {
          console.error('dsmon: previous month usage failed:', error)
        }
      }
      return current
    }

    const verifyUsageToken = async (token) => {
      const now = new Date()
      const url = 'https://platform.deepseek.com/api/v0/usage/amount?month=' + (now.getMonth() + 1) + '&year=' + now.getFullYear()
      await httpJson(url, token, 15)
    }

    const tryFetch = async (fn) => {
      try {
        return { ok: true, data: await fn() }
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) }
      }
    }

    const refreshAll = async () => {
      const balanceResult = await tryFetch(fetchBalanceRaw)
      if (balanceResult.ok) lastBalance = balanceResult.data
      const usageResult = await tryFetch(fetchUsageAll)
      if (usageResult.ok) lastUsage = usageResult.data
      if (balanceResult.ok || usageResult.ok) lastUpdatedAt = Date.now()
      return { balance: balanceResult, usage: usageResult, lastUpdatedAt }
    }

    harness.handle('get-state', async () => {
      await ready
      return {
        apiKeyConfigured: config.apiKey.length > 0,
        apiKeyPreview: config.apiKey ? maskSecret(config.apiKey) : null,
        usageTokenConfigured: config.usageToken.length > 0,
        usageTokenPreview: config.usageToken ? maskSecret(config.usageToken) : null,
        refreshIntervalSeconds: config.refreshIntervalSeconds,
        autoRefreshEnabled: config.autoRefreshEnabled,
        configPath: configPathLabel(),
        lastBalance,
        lastUsage,
        lastUpdatedAt,
      }
    })

    harness.handle('save-config', async (args) => {
      await ready
      const patch = (args && typeof args === 'object') ? args : {}
      if (typeof patch.apiKey === 'string') config.apiKey = patch.apiKey.trim()
      if (typeof patch.usageToken === 'string') config.usageToken = patch.usageToken.trim()
      if (typeof patch.refreshIntervalSeconds === 'number' && ALLOWED_INTERVALS.indexOf(patch.refreshIntervalSeconds) >= 0) {
        config.refreshIntervalSeconds = patch.refreshIntervalSeconds
      }
      if (typeof patch.autoRefreshEnabled === 'boolean') config.autoRefreshEnabled = patch.autoRefreshEnabled

      let tokenValid = null
      let tokenError = null
      if (typeof patch.usageToken === 'string' && config.usageToken) {
        try {
          await verifyUsageToken(config.usageToken)
          tokenValid = true
        } catch (error) {
          tokenValid = false
          tokenError = String(error && error.message ? error.message : error)
        }
      }
      await persistConfig()
      return { ok: true, tokenValid, tokenError }
    })

    harness.handle('clear-credentials', async (args) => {
      await ready
      const field = args && args.field
      if (field === 'apiKey') config.apiKey = ''
      if (field === 'usageToken') config.usageToken = ''
      await persistConfig()
      return { ok: true }
    })

    harness.handle('fetch-balance', async () => {
      await ready
      const result = await tryFetch(fetchBalanceRaw)
      if (result.ok) { lastBalance = result.data; lastUpdatedAt = Date.now() }
      return result
    })

    harness.handle('fetch-usage', async () => {
      await ready
      const result = await tryFetch(fetchUsageAll)
      if (result.ok) { lastUsage = result.data; lastUpdatedAt = Date.now() }
      return result
    })

    harness.handle('refresh-all', async () => {
      await ready
      return refreshAll()
    })
  },
}
