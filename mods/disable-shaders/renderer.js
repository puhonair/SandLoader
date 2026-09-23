/* eslint-env browser */
'use strict'

if (typeof SMLN !== 'undefined') {
  SMLN.log('info', 'Disable Shaders 1.0.0 renderer loaded')

  function getSession() {
    try {
      if (SMLN.game && SMLN.game.session) return SMLN.game.session
      if (globalThis.__SMLN_CURRENT_SESSION__) return globalThis.__SMLN_CURRENT_SESSION__
      if (globalThis.session) return globalThis.session
    } catch (_) {}
    return null
  }

  function applyShaders(disabled) {
    const s = getSession()
    if (!s || !s.settings) {
      return { ok: false, message: 'Game session or settings not active yet. Enter a world first.' }
    }
    s.settings.disableBackgroundShader = !!disabled
    s.settings.disableShadows = !!disabled
    try {
      if (s.rendering && s.rendering.pixi && typeof s.rendering.pixi.toggleSkyFilter === 'function') {
        s.rendering.pixi.toggleSkyFilter(!disabled)
      }
    } catch (e) {
      return { ok: false, message: 'Applied settings, but toggleSkyFilter threw: ' + e.message }
    }
    return { ok: true, disabled: !!disabled }
  }

  if (typeof SMLN.registerCommand === 'function') {
    SMLN.registerCommand({
      name: 'shaders',
      summary: 'Toggle or configure background/sky shaders and shadows',
      usage: 'shaders <on|off|toggle|status>',
      args: [
        { name: 'action', values: () => ['on', 'off', 'toggle', 'status'] },
      ],
      run: (args) => {
        const action = args && args[0] ? String(args[0]).toLowerCase() : 'toggle'
        const s = getSession()
        const currentDisabled = !!(s && s.settings && s.settings.disableBackgroundShader)

        if (action === 'status') {
          return [
            `Shaders are currently: ${currentDisabled ? 'DISABLED (max performance)' : 'ENABLED (default visuals)'}`,
            `Background filter: ${currentDisabled ? 'OFF' : 'ON'}`,
            `Shadow raycasting: ${s && s.settings && s.settings.disableShadows ? 'OFF' : 'ON'}`,
          ]
        }

        let targetDisabled
        if (action === 'on') targetDisabled = false
        else if (action === 'off') targetDisabled = true
        else if (action === 'toggle') targetDisabled = !currentDisabled
        else {
          return [
            `Unknown action "${args[0]}".`,
            'Usage: shaders <on|off|toggle|status>',
          ]
        }

        const res = applyShaders(targetDisabled)
        if (!res.ok) return [res.message]
        return [
          `Shaders are now ${targetDisabled ? 'DISABLED (Performance mode)' : 'ENABLED (Default mode)'}.`,
        ]
      },
    })
  }
}
