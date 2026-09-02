// All 75 districts of Uttar Pradesh with approximate headquarters coordinates (lat, lon).
export const UP_DISTRICTS: Record<string, [number, number]> = {
  Agra: [27.18, 78.02],
  Aligarh: [27.88, 78.08],
  Ambedkar_Nagar: [26.42, 82.55],
  Amethi: [26.16, 81.81],
  Amroha: [28.9, 78.47],
  Auraiya: [26.47, 79.51],
  Ayodhya: [26.78, 82.2],
  Azamgarh: [26.07, 83.18],
  Baghpat: [28.95, 77.22],
  Bahraich: [27.57, 81.6],
  Ballia: [25.76, 84.15],
  Balrampur: [27.43, 82.18],
  Banda: [25.48, 80.34],
  Barabanki: [26.93, 81.19],
  Bareilly: [28.37, 79.43],
  Basti: [26.8, 82.73],
  Bhadohi: [25.4, 82.57],
  Bijnor: [29.37, 78.14],
  Budaun: [28.04, 79.12],
  Bulandshahr: [28.41, 77.85],
  Chandauli: [25.26, 83.27],
  Chitrakoot: [25.2, 80.9],
  Deoria: [26.5, 83.78],
  Etah: [27.56, 78.66],
  Etawah: [26.78, 79.02],
  Farrukhabad: [27.39, 79.58],
  Fatehpur: [25.93, 80.81],
  Firozabad: [27.15, 78.4],
  Gautam_Buddha_Nagar: [28.47, 77.5],
  Ghaziabad: [28.67, 77.45],
  Ghazipur: [25.58, 83.58],
  Gonda: [27.13, 81.96],
  Gorakhpur: [26.76, 83.37],
  Hamirpur: [25.96, 80.15],
  Hapur: [28.73, 77.78],
  Hardoi: [27.4, 80.13],
  Hathras: [27.6, 78.05],
  Jalaun: [26.15, 79.33],
  Jaunpur: [25.75, 82.68],
  Jhansi: [25.45, 78.57],
  Kannauj: [27.05, 79.92],
  Kanpur_Dehat: [26.4, 79.97],
  Kanpur_Nagar: [26.45, 80.33],
  Kasganj: [27.81, 78.65],
  Kaushambi: [25.53, 81.38],
  Lakhimpur_Kheri: [27.95, 80.78],
  Kushinagar: [26.74, 83.89],
  Lalitpur: [24.69, 78.41],
  Lucknow: [26.85, 80.95],
  Maharajganj: [27.14, 83.56],
  Mahoba: [25.29, 79.87],
  Mainpuri: [27.23, 79.03],
  Mathura: [27.49, 77.67],
  Mau: [25.94, 83.56],
  Meerut: [28.98, 77.71],
  Mirzapur: [25.15, 82.57],
  Moradabad: [28.84, 78.77],
  Muzaffarnagar: [29.47, 77.7],
  Pilibhit: [28.63, 79.8],
  Pratapgarh: [25.9, 81.94],
  Prayagraj: [25.44, 81.85],
  Rae_Bareli: [26.23, 81.24],
  Rampur: [28.81, 79.03],
  Saharanpur: [29.97, 77.55],
  Sambhal: [28.59, 78.57],
  Sant_Kabir_Nagar: [26.77, 83.07],
  Shahjahanpur: [27.88, 79.91],
  Shamli: [29.45, 77.31],
  Shrawasti: [27.51, 82.03],
  Siddharthnagar: [27.28, 83.08],
  Sitapur: [27.57, 80.68],
  Sonbhadra: [24.69, 83.07],
  Sultanpur: [26.26, 82.07],
  Unnao: [26.55, 80.49],
  Varanasi: [25.32, 83.0],
}

export const UP_DISTRICT_NAMES = Object.keys(UP_DISTRICTS)
  .map((k) => k.replace(/_/g, ' '))
  .sort()

export function districtCoords(name: string): [number, number] {
  return UP_DISTRICTS[name.replace(/ /g, '_')] ?? UP_DISTRICTS.Lucknow
}

const ROAD_FACTOR = 1.25

export function roadDistanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const la1 = (a[0] * Math.PI) / 180
  const la2 = (b[0] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  const d = 2 * R * Math.asin(Math.sqrt(h))
  return Math.max(8, Math.round(d * ROAD_FACTOR))
}
