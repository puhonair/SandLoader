/* eslint-env browser */
'use strict'
/**
 * SandLoader UI translation runtime. Installs `SMLN.i18n`.
 *
 * There is no framework here on purpose: the whole renderer is a handful of
 * concatenated ES5-ish files with no build step (see prelude.js), so pulling
 * in an i18n library would mean bundling one by hand. The actual job is
 * small - pick a locale, look a key up in a flat table, fill in `{name}`
 * placeholders - and does not need one.
 *
 * Locale selection follows Sandustry's own language setting. There is no
 * separate SandLoader picker: whatever the player chose in the game's
 * settings is the language of these menus too.
 *
 * The game API does not exist until `__capture` runs at `game:ready`, which
 * is after this file has already installed. Until that moment the browser
 * language is used so the first paint is not stuck on English, and from
 * `ready` onward `FH.i18n.getLocale()` wins. It is polled, because changing
 * the setting does not reload the page. A saved loader preference is ignored
 * on purpose — it used to pin an old language after the player changed the
 * game's.
 *
 * Fallback chain for a single lookup: active locale -> English -> the key
 * itself. A miss must never surface as the literal string "undefined" - that
 * is worse than showing an untranslated key, because a key at least tells a
 * developer what to go fill in.
 *
 * No HTML escaping happens in `t()`. Every call site in this codebase assigns
 * the result to `.textContent` (see modsui.js, splash.js), never to
 * `innerHTML`, so there is nothing here that ends up parsed as markup -
 * escaping it anyway would just double-encode a `&` a translator typed.
 *
 * Mod-supplied strings - a mod's own name, id or description - are never
 * routed through `t()`. Those belong to the mod's author; running them
 * through this catalogue would either do nothing (no matching key, silently
 * returns the string unchanged only because `t()` is never called on them)
 * or, worse, invite a future contributor to add a key for someone else's
 * product name. Only SandLoader's own UI chrome lives in locales.js.
 */
