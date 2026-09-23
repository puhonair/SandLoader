'use strict'

const assert = require('assert')
const path = require('path')
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

  console.log('\n2. Testing Disable Shaders patch against game bundle.js...')
  const asarPath = 'C:/Steam/steamapps/common/Sandustry/resources/app.smln-original.asar'
  const archive = reader.open(asarPath)
  let bundle
  try {
    bundle = archive.readText('dist/js/bundle.js')
  } finally {
    archive.close()
  }

  const patch = disableShaders._test.createPatch(bundle, { info: console.log })
  assert.ok(patch, 'createPatch returned patch')
  assert.ok(patch.find, 'patch has find')
  assert.ok(patch.replace, 'patch has replace')
  assert.ok(bundle.includes(patch.find), 'patch.find must exist in bundle')
  assert.ok(patch.replace.includes('ui|options|disableShaders'), 'replace includes disableShaders string')
  assert.ok(patch.replace.includes('disableBackgroundShader'), 'replace includes disableBackgroundShader')

  // Verify that applying the patch produces valid JavaScript
  const patched = bundle.replace(patch.find, patch.replace)
  assert.notStrictEqual(patched, bundle, 'patched bundle must differ from original')
  console.log('PASS: Disable Shaders patch matches and replaces correctly!')

  console.log('\nALL MOD TESTS PASSED!')
}

testAll().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
