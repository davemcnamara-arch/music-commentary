/**
 * Web Metadata Fetcher
 *
 * Fetches verified music data from multiple web sources:
 * - MusicBrainz: Open music encyclopedia (free, no key)
 * - TheAudioDB: Music metadata database (free tier)
 * - Ultimate Guitar: Real chord progressions from tabs (respectful scraping)
 *
 * Provides ground truth for:
 * - Genre, key, tempo (when available)
 * - Song structure hints
 * - Real chord progressions (not template-matched)
 * - Confidence scoring
 */

import { fetchUltimateGuitarChords, type UltimateGuitarTab } from './ultimate-guitar-fetcher.ts'

export interface WebMusicMetadata {
  // Source information
  sources: string[]
  confidence: 'high' | 'medium' | 'low' | 'none'

  // Basic metadata
  artist?: string
  title?: string
  duration?: number
  releaseYear?: number

  // Musical attributes
  genre?: string
  genreTags?: string[]  // Multiple genres/styles
  key?: string
  tempo?: number
  mood?: string
  style?: string

  // Structure hints (not exact timestamps)
  hasChorus?: boolean
  hasBridge?: boolean
  hasIntro?: boolean
  instrumentalSections?: boolean

  // Ultimate Guitar chord data
  ultimateGuitarTab?: UltimateGuitarTab

  // Raw data for debugging
  rawData?: {
    musicbrainz?: any
    theaudiodb?: any
    ultimateguitar?: any
  }
}

interface MusicBrainzRecording {
  id: string
  title: string
  length?: number  // Duration in milliseconds
  'artist-credit'?: Array<{
    name: string
    artist: {
      name: string
      id: string
    }
  }>
  tags?: Array<{
    name: string
    count: number
  }>
  releases?: Array<{
    'release-group'?: {
      'first-release-date'?: string
    }
  }>
}

interface MusicBrainzResponse {
  recordings?: MusicBrainzRecording[]
  count?: number
}

interface TheAudioDBTrack {
  strTrack?: string
  strArtist?: string
  strGenre?: string
  strStyle?: string
  strMood?: string
  intDuration?: string  // Duration in milliseconds
  strDescriptionEN?: string
  intTrackNumber?: string
  intMusicVidViews?: string
  intTotalListeners?: string
  intTotalPlays?: string
}

interface TheAudioDBResponse {
  track?: TheAudioDBTrack[] | null
}

/**
 * Normalizes artist/title strings for better matching
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim()
}

/**
 * Calculate string similarity (simple Levenshtein-based)
 */
function similarityScore(a: string, b: string): number {
  const normalized_a = normalizeString(a)
  const normalized_b = normalizeString(b)

  // Exact match
  if (normalized_a === normalized_b) return 1.0

  // Contains match
  if (normalized_a.includes(normalized_b) || normalized_b.includes(normalized_a)) {
    return 0.8
  }

  // Simple word overlap
  const words_a = new Set(normalized_a.split(' '))
  const words_b = new Set(normalized_b.split(' '))
  const intersection = new Set([...words_a].filter(x => words_b.has(x)))
  const union = new Set([...words_a, ...words_b])

  return intersection.size / union.size
}

/**
 * Fetches metadata from MusicBrainz
 */
