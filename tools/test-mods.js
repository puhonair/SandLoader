'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const locate = require('../src/asar/locate')
const reader = require('../src/asar/reader')
const modLoader = require('../src/mods/loader')
const disableShaders = require('../mods/disable-shaders/main')

async function testAll() {
  console.log('1. Testing Mod Discovery for bundled mods...')
  const modsRoot = path.join(__dirname, '..', 'mods')
  const discovered = modLoader.discover([modsRoot])
  assert.strictEqual(discovered.errors.length, 0, 'No errors in mod discovery: ' + JSON.stringify(discovered.errors))

  const modIds = discovered.mods.map((m) => m.id)
  console.log('Discovered mod IDs:', modIds)
  assert.ok(modIds.includes('gas-pipes'), 'gas-pipes must be discovered')
  assert.ok(modIds.includes('disable-shaders'), 'disable-shaders must be discovered')
  assert.ok(modIds.includes('global-blueprints'), 'global-blueprints must be discovered')

  const disableShadersMod = discovered.mods.find((m) => m.id === 'disable-shaders')
  assert.ok(disableShadersMod.main, 'disable-shaders must have main entrypoint')
  assert.ok(disableShadersMod.renderer, 'disable-shaders must have renderer entrypoint')

  const globalBpMod = discovered.mods.find((m) => m.id === 'global-blueprints')
  assert.ok(globalBpMod.renderer, 'global-blueprints must have renderer entrypoint')

  console.log('PASS: Mod discovery and manifest validation succeed!')

  console.log('\n2. Testing Disable Shaders patch syntax and regex...')
  // Test against synthetic bundle (portable across CI/Linux without game install)
  const syntheticBundle = 'prefix;(0,v.jsx)(Row,Object.assign({label:(0,t.t)("ui|options|showFps")},{children:(0,v.jsx)(Tgl,{checked:st.state.session.settings.showFps,onChange:p=>{st.state.session.settings.showFps=p;(0,mk.Aq)(st.state,en.JU.Options)}})}));suffix;'
  const syntheticPatch = disableShaders._test.createPatch(syntheticBundle, { info: console.log })
  assert.ok(syntheticPatch, 'createPatch returned synthetic patch')
  assert.ok(syntheticBundle.includes(syntheticPatch.find), 'patch.find must match synthetic target')
  assert.ok(syntheticPatch.replace.includes('ui|options|disableShaders'), 'replace includes disableShaders string')
  assert.ok(syntheticPatch.replace.includes('disableBackgroundShader'), 'replace includes disableBackgroundShader')

  // Check if live game installation is available
  let liveAsar = null
  const found = locate.tryLocate()
  if (found.ok && found.install && found.install.asar && fs.existsSync(found.install.asar)) {
    liveAsar = found.install.asar
  } else if (found.ok && found.install && found.install.resources) {
    const orig = path.join(found.install.resources, 'app.smln-original.asar')
    if (fs.existsSync(orig)) liveAsar = orig
  }

  if (liveAsar) {
    console.log(`\n3. Testing against real game archive (${liveAsar})...`)
    const archive = reader.open(liveAsar)
    let bundle
    try {
      bundle = archive.readText('dist/js/bundle.js')
    } finally {
      archive.close()
    }

    const patch = disableShaders._test.createPatch(bundle, { info: console.log })
    assert.ok(patch, 'createPatch returned patch for live bundle')
    assert.ok(bundle.includes(patch.find), 'patch.find must exist in live bundle')
    assert.ok(patch.replace.includes('ui|options|disableShaders'), 'replace includes disableShaders string')
    assert.ok(patch.replace.includes('disableBackgroundShader'), 'replace includes disableBackgroundShader')
    const patched = bundle.replace(patch.find, patch.replace)
    assert.notStrictEqual(patched, bundle, 'patched bundle must differ from original')
    console.log('PASS: Disable Shaders patch verified against live game bundle!')
  } else {
    console.log('\n3. Live game archive not present (CI / headless environment) - skipped real ASAR check.')
  }

  console.log('\nALL MOD TESTS PASSED!')
}

testAll().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
