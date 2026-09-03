/**
 * Natural-language intent detection shared by the Voice Assistant and Smart Search.
 * Works on Hindi (Devanagari), English and Hinglish text — keyword + synonym matching,
 * no external NLP service required.
 */
import { CROPS } from './data'
import { UP_DISTRICT_NAMES } from './up'

export type PortalPage =
  | 'dashboard'
  | 'crops'
  | 'prices'
  | 'smart'
  | 'sell'
  | 'orders'
  | 'transactions'
  | 'finance'
  | 'voice'
  | 'notifications'
  | 'profile'
  | 'admin'
  | 'grading'

export type IntentKey =
  | 'crop_price'
  | 'search_mandi'
  | 'sell_crop'
  | 'check_order'
  | 'transaction_history'
  | 'financial_support'
  | 'crop_quality'
  | 'market_recommendation'
  | 'notifications'
  | 'help'

export interface Intent {
  key: IntentKey
  label: string
  labelHi: string
  action: string
  page: PortalPage
  crop?: string
  district?: string
  amount?: number
}

const CROP_SYNONYMS: Record<string, string> = {
  wheat: 'Wheat', गेहूं: 'Wheat', गेहू: 'Wheat', gehu: 'Wheat', gehun: 'Wheat',
  paddy: 'Rice (Paddy)', rice: 'Rice (Paddy)', धान: 'Rice (Paddy)', चावल: 'Rice (Paddy)', dhan: 'Rice (Paddy)', chawal: 'Rice (Paddy)',
  sugarcane: 'Sugarcane', गन्ना: 'Sugarcane', ganna: 'Sugarcane',
  potato: 'Potato', आलू: 'Potato', aloo: 'Potato', alu: 'Potato',
  mustard: 'Mustard', सरसों: 'Mustard', sarson: 'Mustard',
  maize: 'Maize', corn: 'Maize', मक्का: 'Maize', makka: 'Maize',
  arhar: 'Pulses (Arhar)', अरहर: 'Pulses (Arhar)', tur: 'Pulses (Arhar)', दाल: 'Pulses (Arhar)', pulses: 'Pulses (Arhar)',
  mango: 'Mango', आम: 'Mango', aam: 'Mango',
}

const RULES: { key: IntentKey; page: PortalPage; action: string; label: string; labelHi: string; words: string[] }[] = [
  {
    key: 'financial_support', page: 'finance', action: 'Open Financial Support and pre-fill the amount',
    label: 'Financial Support', labelHi: 'वित्तीय सहायता',
    words: ['loan', 'credit', 'financial', 'finance', 'paisa', 'rupaye', 'rupees', 'karz', 'karza', 'udhaar', 'लोन', 'कर्ज', 'पैसा', 'रुपये', 'वित्तीय', 'सहायता', 'ऋण'],
  },
  {
    key: 'check_order', page: 'orders', action: 'Show your orders and their live status',
    label: 'Check Order', labelHi: 'ऑर्डर स्थिति',
    words: ['order', 'orders', 'pending order', 'delivery', 'transit', 'ऑर्डर', 'आर्डर', 'डिलीवरी'],
  },
  {
    key: 'transaction_history', page: 'transactions', action: 'Open transaction history',
    label: 'Transaction History', labelHi: 'लेन-देन इतिहास',
    words: ['transaction', 'history', 'len den', 'len-den', 'lenden', 'payment', 'bhugtan', 'लेन-देन', 'लेनदेन', 'इतिहास', 'भुगतान', 'हिसाब'],
  },
  {
    key: 'crop_quality', page: 'grading', action: 'Open AI Quality Grading',
    label: 'Crop Quality', labelHi: 'फसल गुणवत्ता',
    words: ['quality', 'grade', 'grading', 'photo', 'गुणवत्ता', 'क्वालिटी', 'ग्रेड', 'फोटो', 'jaanch', 'जांच'],
  },
  {
    key: 'market_recommendation', page: 'smart', action: 'Run the Smart Selling recommendation',
    label: 'Market Recommendation', labelHi: 'बिक्री सलाह',
    words: ['best mandi', 'kaha bechu', 'kahan bechu', 'kaha bechun', 'recommend', 'salah', 'sabse achha', 'sabse acchi', 'kab bechu', 'सबसे अच्छा', 'सबसे अच्छी', 'कहाँ बेचूं', 'कहां बेचूं', 'कब बेचूं', 'सलाह', 'सुझाव'],
  },
  {
    key: 'sell_crop', page: 'sell', action: 'Start the sell-produce flow',
    label: 'Sell Crop', labelHi: 'फसल बेचें',
    words: ['sell', 'bechna', 'bech', 'listing', 'list karo', 'बेचना', 'बेचें', 'बेचूँ', 'बिक्री'],
  },
  {
    key: 'search_mandi', page: 'prices', action: 'Show nearby mandis',
    label: 'Search Mandi', labelHi: 'मंडी खोजें',
    words: ['mandi', 'market', 'e-nam', 'enam', 'apmc', 'मंडी', 'बाज़ार', 'बाजार'],
  },
  {
    key: 'crop_price', page: 'prices', action: 'Search crop prices',
    label: 'Crop Price Search', labelHi: 'भाव खोजें',
    words: ['price', 'bhav', 'rate', 'daam', 'भाव', 'दाम', 'कीमत', 'रेट'],
  },
  {
    key: 'notifications', page: 'notifications', action: 'Open notifications',
    label: 'Notifications', labelHi: 'सूचनाएं',
    words: ['notification', 'alert', 'suchna', 'सूचना', 'सूचनाएं', 'अलर्ट'],
  },
]

