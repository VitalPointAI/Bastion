/**
 * Universal Geocoding Service
 *
 * Extracts and resolves geographic locations from any text content.
 * Used across ALL data ingestion paths — OSINT, documents, planning,
 * design, assessment, brain graph, COP layers.
 *
 * Two-tier approach:
 *   1. LLM extraction — identifies location names + approximate coordinates
 *   2. Nominatim fallback — geocodes any names the LLM couldn't place
 *
 * Usage:
 *   import { geocodingService } from '../lib/geocoding-service.js';
 *
 *   // Extract all locations from text
 *   const locations = await geocodingService.extractLocations(text);
 *
 *   // Get the primary (first/most relevant) location
 *   const primary = await geocodingService.extractPrimaryLocation(text);
 *
 *   // Geocode a single known place name
 *   const coords = await geocodingService.geocode('Riga');
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
  country?: string;
}

// ── Nominatim Geocoding ────────────────────────────────────────────────────

/** In-memory cache to avoid repeated Nominatim lookups */
const nominatimCache = new Map<string, GeoLocation | null>();
let lastNominatimCall = 0;

/**
 * Geocode a place name using OpenStreetMap Nominatim (free, no API key).
 * Respects 1 request/second rate limit. Results are cached.
 */
async function geocodeViaNominatim(name: string): Promise<GeoLocation | null> {
  const cacheKey = name.toLowerCase().trim();
  if (nominatimCache.has(cacheKey)) return nominatimCache.get(cacheKey) ?? null;

  // Rate limit: max 1 request per second
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatimCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Bastion-C2/1.0 (https://bastion.vitalpoint.ai)' },
    });
    if (!res.ok) {
      nominatimCache.set(cacheKey, null);
      return null;
    }
    const data = await res.json() as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        country?: string;
        state?: string;
        region?: string;
      };
    }>;
    if (data.length === 0) {
      nominatimCache.set(cacheKey, null);
      return null;
    }
    const result: GeoLocation = {
      name,
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      country: data[0].address?.country,
      region: data[0].address?.state ?? data[0].address?.region,
    };
    nominatimCache.set(cacheKey, result);
    return result;
  } catch {
    nominatimCache.set(cacheKey, null);
    return null;
  }
}

// ── LLM Location Extraction ───────────────────────────────────────────────

const LOCATION_EXTRACTION_PROMPT = `Extract ALL geographic locations mentioned in the following text.
For each location, provide:
- name: the place name as mentioned
- latitude: approximate latitude (decimal degrees)
- longitude: approximate longitude (decimal degrees)
- region: broader geographic region (optional)
- country: country name (optional)

Use your knowledge to provide accurate coordinates. Return ONLY a JSON array.
If no locations are found, return an empty array [].

Example: [{"name": "Riga", "latitude": 56.946, "longitude": 24.105, "country": "Latvia"}]`;

/**
 * Extract locations from text using LLM.
 * Falls back to Nominatim for any locations without coordinates.
 */
async function extractLocationsViaLLM(text: string): Promise<GeoLocation[]> {
  if (!text || text.length < 20) return [];

  try {
    const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');
    const llm = await createLLMForAgent({
      agentId: 'geocoding-service',
      overrides: { temperature: 0, maxTokens: 1024 },
    });

    const result = await Promise.race([
      llm.invoke([
        { role: 'system', content: LOCATION_EXTRACTION_PROMPT },
        { role: 'user', content: text.slice(0, 4000) }, // Limit to 4k chars
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Location extraction timed out')), 20_000),
      ),
    ]);

    const content = typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);

    // Parse JSON with resilience
    const parsed = parseJson(content);
    if (!Array.isArray(parsed)) return [];

    const locations: GeoLocation[] = [];
    for (const item of parsed) {
      const obj = item as Record<string, unknown>;
      const name = (obj.name as string)?.trim();
      if (!name) continue;

      const lat = Number(obj.latitude) || 0;
      const lng = Number(obj.longitude) || 0;

      if (lat !== 0 && lng !== 0) {
        locations.push({
          name,
          latitude: lat,
          longitude: lng,
          region: obj.region as string | undefined,
          country: obj.country as string | undefined,
        });
      } else {
        // LLM couldn't provide coordinates — try Nominatim
        const geocoded = await geocodeViaNominatim(name);
        if (geocoded) locations.push(geocoded);
      }
    }

    return locations;
  } catch (err) {
    console.warn('[GeocodingService] LLM extraction failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export const geocodingService = {
  /**
   * Extract all locations from text (LLM + Nominatim fallback).
   * Returns array of GeoLocation objects with coordinates.
   */
  async extractLocations(text: string): Promise<GeoLocation[]> {
    return extractLocationsViaLLM(text);
  },

  /**
   * Extract the primary (first/most relevant) location from text.
   * Returns null if no location found.
   */
  async extractPrimaryLocation(text: string): Promise<GeoLocation | null> {
    const locations = await extractLocationsViaLLM(text);
    return locations.length > 0 ? locations[0] : null;
  },

  /**
   * Geocode a single place name. Uses Nominatim.
   * For bulk extraction from text, use extractLocations() instead.
   */
  async geocode(placeName: string): Promise<GeoLocation | null> {
    return geocodeViaNominatim(placeName);
  },

  /**
   * Attach location to any data object that has text content.
   * Checks if object already has a location; if not, extracts one.
   * Returns the location or null.
   */
  async enrichWithLocation(
    textContent: string,
    existingLocation?: GeoLocation | null,
  ): Promise<GeoLocation | null> {
    if (existingLocation && existingLocation.latitude !== 0) return existingLocation;
    return this.extractPrimaryLocation(textContent);
  },
};

// ── JSON Parsing Helper ────────────────────────────────────────────────────

function parseJson(content: string): unknown {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const codeBlock = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) { try { return JSON.parse(codeBlock[1].trim()); } catch { /* continue */ } }
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ } }
  return null;
}
