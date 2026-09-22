'use strict'

const fs = require('fs')
const path = require('path')

const TARGET = 'js/bundle.js'
const VERSION = '1.4.1'

/**
 * 0.5.7 keeps a typed liquidBuffer and only accepts matterType Liquid
 * (Lava is already excluded). Gas uses that same rectangle: the pump body.
 * Steam rises into a pump placed under the ceiling the way water sits in a
 * pump placed on the floor. A wider scan is not used; it walked off the top
 * of the map and the pump tick aborted.
 *
 * The build menu calls this category "Fluids" / "Жидкости". While the mod is
 * on, the same key reads "Liquids and gases" / "Жидкости и газы".
 */
const PUMP_PREDICATE = /([\w$]+)=([\w$]+)=>\{var ([\w$]+);return \2!==([\w$]+)\.([\w$]+)\.Lava&&\(null===\(\3=([\w$]+)\.([\w$]+)\[\2\]\)\|\|void 0===\3\?void 0:\3\.matterType\)===\4\.([\w$]+)\.Liquid\}/g

const CATEGORY_KEY = '"ui|management|category|fluids":"'
const CATEGORY_LABELS = {
  'js/bundle.js': 'Liquids and gases',
  'js/locales/cs.js': 'Kapaliny a plyny',
  'js/locales/da.js': 'Væsker og gasser',
  'js/locales/de.js': 'Flüssigkeiten und Gase',
  'js/locales/es.js': 'Líquidos y gases',
  'js/locales/esMX.js': 'Líquidos y gases',
  'js/locales/fi.js': 'Nesteet ja kaasut',
  'js/locales/fr.js': 'Liquides et gaz',
  'js/locales/hu.js': 'Folyadékok és gázok',
  'js/locales/it.js': 'Liquidi e gas',
  'js/locales/ja.js': '液体と気体',
  'js/locales/ko.js': '액체와 기체',
  'js/locales/nl.js': 'Vloeistoffen en gassen',
  'js/locales/no.js': 'Væsker og gasser',
  'js/locales/pl.js': 'Ciecze i gazy',
  'js/locales/ptBR.js': 'Líquidos e gases',
  'js/locales/ptPT.js': 'Líquidos e gases',
  'js/locales/ru.js': 'Жидкости и газы',
  'js/locales/sv.js': 'Vätskor och gaser',
  'js/locales/tr.js': 'Sıvılar ve gazlar',
  'js/locales/uk.js': 'Рідини й гази',
  'js/locales/zhCN.js': '液体和气体',
  'js/simulation-worker.js': 'Liquids and gases',
  'js/utility-worker.js': 'Liquids and gases',
  'js/locales/zhTW.js': '液體和氣體',
}

function bundlePath(smln) {
  const install = smln && smln.install
  if (install && install.distDir) return path.join(install.distDir, 'js', 'bundle.js')
  if (install && install.asar) return path.join(install.asar, 'dist', 'js', 'bundle.js')
  if (process.resourcesPath) return path.join(process.resourcesPath, 'app.asar', 'dist', 'js', 'bundle.js')
  return null
}

function readBundleSource(smln, file) {
  if (file) {
    try { return fs.readFileSync(file, 'utf8') } catch (_) {}
  }
  const asar = smln && smln.install && smln.install.asar
  if (asar) {
    try {
      const reader = require('../../src/asar/reader')
      const archive = reader.open(asar)
      try {
        return archive.readText('dist/js/bundle.js')
      } finally {
        archive.close()
      }
    } catch (_) {}
  }
  return null
}

function categoryPatches() {
  const out = []
  for (const [rel, label] of Object.entries(CATEGORY_LABELS)) {
    out.push({
      id: 'gas-pipes:category-' + rel.replace(/[^\w]+/g, '-'),
      description: 'Rename the fluids build category while Gas Pipes is loaded',
      find: /"ui\|management\|category\|fluids":"[^"]+"/g,
      replace: '"ui|management|category|fluids":"' + label + '"',
      expect: 1,
      required: false,
      target: rel,
    })
  }
  return out
}

function analyse(source, logger) {
  PUMP_PREDICATE.lastIndex = 0
  const found = []
  let match
  while ((match = PUMP_PREDICATE.exec(source)) !== null) {
    const after = source.slice(match.index, match.index + 2500)
    if (!after.includes('liquidBuffer')) continue
    found.push(match)
    if (!match[0].length) PUMP_PREDICATE.lastIndex++
  }

  if (found.length !== 1) {
    throw new Error(`expected one pump intake predicate, found ${found.length}`)
  }

  const m = found[0]
  const fn = m[1]
  const param = m[2]
  const tmp = m[3]
  const root = m[4]
  const lavaEnum = m[5]
  const table = m[6]
  const field = m[7]
  const matterEnum = m[8]
  const matter = '__smlnMatter'
  const stats = 'globalThis.__SMLN_GAS_PIPES_STATS__'
  const typeOf = `(null===(${tmp}=${table}.${field}[${param}])||void 0===${tmp}?void 0:${tmp}.matterType)`
  const isGas = `${matter}===${root}.${matterEnum}.Gas`
  const isLiquid = `${matter}===${root}.${matterEnum}.Liquid`

  const replace =
    `${fn}=${param}=>{var ${tmp},${matter};${matter}=${typeOf};` +
    `var __smlnZ=${stats}||(${stats}={version:"${VERSION}",checks:0,gasSeen:0,accepted:0});` +
    `__smlnZ.checks++;if(${isGas})__smlnZ.gasSeen++;` +
    `var __smlnOk=${param}!==${root}.${lavaEnum}.Lava&&(${isLiquid}||${isGas});` +
    `if(__smlnOk&&${isGas})__smlnZ.accepted++;return __smlnOk}`

  logger.info(
    `Gas Pipes ${VERSION}: pump body takes Liquid or Gas, same cells as water ` +
    `(${fn}, matter ${table}.${field}, enums ${root}.${matterEnum})`
  )

  return { find: m[0], replace }
}

module.exports.setup = ({ logger, smln }) => {
  const gameVersion = (smln && smln.install && smln.install.version) || 'unknown'
  logger.info(`Gas Pipes ${VERSION} loading for Sandustry ${gameVersion}`)

  const labels = categoryPatches()
  const file = bundlePath(smln)
  const source = readBundleSource(smln, file)
  if (!source) {
    logger.error('Gas Pipes: could not read installed bundle')
    return { patches: labels }
  }

  let patch
  try {
    patch = analyse(source, logger)
  } catch (e) {
    logger.error(`Gas Pipes: pump intake hook unavailable: ${e.message}`)
    return { patches: labels }
  }

  return {
    patches: labels.concat([
      {
        id: 'gas-pipes:pump-accepts-gas',
        description: 'Let the vanilla Pump take Gas as well as Liquid from the same cells it already scans, still refusing Lava.',
        find: patch.find,
        replace: patch.replace,
        expect: 1,
        required: true,
        target: TARGET,
      },
    ]),
  }
}

module.exports._test = { analyse, CATEGORY_KEY, CATEGORY_LABELS }
