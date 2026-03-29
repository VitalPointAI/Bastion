/**
 * OSINT → Knowledge Graph Sync
 *
 * After OSINT events are stored, this module creates Actor nodes and
 * Relationship edges in the Neo4j knowledge graph so OSINT intelligence
 * is visible in the brain visualization.
 *
 * Also extracts geo-location data from event content for COP symbol placement.
 */

import type { OSINTEvent } from '../graph/osint/types.js';
import { SOURCE_WEIGHTS } from '../graph/confidence-calculator.js';
import { normalizeActorName } from '../graph/resolution/name-normalizer.js';
import { entityResolutionService } from '../graph/resolution/resolution-service.js';

const OSINT_SOURCE_WEIGHT = SOURCE_WEIGHTS['osint']; // 0.65

// ── Geo-location extraction ────────────────────────────────────────────────

/**
 * Known locations with lat/lng for common geopolitical references.
 * Used as a fast lookup when LLM geo-coding isn't available.
 */
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; region?: string; country?: string }> = {
  // ── Indo-Pacific ──
  'taiwan': { lat: 23.70, lng: 120.96, region: 'Indo-Pacific', country: 'Taiwan' },
  'taipei': { lat: 25.03, lng: 121.57, region: 'Indo-Pacific', country: 'Taiwan' },
  'china': { lat: 35.86, lng: 104.20, region: 'Indo-Pacific', country: 'China' },
  'beijing': { lat: 39.90, lng: 116.41, region: 'Indo-Pacific', country: 'China' },
  'shanghai': { lat: 31.23, lng: 121.47, region: 'Indo-Pacific', country: 'China' },
  'hong kong': { lat: 22.32, lng: 114.17, region: 'Indo-Pacific', country: 'China' },
  'guangzhou': { lat: 23.13, lng: 113.26, region: 'Indo-Pacific', country: 'China' },
  'shenzhen': { lat: 22.54, lng: 114.06, region: 'Indo-Pacific', country: 'China' },
  'chongqing': { lat: 29.43, lng: 106.91, region: 'Indo-Pacific', country: 'China' },
  'neijiang': { lat: 29.59, lng: 105.06, region: 'Indo-Pacific', country: 'China' },
  'wuhan': { lat: 30.59, lng: 114.31, region: 'Indo-Pacific', country: 'China' },
  'south china sea': { lat: 12.0, lng: 114.0, region: 'Indo-Pacific' },
  'taiwan strait': { lat: 24.0, lng: 119.5, region: 'Indo-Pacific' },
  'east china sea': { lat: 30.0, lng: 126.0, region: 'Indo-Pacific' },
  'japan': { lat: 36.20, lng: 138.25, region: 'Indo-Pacific', country: 'Japan' },
  'tokyo': { lat: 35.68, lng: 139.65, region: 'Indo-Pacific', country: 'Japan' },
  'osaka': { lat: 34.69, lng: 135.50, region: 'Indo-Pacific', country: 'Japan' },
  'okinawa': { lat: 26.50, lng: 127.95, region: 'Indo-Pacific', country: 'Japan' },
  'south korea': { lat: 35.91, lng: 127.77, region: 'Indo-Pacific', country: 'South Korea' },
  'seoul': { lat: 37.57, lng: 126.98, region: 'Indo-Pacific', country: 'South Korea' },
  'north korea': { lat: 40.34, lng: 127.51, region: 'Indo-Pacific', country: 'North Korea' },
  'pyongyang': { lat: 39.04, lng: 125.76, region: 'Indo-Pacific', country: 'North Korea' },
  'philippines': { lat: 12.88, lng: 121.77, region: 'Indo-Pacific', country: 'Philippines' },
  'manila': { lat: 14.60, lng: 120.98, region: 'Indo-Pacific', country: 'Philippines' },
  'guam': { lat: 13.44, lng: 144.79, region: 'Indo-Pacific', country: 'USA' },
  'hawaii': { lat: 19.90, lng: -155.58, region: 'Indo-Pacific', country: 'USA' },
  'australia': { lat: -25.27, lng: 133.78, region: 'Indo-Pacific', country: 'Australia' },
  'sydney': { lat: -33.87, lng: 151.21, region: 'Indo-Pacific', country: 'Australia' },
  'melbourne': { lat: -37.81, lng: 144.96, region: 'Indo-Pacific', country: 'Australia' },
  'canberra': { lat: -35.28, lng: 149.13, region: 'Indo-Pacific', country: 'Australia' },
  'india': { lat: 20.59, lng: 78.96, region: 'Indo-Pacific', country: 'India' },
  'new delhi': { lat: 28.61, lng: 77.21, region: 'Indo-Pacific', country: 'India' },
  'mumbai': { lat: 19.08, lng: 72.88, region: 'Indo-Pacific', country: 'India' },
  'singapore': { lat: 1.35, lng: 103.82, region: 'Indo-Pacific', country: 'Singapore' },
  'vietnam': { lat: 14.06, lng: 108.28, region: 'Indo-Pacific', country: 'Vietnam' },
  'hanoi': { lat: 21.03, lng: 105.85, region: 'Indo-Pacific', country: 'Vietnam' },
  'indonesia': { lat: -0.79, lng: 113.92, region: 'Indo-Pacific', country: 'Indonesia' },
  'jakarta': { lat: -6.21, lng: 106.85, region: 'Indo-Pacific', country: 'Indonesia' },
  'malaysia': { lat: 4.21, lng: 101.98, region: 'Indo-Pacific', country: 'Malaysia' },
  'kuala lumpur': { lat: 3.14, lng: 101.69, region: 'Indo-Pacific', country: 'Malaysia' },
  'thailand': { lat: 15.87, lng: 100.99, region: 'Indo-Pacific', country: 'Thailand' },
  'bangkok': { lat: 13.76, lng: 100.50, region: 'Indo-Pacific', country: 'Thailand' },
  'myanmar': { lat: 21.91, lng: 95.96, region: 'Indo-Pacific', country: 'Myanmar' },
  'cambodia': { lat: 12.57, lng: 104.99, region: 'Indo-Pacific', country: 'Cambodia' },
  'laos': { lat: 19.86, lng: 102.50, region: 'Indo-Pacific', country: 'Laos' },
  'new zealand': { lat: -40.90, lng: 174.89, region: 'Indo-Pacific', country: 'New Zealand' },
  'palau': { lat: 7.51, lng: 134.58, region: 'Indo-Pacific', country: 'Palau' },
  'pakistan': { lat: 30.38, lng: 69.35, region: 'Indo-Pacific', country: 'Pakistan' },
  'islamabad': { lat: 33.69, lng: 73.04, region: 'Indo-Pacific', country: 'Pakistan' },
  'bangladesh': { lat: 23.68, lng: 90.36, region: 'Indo-Pacific', country: 'Bangladesh' },
  'sri lanka': { lat: 7.87, lng: 80.77, region: 'Indo-Pacific', country: 'Sri Lanka' },
  'nepal': { lat: 28.39, lng: 84.12, region: 'Indo-Pacific', country: 'Nepal' },
  'mongolia': { lat: 46.86, lng: 103.85, region: 'Indo-Pacific', country: 'Mongolia' },
  'papua new guinea': { lat: -6.31, lng: 143.96, region: 'Indo-Pacific', country: 'Papua New Guinea' },
  'fiji': { lat: -17.71, lng: 178.07, region: 'Indo-Pacific', country: 'Fiji' },

  // ── Middle East ──
  'iran': { lat: 32.43, lng: 53.69, region: 'Middle East', country: 'Iran' },
  'tehran': { lat: 35.69, lng: 51.39, region: 'Middle East', country: 'Iran' },
  'iraq': { lat: 33.22, lng: 43.68, region: 'Middle East', country: 'Iraq' },
  'baghdad': { lat: 33.31, lng: 44.37, region: 'Middle East', country: 'Iraq' },
  'syria': { lat: 34.80, lng: 38.00, region: 'Middle East', country: 'Syria' },
  'damascus': { lat: 33.51, lng: 36.29, region: 'Middle East', country: 'Syria' },
  'israel': { lat: 31.05, lng: 34.85, region: 'Middle East', country: 'Israel' },
  'jerusalem': { lat: 31.77, lng: 35.23, region: 'Middle East', country: 'Israel' },
  'tel aviv': { lat: 32.09, lng: 34.78, region: 'Middle East', country: 'Israel' },
  'gaza': { lat: 31.35, lng: 34.31, region: 'Middle East', country: 'Palestine' },
  'palestine': { lat: 31.95, lng: 35.23, region: 'Middle East', country: 'Palestine' },
  'west bank': { lat: 31.95, lng: 35.30, region: 'Middle East', country: 'Palestine' },
  'lebanon': { lat: 33.85, lng: 35.86, region: 'Middle East', country: 'Lebanon' },
  'beirut': { lat: 33.89, lng: 35.50, region: 'Middle East', country: 'Lebanon' },
  'saudi arabia': { lat: 23.89, lng: 45.08, region: 'Middle East', country: 'Saudi Arabia' },
  'riyadh': { lat: 24.71, lng: 46.68, region: 'Middle East', country: 'Saudi Arabia' },
  'yemen': { lat: 15.55, lng: 48.52, region: 'Middle East', country: 'Yemen' },
  'jordan': { lat: 30.59, lng: 36.24, region: 'Middle East', country: 'Jordan' },
  'oman': { lat: 21.47, lng: 55.98, region: 'Middle East', country: 'Oman' },
  'qatar': { lat: 25.35, lng: 51.18, region: 'Middle East', country: 'Qatar' },
  'kuwait': { lat: 29.31, lng: 47.48, region: 'Middle East', country: 'Kuwait' },
  'bahrain': { lat: 26.07, lng: 50.56, region: 'Middle East', country: 'Bahrain' },
  'united arab emirates': { lat: 23.42, lng: 53.85, region: 'Middle East', country: 'UAE' },
  'uae': { lat: 23.42, lng: 53.85, region: 'Middle East', country: 'UAE' },
  'dubai': { lat: 25.20, lng: 55.27, region: 'Middle East', country: 'UAE' },
  'abu dhabi': { lat: 24.45, lng: 54.65, region: 'Middle East', country: 'UAE' },
  'persian gulf': { lat: 26.0, lng: 52.0, region: 'Middle East' },
  'red sea': { lat: 20.0, lng: 38.0, region: 'Middle East' },
  'strait of hormuz': { lat: 26.57, lng: 56.25, region: 'Middle East' },
  'turkey': { lat: 38.96, lng: 35.24, region: 'Middle East', country: 'Turkey' },
  'ankara': { lat: 39.93, lng: 32.85, region: 'Middle East', country: 'Turkey' },
  'istanbul': { lat: 41.01, lng: 28.98, region: 'Middle East', country: 'Turkey' },
  'afghanistan': { lat: 33.94, lng: 67.71, region: 'Middle East', country: 'Afghanistan' },
  'kabul': { lat: 34.53, lng: 69.17, region: 'Middle East', country: 'Afghanistan' },

  // ── Europe ──
  'russia': { lat: 61.52, lng: 105.32, region: 'Europe', country: 'Russia' },
  'moscow': { lat: 55.76, lng: 37.62, region: 'Europe', country: 'Russia' },
  'st petersburg': { lat: 59.93, lng: 30.32, region: 'Europe', country: 'Russia' },
  'ukraine': { lat: 48.38, lng: 31.17, region: 'Europe', country: 'Ukraine' },
  'kyiv': { lat: 50.45, lng: 30.52, region: 'Europe', country: 'Ukraine' },
  'kharkiv': { lat: 49.99, lng: 36.23, region: 'Europe', country: 'Ukraine' },
  'odesa': { lat: 46.48, lng: 30.74, region: 'Europe', country: 'Ukraine' },
  'crimea': { lat: 44.95, lng: 34.10, region: 'Europe', country: 'Ukraine' },
  'nato': { lat: 50.85, lng: 4.35, region: 'Europe' },
  'european union': { lat: 50.85, lng: 4.35, region: 'Europe' },
  'united kingdom': { lat: 55.38, lng: -3.44, region: 'Europe', country: 'UK' },
  'london': { lat: 51.51, lng: -0.13, region: 'Europe', country: 'UK' },
  'france': { lat: 46.23, lng: 2.21, region: 'Europe', country: 'France' },
  'paris': { lat: 48.86, lng: 2.35, region: 'Europe', country: 'France' },
  'germany': { lat: 51.17, lng: 10.45, region: 'Europe', country: 'Germany' },
  'berlin': { lat: 52.52, lng: 13.41, region: 'Europe', country: 'Germany' },
  'italy': { lat: 41.87, lng: 12.57, region: 'Europe', country: 'Italy' },
  'rome': { lat: 41.90, lng: 12.50, region: 'Europe', country: 'Italy' },
  'spain': { lat: 40.46, lng: -3.75, region: 'Europe', country: 'Spain' },
  'madrid': { lat: 40.42, lng: -3.70, region: 'Europe', country: 'Spain' },
  'poland': { lat: 51.92, lng: 19.15, region: 'Europe', country: 'Poland' },
  'warsaw': { lat: 52.23, lng: 21.01, region: 'Europe', country: 'Poland' },
  'netherlands': { lat: 52.13, lng: 5.29, region: 'Europe', country: 'Netherlands' },
  'belgium': { lat: 50.50, lng: 4.47, region: 'Europe', country: 'Belgium' },
  'brussels': { lat: 50.85, lng: 4.35, region: 'Europe', country: 'Belgium' },
  'sweden': { lat: 60.13, lng: 18.64, region: 'Europe', country: 'Sweden' },
  'stockholm': { lat: 59.33, lng: 18.07, region: 'Europe', country: 'Sweden' },
  'norway': { lat: 60.47, lng: 8.47, region: 'Europe', country: 'Norway' },
  'finland': { lat: 61.92, lng: 25.75, region: 'Europe', country: 'Finland' },
  'helsinki': { lat: 60.17, lng: 24.94, region: 'Europe', country: 'Finland' },
  'denmark': { lat: 56.26, lng: 9.50, region: 'Europe', country: 'Denmark' },
  'greece': { lat: 39.07, lng: 21.82, region: 'Europe', country: 'Greece' },
  'athens': { lat: 37.98, lng: 23.73, region: 'Europe', country: 'Greece' },
  'romania': { lat: 45.94, lng: 24.97, region: 'Europe', country: 'Romania' },
  'czech republic': { lat: 49.82, lng: 15.47, region: 'Europe', country: 'Czech Republic' },
  'hungary': { lat: 47.16, lng: 19.50, region: 'Europe', country: 'Hungary' },
  'austria': { lat: 47.52, lng: 14.55, region: 'Europe', country: 'Austria' },
  'vienna': { lat: 48.21, lng: 16.37, region: 'Europe', country: 'Austria' },
  'switzerland': { lat: 46.82, lng: 8.23, region: 'Europe', country: 'Switzerland' },
  'portugal': { lat: 39.40, lng: -8.22, region: 'Europe', country: 'Portugal' },
  'ireland': { lat: 53.14, lng: -7.69, region: 'Europe', country: 'Ireland' },
  'serbia': { lat: 44.02, lng: 21.01, region: 'Europe', country: 'Serbia' },
  'belarus': { lat: 53.71, lng: 27.95, region: 'Europe', country: 'Belarus' },
  'minsk': { lat: 53.90, lng: 27.57, region: 'Europe', country: 'Belarus' },
  'baltic': { lat: 57.0, lng: 22.0, region: 'Europe' },
  'estonia': { lat: 58.60, lng: 25.01, region: 'Europe', country: 'Estonia' },
  'latvia': { lat: 56.88, lng: 24.60, region: 'Europe', country: 'Latvia' },
  'lithuania': { lat: 55.17, lng: 23.88, region: 'Europe', country: 'Lithuania' },
  'georgia': { lat: 42.32, lng: 43.36, region: 'Europe', country: 'Georgia' },
  'moldova': { lat: 47.41, lng: 28.37, region: 'Europe', country: 'Moldova' },
  'black sea': { lat: 43.0, lng: 35.0, region: 'Europe' },
  'mediterranean': { lat: 35.0, lng: 18.0, region: 'Europe' },
  'arctic': { lat: 71.0, lng: 25.0, region: 'Europe' },

  // ── Africa ──
  'nigeria': { lat: 9.08, lng: 8.68, region: 'Africa', country: 'Nigeria' },
  'lagos': { lat: 6.52, lng: 3.38, region: 'Africa', country: 'Nigeria' },
  'abuja': { lat: 9.06, lng: 7.49, region: 'Africa', country: 'Nigeria' },
  'south africa': { lat: -30.56, lng: 22.94, region: 'Africa', country: 'South Africa' },
  'johannesburg': { lat: -26.20, lng: 28.05, region: 'Africa', country: 'South Africa' },
  'cape town': { lat: -33.92, lng: 18.42, region: 'Africa', country: 'South Africa' },
  'egypt': { lat: 26.82, lng: 30.80, region: 'Africa', country: 'Egypt' },
  'cairo': { lat: 30.04, lng: 31.24, region: 'Africa', country: 'Egypt' },
  'suez canal': { lat: 30.46, lng: 32.34, region: 'Africa', country: 'Egypt' },
  'sudan': { lat: 12.86, lng: 30.22, region: 'Africa', country: 'Sudan' },
  'khartoum': { lat: 15.50, lng: 32.56, region: 'Africa', country: 'Sudan' },
  'south sudan': { lat: 6.88, lng: 31.31, region: 'Africa', country: 'South Sudan' },
  'ethiopia': { lat: 9.15, lng: 40.49, region: 'Africa', country: 'Ethiopia' },
  'addis ababa': { lat: 9.02, lng: 38.75, region: 'Africa', country: 'Ethiopia' },
  'somalia': { lat: 5.15, lng: 46.20, region: 'Africa', country: 'Somalia' },
  'mogadishu': { lat: 2.05, lng: 45.32, region: 'Africa', country: 'Somalia' },
  'kenya': { lat: -0.02, lng: 37.91, region: 'Africa', country: 'Kenya' },
  'nairobi': { lat: -1.29, lng: 36.82, region: 'Africa', country: 'Kenya' },
  'libya': { lat: 26.34, lng: 17.23, region: 'Africa', country: 'Libya' },
  'tripoli': { lat: 32.89, lng: 13.18, region: 'Africa', country: 'Libya' },
  'algeria': { lat: 28.03, lng: 1.66, region: 'Africa', country: 'Algeria' },
  'morocco': { lat: 31.79, lng: -7.09, region: 'Africa', country: 'Morocco' },
  'tunisia': { lat: 33.89, lng: 9.54, region: 'Africa', country: 'Tunisia' },
  'congo': { lat: -4.04, lng: 21.76, region: 'Africa', country: 'DRC' },
  'kinshasa': { lat: -4.44, lng: 15.27, region: 'Africa', country: 'DRC' },
  'ghana': { lat: 7.95, lng: -1.02, region: 'Africa', country: 'Ghana' },
  'accra': { lat: 5.60, lng: -0.19, region: 'Africa', country: 'Ghana' },
  'cameroon': { lat: 7.37, lng: 12.35, region: 'Africa', country: 'Cameroon' },
  'mozambique': { lat: -18.67, lng: 35.53, region: 'Africa', country: 'Mozambique' },
  'mali': { lat: 17.57, lng: -4.00, region: 'Africa', country: 'Mali' },
  'niger': { lat: 17.61, lng: 8.08, region: 'Africa', country: 'Niger' },
  'burkina faso': { lat: 12.24, lng: -1.56, region: 'Africa', country: 'Burkina Faso' },
  'sahel': { lat: 15.0, lng: 2.0, region: 'Africa' },
  'gulf of guinea': { lat: 3.0, lng: 2.0, region: 'Africa' },
  'horn of africa': { lat: 8.0, lng: 46.0, region: 'Africa' },
  'tanzania': { lat: -6.37, lng: 34.89, region: 'Africa', country: 'Tanzania' },
  'uganda': { lat: 1.37, lng: 32.29, region: 'Africa', country: 'Uganda' },
  'rwanda': { lat: -1.94, lng: 29.87, region: 'Africa', country: 'Rwanda' },
  'senegal': { lat: 14.50, lng: -14.45, region: 'Africa', country: 'Senegal' },
  'ivory coast': { lat: 7.54, lng: -5.55, region: 'Africa', country: 'Ivory Coast' },
  'zimbabwe': { lat: -19.02, lng: 29.15, region: 'Africa', country: 'Zimbabwe' },
  'angola': { lat: -11.20, lng: 17.87, region: 'Africa', country: 'Angola' },

  // ── Americas ──
  'united states': { lat: 37.09, lng: -95.71, region: 'Americas', country: 'USA' },
  'washington': { lat: 38.91, lng: -77.04, region: 'Americas', country: 'USA' },
  'pentagon': { lat: 38.87, lng: -77.06, region: 'Americas', country: 'USA' },
  'new york': { lat: 40.71, lng: -74.01, region: 'Americas', country: 'USA' },
  'los angeles': { lat: 34.05, lng: -118.24, region: 'Americas', country: 'USA' },
  'chicago': { lat: 41.88, lng: -87.63, region: 'Americas', country: 'USA' },
  'san francisco': { lat: 37.77, lng: -122.42, region: 'Americas', country: 'USA' },
  'texas': { lat: 31.97, lng: -99.90, region: 'Americas', country: 'USA' },
  'florida': { lat: 27.66, lng: -81.52, region: 'Americas', country: 'USA' },
  'california': { lat: 36.78, lng: -119.42, region: 'Americas', country: 'USA' },
  'canada': { lat: 56.13, lng: -106.35, region: 'Americas', country: 'Canada' },
  'ottawa': { lat: 45.42, lng: -75.70, region: 'Americas', country: 'Canada' },
  'toronto': { lat: 43.65, lng: -79.38, region: 'Americas', country: 'Canada' },
  'mexico': { lat: 23.63, lng: -102.55, region: 'Americas', country: 'Mexico' },
  'mexico city': { lat: 19.43, lng: -99.13, region: 'Americas', country: 'Mexico' },
  'brazil': { lat: -14.24, lng: -51.93, region: 'Americas', country: 'Brazil' },
  'brasilia': { lat: -15.79, lng: -47.88, region: 'Americas', country: 'Brazil' },
  'sao paulo': { lat: -23.55, lng: -46.63, region: 'Americas', country: 'Brazil' },
  'argentina': { lat: -38.42, lng: -63.62, region: 'Americas', country: 'Argentina' },
  'buenos aires': { lat: -34.60, lng: -58.38, region: 'Americas', country: 'Argentina' },
  'colombia': { lat: 4.57, lng: -74.30, region: 'Americas', country: 'Colombia' },
  'bogota': { lat: 4.71, lng: -74.07, region: 'Americas', country: 'Colombia' },
  'venezuela': { lat: 6.42, lng: -66.59, region: 'Americas', country: 'Venezuela' },
  'peru': { lat: -9.19, lng: -75.02, region: 'Americas', country: 'Peru' },
  'lima': { lat: -12.05, lng: -77.04, region: 'Americas', country: 'Peru' },
  'chile': { lat: -35.68, lng: -71.54, region: 'Americas', country: 'Chile' },
  'cuba': { lat: 21.52, lng: -77.78, region: 'Americas', country: 'Cuba' },
  'havana': { lat: 23.11, lng: -82.37, region: 'Americas', country: 'Cuba' },
  'ecuador': { lat: -1.83, lng: -78.18, region: 'Americas', country: 'Ecuador' },
  'guatemala': { lat: 15.78, lng: -90.23, region: 'Americas', country: 'Guatemala' },
  'honduras': { lat: 15.20, lng: -86.24, region: 'Americas', country: 'Honduras' },
  'el salvador': { lat: 13.79, lng: -88.90, region: 'Americas', country: 'El Salvador' },
  'panama': { lat: 8.54, lng: -80.78, region: 'Americas', country: 'Panama' },
  'panama canal': { lat: 9.08, lng: -79.68, region: 'Americas', country: 'Panama' },
  'caribbean': { lat: 15.0, lng: -75.0, region: 'Americas' },
  'haiti': { lat: 18.97, lng: -72.29, region: 'Americas', country: 'Haiti' },

  // ── Central Asia ──
  'kazakhstan': { lat: 48.02, lng: 66.92, region: 'Central Asia', country: 'Kazakhstan' },
  'uzbekistan': { lat: 41.38, lng: 64.59, region: 'Central Asia', country: 'Uzbekistan' },
  'turkmenistan': { lat: 38.97, lng: 59.56, region: 'Central Asia', country: 'Turkmenistan' },
  'kyrgyzstan': { lat: 41.20, lng: 74.77, region: 'Central Asia', country: 'Kyrgyzstan' },
  'tajikistan': { lat: 38.86, lng: 71.28, region: 'Central Asia', country: 'Tajikistan' },

  // ── Waterways & Strategic Points ──
  'strait of malacca': { lat: 2.5, lng: 101.0, region: 'Indo-Pacific' },
  'bab el-mandeb': { lat: 12.58, lng: 43.33, region: 'Middle East' },
  'indian ocean': { lat: -10.0, lng: 75.0, region: 'Indo-Pacific' },
  'pacific ocean': { lat: 0.0, lng: -160.0, region: 'Indo-Pacific' },
  'atlantic ocean': { lat: 30.0, lng: -40.0, region: 'Americas' },
  'north sea': { lat: 56.0, lng: 3.0, region: 'Europe' },
  'baltic sea': { lat: 58.0, lng: 20.0, region: 'Europe' },

};

