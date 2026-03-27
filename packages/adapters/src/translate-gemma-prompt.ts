/**
 * Replicates the TranslateGemma chat_template.jinja in TypeScript.
 *
 * The MLX-LM server unconditionally strips content arrays to plain strings
 * before the Jinja template runs, so we cannot use /v1/chat/completions.
 * Instead: pre-build the prompt here and call /v1/completions directly.
 *
 * Template source: mlx-community/translategemma-4b-it-4bit/chat_template.jinja
 */

/**
 * BCP-47 code → language name, as required by the TranslateGemma template.
 * Covers all languages in the app's language selector plus common extras.
 */
const TRANSLATE_GEMMA_LANGUAGES: Readonly<Record<string, string>> = {
  aa: 'Afar',
  af: 'Afrikaans',
  ak: 'Akan',
  am: 'Amharic',
  ar: 'Arabic',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ca: 'Catalan',
  ceb: 'Cebuano',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fil: 'Filipino',
  fr: 'French',
  ga: 'Irish',
  gl: 'Galician',
  gu: 'Gujarati',
  ha: 'Hausa',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  ht: 'Haitian Creole',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  ig: 'Igbo',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  jv: 'Javanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  km: 'Khmer',
  kn: 'Kannada',
  ko: 'Korean',
  ku: 'Kurdish',
  ky: 'Kyrgyz',
  la: 'Latin',
  lb: 'Luxembourgish',
  lo: 'Lao',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mg: 'Malagasy',
  mi: 'Māori',
  mk: 'Macedonian',
  ml: 'Malayalam',
  mn: 'Mongolian',
  mr: 'Marathi',
  ms: 'Malay',
  mt: 'Maltese',
  my: 'Burmese',
  ne: 'Nepali',
  nl: 'Dutch',
  no: 'Norwegian',
  ny: 'Nyanja',
  or: 'Odia',
  pa: 'Punjabi',
  pl: 'Polish',
  ps: 'Pashto',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  rw: 'Kinyarwanda',
  sd: 'Sindhi',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  sm: 'Samoan',
  sn: 'Shona',
  so: 'Somali',
  sq: 'Albanian',
  sr: 'Serbian',
  st: 'Southern Sotho',
  su: 'Sundanese',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  tg: 'Tajik',
  th: 'Thai',
  tk: 'Turkmen',
  tl: 'Filipino',
  tr: 'Turkish',
  tt: 'Tatar',
  ug: 'Uyghur',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  xh: 'Xhosa',
  yi: 'Yiddish',
  yo: 'Yoruba',
  zh: 'Chinese',
  'zh-hans': 'Chinese (Simplified)',
  'zh-hant': 'Chinese (Traditional)',
  zu: 'Zulu',
}

/**
 * Builds the formatted prompt string for a TranslateGemma text translation.
 * Exactly matches the Jinja template output for type:"text" content.
 *
 * Rendered format:
 * <bos><start_of_turn>user\n
 * You are a professional {SrcLang} ({srcCode}) to {TgtLang} ({tgtCode}) translator...
 * Produce only the {TgtLang} translation...:\n\n\n
 * {text}<end_of_turn>\n
 * <start_of_turn>model\n
 */
export function buildTranslateGemmaPrompt(
  sourceLangCode: string,
  targetLangCode: string,
  text: string,
): string {
  // Replicate template's `replace("_", "-")`
  const srcCode = sourceLangCode.replace(/_/g, '-')
  const tgtCode = targetLangCode.replace(/_/g, '-')

  const srcLang = TRANSLATE_GEMMA_LANGUAGES[srcCode] ?? srcCode
  const tgtLang = TRANSLATE_GEMMA_LANGUAGES[tgtCode] ?? tgtCode

  const trimmedText = text.trim()

  return (
    `<bos><start_of_turn>user\n` +
    `You are a professional ${srcLang} (${srcCode}) to ${tgtLang} (${tgtCode}) translator. ` +
    `Your goal is to accurately convey the meaning and nuances of the original ${srcLang} text ` +
    `while adhering to ${tgtLang} grammar, vocabulary, and cultural sensitivities.\n` +
    `Produce only the ${tgtLang} translation, without any additional explanations or commentary. ` +
    `Please translate the following ${srcLang} text into ${tgtLang}:\n\n\n` +
    `${trimmedText}<end_of_turn>\n` +
    `<start_of_turn>model\n`
  )
}