export function detectCrop(text: string): string | undefined {
  const t = text.toLowerCase()
  for (const c of CROPS) if (t.includes(c.toLowerCase().split(' ')[0])) return c
  for (const [word, crop] of Object.entries(CROP_SYNONYMS)) if (t.includes(word)) return crop
  return undefined
}

export function detectDistrict(text: string): string | undefined {
  const t = text.toLowerCase()
  return UP_DISTRICT_NAMES.find((d) => t.includes(d.toLowerCase()))
}

export function detectAmount(text: string): number | undefined {
  const cleaned = text.replace(/,/g, '')
  const lakh = /(\d+(?:\.\d+)?)\s*(lakh|लाख)/i.exec(cleaned)
  if (lakh) return Math.round(Number(lakh[1]) * 100_000)
  const hazar = /(\d+(?:\.\d+)?)\s*(hazar|hazaar|thousand|हज़ार|हजार|k\b)/i.exec(cleaned)
  if (hazar) return Math.round(Number(hazar[1]) * 1000)
  const plain = /(\d{3,7})/.exec(cleaned)
  return plain ? Number(plain[1]) : undefined
}

export function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim()
  const crop = detectCrop(t)
  const district = detectDistrict(t)
  const amount = detectAmount(t)

  for (const r of RULES) {
    if (r.words.some((w) => t.includes(w))) {
      return { key: r.key, label: r.label, labelHi: r.labelHi, action: r.action, page: r.page, crop, district, amount }
    }
  }
  if (crop) {
    const r = RULES.find((x) => x.key === 'crop_price')!
    return { key: 'crop_price', label: r.label, labelHi: r.labelHi, action: r.action, page: 'prices', crop, district, amount }
  }
  return {
    key: 'help',
    label: 'Help',
    labelHi: 'सहायता',
    action: 'Show what you can ask',
    page: 'voice',
    crop,
    district,
    amount,
  }
}

export const EXAMPLE_COMMANDS = [
  'गेहूं का आज का भाव बताओ',
  'Lucknow mandi mein wheat ka price kya hai?',
  'मेरी फसल बेचने के लिए सबसे अच्छा मंडी कौन सा है?',
  'मेरी transaction history दिखाओ',
  'मेरे pending orders दिखाओ',
  'आज की mandi prices दिखाओ',
  'मेरे loan application ka status batao',
  'मेरी फसल की quality check karo',
  '50000 रुपये की financial help chahiye',
]