/**
 * Extract the first matching location from text content.
 * Returns null if no known location is found.
 */
export function extractLocation(text: string): {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
  country?: string;
} | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Try longest matches first (e.g., "south china sea" before "china")
  const sorted = Object.entries(KNOWN_LOCATIONS).sort((a, b) => b[0].length - a[0].length);

  for (const [name, coords] of sorted) {
    // Word boundary check: ensure we match whole words
    const idx = lower.indexOf(name);
    if (idx >= 0) {
      const before = idx > 0 ? lower[idx - 1] : ' ';
      const after = idx + name.length < lower.length ? lower[idx + name.length] : ' ';
      if (/\W/.test(before) && /\W/.test(after)) {
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          latitude: coords.lat,
          longitude: coords.lng,
          region: coords.region,
          country: coords.country,
        };
      }
    }
  }

  return null;
}

// ── Knowledge Graph Sync ───────────────────────────────────────────────────

/**
 * Lightweight OSINT → knowledge graph sync.
 *
 * Only creates actor nodes for explicitly mentioned actors (people, orgs,
 * countries). Does NOT create individual event nodes — those bloat the graph
 * to 8000+ nodes. The LLM entity extractor handles richer extraction.
 */
export async function syncOSINTEventToGraph(event: OSINTEvent): Promise<void> {
  try {
    // Skip events with no actors — nothing to add to the graph
    if (!event.actors || event.actors.length === 0) return;

    const { executeWriteQuery } = await import('../graph/neo4j-client.js');
    const now = new Date().toISOString();
    const validFrom = event.publishedAt?.toISOString() ?? now;

    // Only create actor nodes — not event nodes. MERGE on name to prevent duplicates.
    for (const actorName of event.actors) {
      // Strip all whitespace variants (\r\n\t) and collapse internal runs
      const trimmed = (actorName ?? '').replace(/[\r\n\t]+/g, ' ').trim().replace(/\s{2,}/g, ' ');
      if (!trimmed || trimmed.length < 2) continue;

      // Phase 62: Normalize actor name to canonical form before MERGE
      // e.g. "PRC" → "China", "DPRK" → "North Korea"
      const canonical = normalizeActorName(trimmed);

      const actorId = `ACT-osint-${canonical.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;

      await executeWriteQuery(`
        MERGE (a:Actor {name: $name})
        ON CREATE SET
          a.id = $id,
          a.type = 'organization',
          a.aliases = [],
          a.attributes = $attributes,
          a.workspaceId = $workspaceId,
          a.sourceDocumentIds = [$docId],
          a.containerIds = CASE WHEN $workspaceId IS NOT NULL THEN [$workspaceId] ELSE [] END,
          a.createdAt = $now,
          a.updatedAt = $now,
          a.assertedVia = 'osint',
          a.confidence = $confidence,
          a.validFrom = $validFrom,
          a.validTo = null,
          a.halfLifeDays = 90
        ON MATCH SET
          a.updatedAt = $now,
          a.validFrom = $now,
          a.validTo = null,
          a.sourceDocumentIds = CASE
            WHEN NOT $docId IN a.sourceDocumentIds
            THEN a.sourceDocumentIds + $docId
            ELSE a.sourceDocumentIds
          END,
          a.containerIds = CASE
            WHEN $workspaceId IS NOT NULL AND NOT $workspaceId IN a.containerIds
            THEN a.containerIds + $workspaceId
            ELSE a.containerIds
          END
      `, {
        id: actorId,
        name: canonical,
        attributes: JSON.stringify({ source: 'osint', firstSeen: now }),
        workspaceId: event.workspaceId ?? null,
        docId: event.id,
        now,
        confidence: OSINT_SOURCE_WEIGHT,
        validFrom,
      });
    }
  } catch (err) {
    // Non-fatal: log but don't block feed polling
    console.warn(`[OSINT→Graph] Failed to sync event "${event.title}" to graph:`, err);
  }
}

/**
 * Phase 62: Run entity resolution after an OSINT sync batch completes.
 *
 * Finds duplicate actor nodes created during ingestion and auto-merges
 * high-confidence matches. Errors are caught and logged — resolution
 * failures must never block OSINT ingestion.
 *
 * @param workspaceId - Optional workspace scope for duplicate scan
 */
export async function runPostSyncResolution(workspaceId?: string): Promise<void> {
  try {
    const result = await entityResolutionService.findDuplicates(workspaceId);
    await entityResolutionService.autoMergeDuplicates(result);
  } catch (err) {
    console.error('[OSINT] Post-sync resolution failed:', err);
  }
}
