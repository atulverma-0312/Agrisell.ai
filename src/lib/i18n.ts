/** Tiny 3-language dictionary for the farmer portal (English / हिंदी / Hinglish). */
import type { Lang } from './store'

export const LANGS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'हिंदी' },
  { key: 'hinglish', label: 'Hinglish' },
]

type Entry = Record<Lang, string>

export const DICT = {
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड', hinglish: 'Dashboard' },
  myCrops: { en: 'My Crops', hi: 'मेरी फसलें', hinglish: 'Meri Faslein' },
  marketPrices: { en: 'Market Prices', hi: 'मंडी भाव', hinglish: 'Mandi Bhav' },
  smartSelling: { en: 'Smart Selling', hi: 'स्मार्ट बिक्री', hinglish: 'Smart Selling' },
  sellProduce: { en: 'Sell Produce', hi: 'फसल बेचें', hinglish: 'Fasal Bechein' },
  orders: { en: 'Orders', hi: 'ऑर्डर', hinglish: 'Orders' },
  transactions: { en: 'Transactions', hi: 'लेन-देन इतिहास', hinglish: 'Len-den History' },
  finance: { en: 'Financial Support', hi: 'वित्तीय सहायता', hinglish: 'Financial Support' },
  voice: { en: 'Voice Assistant', hi: 'वॉइस सहायक', hinglish: 'Voice Assistant' },
  notifications: { en: 'Notifications', hi: 'सूचनाएं', hinglish: 'Notifications' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल', hinglish: 'Profile' },
  admin: { en: 'Admin Analytics', hi: 'एडमिन विश्लेषण', hinglish: 'Admin Analytics' },

  sellToday: { en: 'Sell today', hi: 'आज बेचें', hinglish: 'Aaj bechein' },
  waitABit: { en: 'Wait a few days', hi: 'थोड़ा इंतज़ार करें', hinglish: 'Thoda intezaar karein' },
  betterMandi: { en: 'A better mandi is available', hi: 'बेहतर मंडी उपलब्ध है', hinglish: 'Behtar mandi available hai' },
  estEarning: { en: 'Estimated earning', hi: 'अनुमानित कमाई', hinglish: 'Anumanit kamai' },
  bestPriceToday: { en: "Today's best crop price", hi: 'आज का सबसे अच्छा भाव', hinglish: 'Aaj ka best bhav' },
  recommendedMandi: { en: 'Recommended mandi', hi: 'सुझाई गई मंडी', hinglish: 'Suggested mandi' },
  smartRecommendation: { en: 'Smart selling recommendation', hi: 'स्मार्ट बिक्री सलाह', hinglish: 'Smart selling salah' },
  estRevenue: { en: 'Estimated crop revenue', hi: 'अनुमानित फसल आय', hinglish: 'Anumanit fasal aay' },
  pendingOrders: { en: 'Pending orders', hi: 'लंबित ऑर्डर', hinglish: 'Pending orders' },
  cropQuality: { en: 'Crop quality', hi: 'फसल गुणवत्ता', hinglish: 'Fasal quality' },
  viewDetails: { en: 'View details', hi: 'विवरण देखें', hinglish: 'Details dekhein' },
  open: { en: 'Open', hi: 'खोलें', hinglish: 'Kholein' },
  crop: { en: 'Crop', hi: 'फसल', hinglish: 'Fasal' },
  variety: { en: 'Variety', hi: 'किस्म', hinglish: 'Variety' },
  quantity: { en: 'Quantity', hi: 'मात्रा', hinglish: 'Quantity' },
  grade: { en: 'Quality / Grade', hi: 'गुणवत्ता / ग्रेड', hinglish: 'Quality / Grade' },
  location: { en: 'Current location', hi: 'वर्तमान स्थान', hinglish: 'Current location' },
  harvestDate: { en: 'Harvest date', hi: 'कटाई की तारीख', hinglish: 'Katai ki date' },
  sellingDate: { en: 'Expected selling date', hi: 'अनुमानित बिक्री तारीख', hinglish: 'Bechne ki expected date' },
  minPrice: { en: 'Minimum acceptable price (₹/quintal)', hi: 'न्यूनतम स्वीकार्य भाव (₹/क्विंटल)', hinglish: 'Minimum acceptable bhav (₹/quintal)' },
  storage: { en: 'Storage available', hi: 'भंडारण उपलब्ध', hinglish: 'Storage available' },
  transport: { en: 'Transport available', hi: 'परिवहन उपलब्ध', hinglish: 'Transport available' },
  analyze: { en: 'Analyze & recommend', hi: 'विश्लेषण करें और सलाह पाएं', hinglish: 'Analyse karke salah paayein' },
  bestOption: { en: 'BEST OPTION TO SELL', hi: 'बेचने का सबसे अच्छा विकल्प', hinglish: 'BECHNE KA BEST OPTION' },
  why: { en: 'Why this recommendation?', hi: 'यह सलाह क्यों?', hinglish: 'Yeh salah kyun?' },
  yes: { en: 'Yes', hi: 'हाँ', hinglish: 'Haan' },
  no: { en: 'No', hi: 'नहीं', hinglish: 'Nahi' },
  estimate: { en: 'Estimate — not a guaranteed price', hi: 'अनुमान — गारंटीड भाव नहीं', hinglish: 'Anumaan — guaranteed bhav nahi' },
} satisfies Record<string, Entry>

export type TKey = keyof typeof DICT

export function makeT(lang: Lang) {
  return (key: TKey) => DICT[key][lang]
}
