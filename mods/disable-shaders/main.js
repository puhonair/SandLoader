'use strict'

const TARGET = 'js/bundle.js'

/**
 * Patch the video options menu to include the Disable Shaders toggle.
 *
 * Sandustry already supports `session.settings.disableBackgroundShader` and
 * `session.settings.disableShadows`, and includes the translation key
 * `ui|options|disableShaders` in all 23 language bundles.
 * This patch restores the UI element directly beside the "Show FPS" toggle.
 */
function createPatch(source, logger) {
  const SHOW_FPS_REGEX = /(\(0,([\w$]+)\.jsx\)\(([\w$]+),Object\.assign\(\{label:\(0,([\w$]+)\.t\)\(["']ui\|options\|showFps["']\)\},\{children:\(0,\2\.jsx\)\(([\w$]+),\{checked:([\w$]+)\.state\.session\.settings\.showFps,onChange:([\w$]+)=>\{[^}]+\(0,([\w$]+)\.Aq\)\(\6\.state,([\w$]+)\.JU\.Options\)\}\}\)\}\)\))/

  const match = SHOW_FPS_REGEX.exec(source)
  if (!match) {
    throw new Error('Show FPS options row not found in bundle.js')
  }

  const full = match[1]
  const jsxVar = match[2]
  const rowComp = match[3]
  const i18nVar = match[4]
  const toggleComp = match[5]
  const stateVar = match[6]
  const paramVar = match[7]
  const markDirtyVar = match[8]
  const enumVar = match[9]

  const shaderToggle =
    `,(0,${jsxVar}.jsx)(${rowComp},Object.assign({label:(0,${i18nVar}.t)("ui|options|disableShaders")},{children:(0,${jsxVar}.jsx)(${toggleComp},{checked:Boolean(${stateVar}.state.session.settings.disableBackgroundShader),onChange:${paramVar}=>{${stateVar}.state.session.settings.disableBackgroundShader=${paramVar};${stateVar}.state.session.settings.disableShadows=${paramVar};try{if(${stateVar}.state.session.rendering&&${stateVar}.state.session.rendering.pixi&&typeof ${stateVar}.state.session.rendering.pixi.toggleSkyFilter==='function'){${stateVar}.state.session.rendering.pixi.toggleSkyFilter(!${paramVar})}}catch(_){};(0,${markDirtyVar}.Aq)(${stateVar}.state,${enumVar}.JU.Options)}})}))`

  const replace = full + shaderToggle

  if (logger && typeof logger.info === 'function') {
    logger.info(`Disable Shaders: options menu patch ready (matched showFps at offset ${match.index})`)
  }

  return {
    find: full,
    replace: replace,
  }
}

module.exports.setup = ({ logger, smln }) => {
  logger.info('Disable Shaders mod setup starting')
  let patch
  try {
    const install = smln && smln.install
    const reader = require('../../src/asar/reader')
    const asar = install && install.asar
    if (!asar) throw new Error('game asar path not provided')
    const archive = reader.open(asar)
    let source
    try {
      source = archive.readText('dist/js/bundle.js')
    } finally {
      archive.close()
    }
    patch = createPatch(source, logger)
  } catch (e) {
    logger.error(`Disable Shaders: patch creation failed: ${e.message}`)
    return { patches: [] }
  }

  return {
    patches: [
      {
        id: 'disable-shaders:options-toggle',
        description: 'Restore Disable Shaders checkbox to Video Options menu',
        find: patch.find,
        replace: patch.replace,
        expect: 1,
        required: true,
        target: TARGET,
      },
    ],
  }
}

module.exports._test = { createPatch }
