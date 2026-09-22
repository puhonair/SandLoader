/* eslint-env browser */
'use strict'

SMLN.log('info', 'Gas Pipes 1.4.1 renderer loaded')

var CATEGORY_TRANSLATIONS = {
  en: { 'ui|management|category|fluids': 'Liquids and gases' },
  cs: { 'ui|management|category|fluids': 'Kapaliny a plyny' },
  da: { 'ui|management|category|fluids': 'Væsker og gasser' },
  de: { 'ui|management|category|fluids': 'Flüssigkeiten und Gase' },
  es: { 'ui|management|category|fluids': 'Líquidos y gases' },
  esMX: { 'ui|management|category|fluids': 'Líquidos y gases' },
  fi: { 'ui|management|category|fluids': 'Nesteet ja kaasut' },
  fr: { 'ui|management|category|fluids': 'Liquides et gaz' },
  hu: { 'ui|management|category|fluids': 'Folyadékok és gázok' },
  it: { 'ui|management|category|fluids': 'Liquidi e gas' },
  ja: { 'ui|management|category|fluids': '液体と気体' },
  ko: { 'ui|management|category|fluids': '액체와 기체' },
  nl: { 'ui|management|category|fluids': 'Vloeistoffen en gassen' },
  no: { 'ui|management|category|fluids': 'Væsker og gasser' },
  pl: { 'ui|management|category|fluids': 'Ciecze i gazy' },
  ptBR: { 'ui|management|category|fluids': 'Líquidos e gases' },
  ptPT: { 'ui|management|category|fluids': 'Líquidos e gases' },
  ru: { 'ui|management|category|fluids': 'Жидкости и газы' },
  sv: { 'ui|management|category|fluids': 'Vätskor och gaser' },
  tr: { 'ui|management|category|fluids': 'Sıvılar ve gazlar' },
  uk: { 'ui|management|category|fluids': 'Рідини й гази' },
  zhCN: { 'ui|management|category|fluids': '液体和气体' },
  zhTW: { 'ui|management|category|fluids': '液體和氣體' },
}

if (typeof SMLN !== 'undefined' && SMLN.register && SMLN.register.translations) {
  SMLN.register.translations(CATEGORY_TRANSLATIONS)
}

SMLN.registerCommand({
  name: 'gaspipes',
  summary: 'Show Gas Pipes live Pump diagnostics',
  usage: 'gaspipes',
  args: [],
  run: () => {
    const s = globalThis.__SMLN_GAS_PIPES_STATS__
    if (!s) {
      return [
        'Gas Pipes 1.4.1 renderer is loaded.',
        'The patched Pump code has not executed yet.',
        'Run a connected Pump, then run gaspipes again.',
        'If this stays unchanged, the intake patch did not apply.',
      ]
    }
    return [
      'Gas Pipes ' + s.version,
      'pump cell checks: ' + s.checks,
      'gas cells seen: ' + s.gasSeen,
      'gas cells accepted: ' + s.accepted,
    ]
  },
})