async function fetchMusicBrainzData(
  artist: string,
  title: string
): Promise<MusicBrainzRecording | null> {
  try {
    // Clean artist and title for search
    const cleanArtist = artist.replace(/\s*-\s*Topic$/, '').trim()
    const cleanTitle = title
      .replace(/\(.*?\)/g, '')  // Remove parentheticals
      .replace(/\[.*?\]/g, '')  // Remove brackets
      .trim()

    // Build search query
    const query = `artist:"${cleanArtist}" AND recording:"${cleanTitle}"`
    const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`

    console.log(`MusicBrainz: Searching for "${cleanArtist}" - "${cleanTitle}"`)

    // MusicBrainz requires User-Agent header
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MusicCommentaryExtension/1.0.0 (https://github.com/yourusername/music-commentary)',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`MusicBrainz error: ${response.status} ${response.statusText}`)
      return null
    }

    // Respect rate limiting (MusicBrainz: 1 req/sec)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const data: MusicBrainzResponse = await response.json()

    if (!data.recordings || data.recordings.length === 0) {
      console.log('MusicBrainz: No recordings found')
      return null
    }

    // Find best match by title similarity
    let bestMatch: MusicBrainzRecording | null = null
    let bestScore = 0

    for (const recording of data.recordings) {
      const titleScore = similarityScore(recording.title, cleanTitle)

      // Also check artist match if available
      let artistScore = 0
      if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
        const recordingArtist = recording['artist-credit'][0].name
        artistScore = similarityScore(recordingArtist, cleanArtist)
      }

      const combinedScore = (titleScore * 0.7) + (artistScore * 0.3)

      if (combinedScore > bestScore && combinedScore > 0.6) {  // Minimum 60% match
        bestScore = combinedScore
        bestMatch = recording
      }
    }

    if (bestMatch) {
      console.log(`MusicBrainz: Found match (score: ${bestScore.toFixed(2)})`)
      return bestMatch
    }

    console.log('MusicBrainz: No good matches found')
    return null

  } catch (error) {
    console.error('MusicBrainz fetch error:', error)
    return null
  }
}

/**
 * Fetches metadata from TheAudioDB
 */
async function fetchTheAudioDBData(
  artist: string,
  title: string
): Promise<TheAudioDBTrack | null> {
  try {
    // Clean inputs
    const cleanArtist = artist.replace(/\s*-\s*Topic$/, '').trim()
    const cleanTitle = title
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .trim()

    // TheAudioDB free API key
    const apiKey = '2'  // Free tier test key

    // Build search URL (search by artist and track)
    const url = `https://www.theaudiodb.com/api/v1/json/${apiKey}/searchtrack.php?s=${encodeURIComponent(cleanArtist)}&t=${encodeURIComponent(cleanTitle)}`

    console.log(`TheAudioDB: Searching for "${cleanArtist}" - "${cleanTitle}"`)

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`TheAudioDB error: ${response.status} ${response.statusText}`)
      return null
    }

    const data: TheAudioDBResponse = await response.json()

    if (!data.track || data.track.length === 0) {
      console.log('TheAudioDB: No tracks found')
      return null
    }

    // Usually returns exact match as first result
    const track = data.track[0]
    console.log(`TheAudioDB: Found "${track.strTrack}" by ${track.strArtist}`)

    return track

  } catch (error) {
    console.error('TheAudioDB fetch error:', error)
    return null
  }
}

/**
 * Extracts genre information from MusicBrainz tags
 */
function extractGenreFromTags(tags?: Array<{ name: string, count: number }>): {
  primaryGenre?: string
  genreTags: string[]
} {
  if (!tags || tags.length === 0) {
    return { genreTags: [] }
  }

  // Sort by count (popularity)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count)

  // Common genre keywords
  const genreKeywords = [
    'rock', 'pop', 'jazz', 'classical', 'electronic', 'hip hop', 'metal',
    'punk', 'folk', 'blues', 'country', 'reggae', 'soul', 'funk', 'disco',
    'techno', 'house', 'trance', 'indie', 'alternative', 'experimental'
  ]

  // Find primary genre
  let primaryGenre: string | undefined
  const genreTags: string[] = []

  for (const tag of sortedTags) {
    const tagLower = tag.name.toLowerCase()

    // Check if tag is genre-related
    const isGenre = genreKeywords.some(keyword => tagLower.includes(keyword))

    if (isGenre) {
      if (!primaryGenre) {
        primaryGenre = tag.name
      }
      genreTags.push(tag.name)
    }
  }

  return {
    primaryGenre,
    genreTags: genreTags.slice(0, 5)  // Top 5 genre tags
  }
}

/**
 * Determines confidence level based on data sources
 */
function calculateConfidence(
  mbData: MusicBrainzRecording | null,
  tadbData: TheAudioDBTrack | null,
  ugData: UltimateGuitarTab | null
): 'high' | 'medium' | 'low' | 'none' {
  const sourceCount = [mbData, tadbData, ugData].filter(Boolean).length

  // High confidence: 3 sources OR 2+ sources with chord data
  if (sourceCount >= 3) return 'high'
  if (sourceCount >= 2 && ugData) return 'high'
  if (sourceCount >= 2) return 'high'

  // Medium confidence: 1 source
  if (sourceCount === 1) return 'medium'

  return 'none'
}

/**
 * Main function: Fetches and combines metadata from multiple sources
 */
