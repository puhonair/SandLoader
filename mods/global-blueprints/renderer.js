/* eslint-env browser */
'use strict'

if (typeof SMLN !== 'undefined') {
  SMLN.log('info', 'Global Blueprints 1.0.0 renderer loaded')

  const STORAGE_KEY = 'smln:global_blueprints'

  function getGlobalStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch (_) {}
    return { version: 1, blueprints: {} }
  }

  function saveGlobalStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch (e) {
      SMLN.log('warn', 'Global Blueprints: could not write localStorage: ' + e.message)
    }
  }

  function getFH() {
    try {
      if (SMLN.game && SMLN.game.blueprints) return SMLN.game
      if (globalThis.FH && globalThis.FH.blueprints) return globalThis.FH
    } catch (_) {}
    return null
  }

  /**
   * Bidirectional sync:
   * 1. Any blueprint in the current world is added/updated in the global store.
   * 2. Any blueprint in the global store missing from the current world is imported.
   */
  function syncBlueprints(silent) {
    const fh = getFH()
    if (!fh || !fh.blueprints) return { ok: false, message: 'Game blueprints API not ready yet. Enter a world first.' }

    const bp = fh.blueprints
    const currentList = (typeof bp.getAll === 'function' ? bp.getAll() : []) || []
    const store = getGlobalStore()
    if (!store.blueprints) store.blueprints = {}

    let addedToGlobal = 0
    let addedToLocal = 0

    // 1. Current world -> Global store
    for (const item of currentList) {
      if (!item || !item.name || !item.data) continue
      const key = item.name
      const existing = store.blueprints[key]
      const needsUpdate = !existing ||
        JSON.stringify(existing.data) !== JSON.stringify(item.data) ||
        JSON.stringify(existing.signalLinks || null) !== JSON.stringify(item.signalLinks || null)

      if (needsUpdate) {
        store.blueprints[key] = {
          name: item.name,
          data: item.data,
          signalLinks: item.signalLinks || null,
          savedAt: Date.now()
        }
        addedToGlobal++
      }
    }

    if (addedToGlobal > 0) {
      saveGlobalStore(store)
      SMLN.log('info', `Global Blueprints: saved ${addedToGlobal} blueprint(s) to global library`)
    }

    // 2. Global store -> Current world
    const existingNames = new Set(currentList.map(x => x && x.name).filter(Boolean))
    const missingKeys = Object.keys(store.blueprints).filter(k => !existingNames.has(k))

    if (missingKeys.length > 0) {
      for (const k of missingKeys) {
        const item = store.blueprints[k]
        if (item && item.name && item.data) {
          try {
            if (typeof bp.save === 'function') {
              bp.save(item.name, item.data, item.signalLinks)
              addedToLocal++
            }
          } catch (e) {
            SMLN.log('warn', `Global Blueprints: failed to restore "${item.name}": ` + e.message)
          }
        }
      }
    }

    const totalGlobal = Object.keys(store.blueprints).length
    const totalLocal = (typeof bp.getAll === 'function' ? bp.getAll().length : currentList.length)

    if (!silent) {
      SMLN.log('info', `Global Blueprints sync: ${totalGlobal} in global library, ${totalLocal} in current save (restored ${addedToLocal}, saved ${addedToGlobal})`)
    }

    return {
      ok: true,
      totalGlobal,
      totalLocal,
      addedToGlobal,
      addedToLocal
    }
  }

  // Hook into FH when ready
  let hookedBlueprints = null
  function hookBlueprints() {
    const fh = getFH()
    if (!fh || !fh.blueprints) return

    const bp = fh.blueprints
    if (hookedBlueprints === bp) return
    hookedBlueprints = bp

    // Wrap save to auto-update global
    if (typeof bp.save === 'function') {
      const origSave = bp.save
      bp.save = function (name, data, signalLinks) {
        const res = origSave.apply(this, arguments)
        try {
          const store = getGlobalStore()
          if (!store.blueprints) store.blueprints = {}
          store.blueprints[name] = {
            name,
            data,
            signalLinks: signalLinks || null,
            savedAt: Date.now()
          }
          saveGlobalStore(store)
          SMLN.log('info', `Global Blueprints: saved "${name}" to global library`)
        } catch (_) {}
        return res
      }
    }

    // Initial sync with game world
    setTimeout(() => {
      syncBlueprints(true)
    }, 1500)

    SMLN.log('info', 'Global Blueprints auto-sync active')
  }

  // Periodically check and keep in sync with lifecycle cleanup
  if (globalThis.__smlnGlobalBpInterval) {
    clearInterval(globalThis.__smlnGlobalBpInterval)
  }
  const syncInterval = setInterval(() => {
    if (getFH()) {
      hookBlueprints()
      syncBlueprints(true)
    }
  }, 4000)
  globalThis.__smlnGlobalBpInterval = syncInterval

  if (typeof SMLN.onDispose === 'function') {
    SMLN.onDispose(() => {
      clearInterval(syncInterval)
      if (globalThis.__smlnGlobalBpInterval === syncInterval) {
        delete globalThis.__smlnGlobalBpInterval
      }
    })
  }

  // Register in-game console commands
  if (typeof SMLN.registerCommand === 'function') {
    SMLN.registerCommand({
      name: 'blueprints',
      summary: 'Manage and sync Global Blueprints library across saves',
      usage: 'blueprints <status|sync|list|export|clear>',
      args: [
        { name: 'action', values: () => ['status', 'sync', 'list', 'export', 'clear'] }
      ],
      run: (args) => {
        const action = (args && args[0] ? String(args[0]).toLowerCase() : 'status')
        const store = getGlobalStore()
        const keys = Object.keys(store.blueprints || {})

        if (action === 'status') {
          const syncRes = syncBlueprints(false)
          return [
            'Global Blueprints Status:',
            `• Global library total: ${keys.length} blueprint(s)`,
            `• Current save total: ${syncRes.ok ? syncRes.totalLocal : 'save not active'} blueprint(s)`,
            'All blueprints automatically sync between all your saves and new games.'
          ]
        }

        if (action === 'sync') {
          const r = syncBlueprints(false)
          if (!r.ok) return [r.message]
          return [
            'Global Blueprints Synchronized successfully!',
            `• Restored to current save: +${r.addedToLocal}`,
            `• Added to global bank: +${r.addedToGlobal}`,
            `• Total in global bank: ${r.totalGlobal}`
          ]
        }

        if (action === 'list') {
          if (!keys.length) return ['Global library is empty. Save a blueprint in any game to start.']
          const lines = ['Global Blueprints Library:']
          keys.forEach((k, idx) => {
            const item = store.blueprints[k]
            lines.push(`  ${idx + 1}. "${item.name}" (saved ${new Date(item.savedAt || Date.now()).toLocaleDateString()})`)
          })
          return lines
        }

        if (action === 'export') {
          const bpList = Object.values(store.blueprints || {})
          if (!bpList.length) {
            return ['Global Blueprints library is empty. Nothing to export.']
          }
          const exp = JSON.stringify(store.blueprints, null, 2)
          return [
            `Export payload for Global Blueprints library (${bpList.length} blueprint(s)):`,
            exp
          ]
        }

        if (action === 'clear') {
          try {
            localStorage.removeItem(STORAGE_KEY)
            return ['Global Blueprints library has been cleared. (Local save blueprints were left untouched).']
          } catch (e) {
            SMLN.log('warn', 'Global Blueprints: could not clear localStorage: ' + e.message)
            return ['Global Blueprints library could not be cleared: ' + e.message]
          }
        }

        return ['Unknown action. Use: blueprints <status|sync|list|export|clear>']
      }
    })
  }
}