;(function installSmlnI18n(global) {
  var SMLN = global.__SMLN__
  if (!SMLN || SMLN.i18n) return

  var LOCALES = global.__SMLN_LOCALES__ || {}
  var FALLBACK = 'en'
  var changeListeners = []
  var warnedMissing = Object.create(null) // key -> true; a miss logs once, never per render.

  function hasLocale(code) {
    return !!(code && Object.prototype.hasOwnProperty.call(LOCALES, code))
  }

  function availableCodes() {
    var out = []
    for (var k in LOCALES) if (Object.prototype.hasOwnProperty.call(LOCALES, k)) out.push(k)
    return out
  }

  /**
   * Which plural slot a count uses.
   *
   * English and German only split 1 from everything else. Russian needs
   * three: one (1, 21, 31, … but not 11), few (2–4, 22–24, …) and many
   * (0, 5–20, 11–14, …). A catalogue that never filled the extra slots
   * still resolves, because the lookup tries `.other` and the bare key next.
   */
  function pluralSlot(n, code) {
    var abs = Math.abs(n)
    var mod10 = abs % 10
    var mod100 = abs % 100
    // Russian and Ukrainian agree on integers: 1, 21, 31… are one (not 11);
    // 2–4 are few (not 12–14); everything else is many.
    if (code === 'ru' || code === 'uk') {
      if (mod10 === 1 && mod100 !== 11) return 'one'
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
      return 'many'
    }
    // Polish: only exactly 1 is one. 21 and 31 are many. 2–4 are few (not 12–14).
    if (code === 'pl') {
      if (abs === 1) return 'one'
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
      return 'many'
    }
    // Czech: 1 is one, 2–4 are few, 0 and 5+ are other. 21 is not one.
    if (code === 'cs') {
      if (abs === 1) return 'one'
      if (abs >= 2 && abs <= 4) return 'few'
      return 'other'
    }
    return abs === 1 ? 'one' : 'other'
  }

  /**
   * Game settings use the same codes as the locale files (zhCN, ptBR, esMX)
   * and sometimes a BCP 47 tag (zh-CN, pt-BR). Both have to land on a
   * catalogue we actually ship.
   */
  function canonicalLocale(tag) {
    if (!tag || typeof tag !== 'string') return ''
    var lower = tag.replace(/_/g, '-').toLowerCase()
    var exact = {
      'zh-cn': 'zhCN', 'zhcn': 'zhCN', 'zh-hans': 'zhCN', 'zh-sg': 'zhCN',
      'zh-tw': 'zhTW', 'zhtw': 'zhTW', 'zh-hk': 'zhTW', 'zh-hant': 'zhTW',
      'pt-br': 'ptBR', 'ptbr': 'ptBR',
      'pt-pt': 'ptPT', 'ptpt': 'ptPT',
      'es-mx': 'esMX', 'esmx': 'esMX', 'es-419': 'esMX',
      'nb': 'no', 'nn': 'no', 'nb-no': 'no', 'nn-no': 'no',
    }
    if (exact[lower] && hasLocale(exact[lower])) return exact[lower]
    var primary = lower.split('-')[0]
    if (primary === 'zh') return hasLocale('zhCN') ? 'zhCN' : ''
    if (primary === 'pt') return hasLocale('ptPT') ? 'ptPT' : (hasLocale('ptBR') ? 'ptBR' : '')
    if (hasLocale(primary)) return primary
    var codes = Object.keys(LOCALES)
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === lower.replace(/-/g, '')) return codes[i]
    }
    return ''
  }

  function pickInitialLocale() {
    try {
      var nav = canonicalLocale(global.navigator && global.navigator.language)
      if (nav) return nav
    } catch (_) {}
    return FALLBACK
  }

  var active = pickInitialLocale()

  /**
   * SandLoader follows the language chosen in the game's own settings.
   * A saved loader preference must not pin an old language after the player
   * changes it there.
   */
  function followGameLocale(explicitCode) {
    try {
      var raw = explicitCode
      if (!raw && SMLN.game && SMLN.game.i18n && typeof SMLN.game.i18n.getLocale === 'function') {
        raw = SMLN.game.i18n.getLocale()
      }
      var code = canonicalLocale(raw)
      if (!code || code === active) return
      active = code
      notifyChange()
    } catch (e) {
      SMLN.log && SMLN.log('warn', 'i18n: reading the game locale failed: ' + (e && e.message))
    }
  }

  function hookGameLocaleEvents() {
    followGameLocale()
    if (SMLN.game && SMLN.game.i18n) {
      if (typeof SMLN.game.i18n.onLocaleChange === 'function') {
        try {
          SMLN.game.i18n.onLocaleChange(function (c) { followGameLocale(c) })
        } catch (_) {}
      }
      if (typeof SMLN.game.i18n.setLocale === 'function' && !SMLN.game.i18n.__smlnWrapped) {
        var origSetLocale = SMLN.game.i18n.setLocale
        SMLN.game.i18n.setLocale = async function (next) {
          try {
            var res = await origSetLocale.apply(this, arguments)
            followGameLocale(next)
            return res
          } catch (err) {
            followGameLocale(next)
            throw err
          }
        }
        SMLN.game.i18n.__smlnWrapped = true
      }
    }
  }

  if (typeof SMLN.on === 'function') {
    SMLN.on('ready', function () {
      hookGameLocaleEvents()
      if (global.setInterval) global.setInterval(followGameLocale, 1000)
    })
  }

  function lookupRaw(code, key) {
    var table = LOCALES[code]
    if (!table) return undefined
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined
  }

  function warnMissing(key) {
    if (warnedMissing[key]) return
    warnedMissing[key] = true
    SMLN.log && SMLN.log('debug', 'i18n: no translation for "' + key + '"')
  }

  /**
   * Resolve the raw (un-interpolated) template for `key`, applying the
   * `key.one` / `key.other` plural convention when `params.count` is given,
   * then the active -> English fallback. Returns undefined only when neither
   * locale has anything for any candidate.
   */
  function resolveTemplate(key, params) {
    var candidates = [key]
    if (params && typeof params === 'object' && params.count !== undefined && params.count !== null) {
      var n = Number(params.count)
      if (isFinite(n)) {
        var slot = pluralSlot(n, active)
        candidates = [key + '.' + slot]
        if (slot !== 'other') candidates.push(key + '.other')
        candidates.push(key)
      }
    }
    for (var i = 0; i < candidates.length; i++) {
      var v = lookupRaw(active, candidates[i])
      if (v !== undefined) return v
    }
    if (active !== FALLBACK) {
      for (var j = 0; j < candidates.length; j++) {
        var v2 = lookupRaw(FALLBACK, candidates[j])
        if (v2 !== undefined) return v2
      }
    }
    return undefined
  }

  /** `{name}` -> params.name. A placeholder with no matching param is left as-is. */
  function interpolate(template, params) {
    if (!params || typeof params !== 'object') return template
    return template.replace(/\{([^{}]+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    })
  }

  /**
   * Translate `key`. Never throws, on any input including `null`.
   * Fallback chain: active locale -> English -> the key itself.
   */
  function t(key, params) {
    try {
      if (typeof key !== 'string' || !key) return key == null ? '' : String(key)
      var template = resolveTemplate(key, params)
      if (template === undefined) {
        warnMissing(key)
        return key
      }
      return interpolate(String(template), params)
    } catch (e) {
      try { SMLN.log && SMLN.log('error', 'i18n.t("' + key + '") failed: ' + (e && e.message)) } catch (_) {}
      return typeof key === 'string' ? key : ''
    }
  }

  function has(key) {
    if (typeof key !== 'string' || !key) return false
    return lookupRaw(active, key) !== undefined || lookupRaw(FALLBACK, key) !== undefined
  }

  function locale() { return active }

  function locales() {
    return availableCodes().map(function (code) {
      var meta = (LOCALES[code] && LOCALES[code].__meta) || {}
      return {
        code: meta.code || code,
        nativeName: meta.nativeName || code,
        englishName: meta.englishName || code,
      }
    })
  }

  function variantsOf(key, fallback) {
    var out = []
    var codes = Object.keys(LOCALES)
    for (var i = 0; i < codes.length; i++) {
      var value = lookupRaw(codes[i], key)
      if (typeof value === 'string' && out.indexOf(value) < 0) out.push(value)
    }
    if (fallback && out.indexOf(fallback) < 0) out.push(fallback)
    return out
  }

  /**
   * The main menu is React. It reads menuLabel / mapsLabel while rendering
   * and then keeps the text it wrote. A language switch has to edit those
   * nodes itself, or the button stays in the previous language until the
   * player leaves the menu and comes back.
   */
  function rewriteMenuText() {
    var root = document.getElementById('ui')
    if (!root || typeof document.createTreeWalker !== 'function') return
    var modsFrom = variantsOf('mods.title', 'SandLoader Mods')
    var vanillaMods = ['Mods', 'Модификации', 'SandLoader Mods']
    for (var m = 0; m < vanillaMods.length; m++) {
      if (modsFrom.indexOf(vanillaMods[m]) < 0) modsFrom.push(vanillaMods[m])
    }

    var mapsFrom = variantsOf('maps.title', 'Maps')
    var vanillaMaps = [
      'Maps', 'Карты', 'Karten', 'Cartes', 'Mapas', 'Mappe', 'Kaarten',
      'Kort', 'Kartor', 'Kart', 'Kartat', 'Mapy', 'Карти', 'Térképek',
      'Haritalar', 'マップ', '맵', '地图', '地圖'
    ]
    for (var p = 0; p < vanillaMaps.length; p++) {
      if (mapsFrom.indexOf(vanillaMaps[p]) < 0) mapsFrom.push(vanillaMaps[p])
    }

    var jobs = []
    if (SMLN.menuLabel) jobs.push({ from: modsFrom, to: SMLN.menuLabel })
    if (SMLN.mapsLabel) jobs.push({ from: mapsFrom, to: SMLN.mapsLabel })
    if (!jobs.length) return
    var walker = document.createTreeWalker(root, 4)
    var node = walker.nextNode()
    while (node) {
      var raw = node.nodeValue
      var trimmed = raw && raw.trim()
      if (trimmed) {
        for (var j = 0; j < jobs.length; j++) {
          if (trimmed === jobs[j].to) break
          if (jobs[j].from.indexOf(trimmed) >= 0) {
            node.nodeValue = raw.replace(trimmed, jobs[j].to)
            break
          }
        }
      }
      node = walker.nextNode()
    }
  }

  function rewriteMenuSoon() {
    rewriteMenuText()
    var raf = global.requestAnimationFrame
    if (typeof raf === 'function') {
      raf(function () {
        rewriteMenuText()
        raf(rewriteMenuText)
      })
    }
    if (global.setTimeout) {
      global.setTimeout(rewriteMenuText, 50)
      global.setTimeout(rewriteMenuText, 200)
    }
  }

  function notifyChange() {
    for (var i = 0; i < changeListeners.length; i++) {
      try { changeListeners[i](active) } catch (e) {
        // A listener is UI code the mod/UI layer supplied; it must not be
        // able to wedge every other listener out of a language switch.
        SMLN.log && SMLN.log('error', 'i18n onChange listener threw: ' + (e && e.message))
      }
    }
    try { rewriteMenuSoon() } catch (e) {
      SMLN.log && SMLN.log('warn', 'i18n: menu relabel failed: ' + (e && e.message))
    }
  }

  /**
   * Switch the active locale, persist the choice on the main process, and
   * notify subscribers so they can re-render. Unknown codes degrade to
   * English rather than being rejected - there is no wrong input here that
   * should be able to leave the UI mid-switch.
   */
  function setLocale(code) {
    if (!hasLocale(code)) code = FALLBACK
    var changed = code !== active
    active = code
    // Not persisted. The game setting is read again every second and would
    // overwrite a private choice, so storing one would only lie about who won.
    if (changed) notifyChange()
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {}
    changeListeners.push(fn)
    return function off() {
      var i = changeListeners.indexOf(fn)
      if (i >= 0) changeListeners.splice(i, 1)
    }
  }

  /** Best-effort locale-aware number formatting; plain String() if Intl is missing. */
  function format(n) {
    try {
      if (typeof Intl !== 'undefined' && Intl.NumberFormat) return new Intl.NumberFormat(active).format(n)
    } catch (_) {}
    return String(n)
  }

  SMLN.i18n = {
    t: t,
    has: has,
    locale: locale,
    setLocale: setLocale,
    locales: locales,
    onChange: onChange,
    format: format,
  }

  SMLN.log && SMLN.log('info', 'i18n installed, locale=' + active)
})(typeof globalThis !== 'undefined' ? globalThis : window)