export async function fetchWebMetadata(
  artist: string,
  title: string
): Promise<WebMusicMetadata> {
  console.log(`\n=== Fetching Web Metadata ===`)
  console.log(`Artist: ${artist}`)
  console.log(`Title: ${title}`)

  // Fetch from multiple sources in parallel
  const [mbData, tadbData, ugData] = await Promise.all([
    fetchMusicBrainzData(artist, title),
    fetchTheAudioDBData(artist, title),
    fetchUltimateGuitarChords(artist, title).catch(err => {
      console.error('Ultimate Guitar fetch failed (non-fatal):', err)
      return null
    })
  ])

  // Determine confidence
  const confidence = calculateConfidence(mbData, tadbData, ugData)
  const sources: string[] = []

  if (mbData) sources.push('MusicBrainz')
  if (tadbData) sources.push('TheAudioDB')
  if (ugData) sources.push('Ultimate Guitar')

  console.log(`Confidence: ${confidence} (sources: ${sources.join(', ') || 'none'})`)

  // No data found
  if (confidence === 'none') {
    return {
      sources: [],
      confidence: 'none'
    }
  }

  // Combine data from both sources
  const metadata: WebMusicMetadata = {
    sources,
    confidence
  }

  // Artist and title (prefer TheAudioDB for exact match)
  metadata.artist = tadbData?.strArtist || mbData?.['artist-credit']?.[0]?.name
  metadata.title = tadbData?.strTrack || mbData?.title

  // Duration (MusicBrainz has it in milliseconds, TheAudioDB too)
  if (tadbData?.intDuration) {
    metadata.duration = parseInt(tadbData.intDuration) / 1000  // Convert to seconds
  } else if (mbData?.length) {
    metadata.duration = mbData.length / 1000  // Convert to seconds
  }

  // Release year
  if (mbData?.releases?.[0]?.['release-group']?.['first-release-date']) {
    const dateStr = mbData.releases[0]['release-group']['first-release-date']
    metadata.releaseYear = parseInt(dateStr.substring(0, 4))
  }

  // Genre (prefer TheAudioDB, fall back to MusicBrainz tags)
  if (tadbData?.strGenre) {
    metadata.genre = tadbData.strGenre
  } else if (mbData?.tags) {
    const { primaryGenre, genreTags } = extractGenreFromTags(mbData.tags)
    metadata.genre = primaryGenre
    metadata.genreTags = genreTags
  }

  // Additional TheAudioDB data
  if (tadbData) {
    if (tadbData.strStyle) metadata.style = tadbData.strStyle
    if (tadbData.strMood) metadata.mood = tadbData.strMood
  }

  // Ultimate Guitar chord data
  if (ugData) {
    metadata.ultimateGuitarTab = ugData
    console.log(`Ultimate Guitar: Found ${ugData.chords.length} chords across ${ugData.sections.length} sections`)
    console.log(`Tab quality: ${ugData.rating}/5 (${ugData.votes} votes)`)
  }

  // Store raw data for debugging
  metadata.rawData = {
    musicbrainz: mbData || undefined,
    theaudiodb: tadbData || undefined,
    ultimateguitar: ugData || undefined
  }

  console.log(`=== Web Metadata Retrieved ===`)
  console.log(`Genre: ${metadata.genre || 'unknown'}`)
  console.log(`Duration: ${metadata.duration?.toFixed(1) || 'unknown'}s`)
  console.log(`Chords: ${ugData ? `${ugData.chords.length} from Ultimate Guitar` : 'none'}`)
  console.log(`==============================\n`)

  return metadata
}

/**
 * Compares web metadata with audio analysis results
 * Returns discrepancies for validation
 */
export function compareWithAudioAnalysis(
  webData: WebMusicMetadata,
  audioAnalysis: {
    duration: number
    tempo: number
    key: string
  }
): {
  durationMatch: boolean
  durationDiff?: number
  tempoMatch?: boolean
  tempoDiff?: number
  keyMatch?: boolean
  suggestions: string[]
} {
  const suggestions: string[] = []

  // Duration comparison (allow 5% tolerance)
  let durationMatch = true
  let durationDiff: number | undefined

  if (webData.duration) {
    durationDiff = Math.abs(webData.duration - audioAnalysis.duration)
    const tolerance = webData.duration * 0.05  // 5%

    if (durationDiff > tolerance) {
      durationMatch = false
      suggestions.push(
        `Duration mismatch: Web data shows ${webData.duration.toFixed(1)}s, ` +
        `but audio analysis detected ${audioAnalysis.duration.toFixed(1)}s. ` +
        `This may indicate an incorrect video.`
      )
    }
  }

  // Tempo comparison (web sources rarely have this, but check if available)
  let tempoMatch: boolean | undefined
  let tempoDiff: number | undefined

  if (webData.tempo) {
    tempoDiff = Math.abs(webData.tempo - audioAnalysis.tempo)
    tempoMatch = tempoDiff < 5  // Within 5 BPM

    if (!tempoMatch) {
      suggestions.push(
        `Tempo differs: Web data suggests ${webData.tempo} BPM, ` +
        `audio analysis detected ${audioAnalysis.tempo.toFixed(1)} BPM.`
      )
    }
  }

  // Key comparison (would need key normalization)
  // For now, just flag if both exist and differ
  let keyMatch: boolean | undefined

  if (webData.key && audioAnalysis.key) {
    const normalizedWebKey = webData.key.toLowerCase().replace(/\s+/g, '')
    const normalizedAudioKey = audioAnalysis.key.toLowerCase().replace(/\s+/g, '')
    keyMatch = normalizedWebKey === normalizedAudioKey

    if (!keyMatch) {
      suggestions.push(
        `Key differs: Web data suggests ${webData.key}, ` +
        `audio analysis detected ${audioAnalysis.key}. ` +
        `Audio analysis may be more accurate for this specific recording.`
      )
    }
  }

  return {
    durationMatch,
    durationDiff,
    tempoMatch,
    tempoDiff,
    keyMatch,
    suggestions
  }
}
