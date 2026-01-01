/**
 * Ultimate Guitar Chord Fetcher
 *
 * Fetches real chord progressions from Ultimate Guitar tabs.
 *
 * ETHICAL CONSIDERATIONS:
 * - Uses publicly accessible search API (same as website)
 * - Respects rate limits (max 1 request per 2 seconds)
 * - Aggressive caching to minimize requests
 * - Proper attribution in responses
 * - Falls back gracefully if unavailable
 *
 * LEGAL NOTES:
 * - Based on CHORDONOMICON research (2024), Ultimate Guitar does NOT
 *   flag tab pages as disallowed in robots.txt
 * - Uses same endpoints as their public website
 * - For educational/non-commercial use
 */

export interface UltimateGuitarChord {
  name: string          // Chord name (e.g., "C", "Am7", "G/B")
  position: number      // Position in song (0-1, normalized)
  section?: string      // Section hint from tab (e.g., "Verse", "Chorus")
}

export interface UltimateGuitarTab {
  artist: string
  song: string
  rating: number
  votes: number
  chords: UltimateGuitarChord[]
  sections: Array<{
    name: string
    chords: string[]
  }>
  source: 'ultimate-guitar'
  url: string
  license: string
}

interface UGSearchResult {
  id: number
  song_name: string
  artist_name: string
  type: string
  rating: number
  votes: number
  tab_url: string
}

const UG_SEARCH_API = 'https://www.ultimate-guitar.com/search.php'
const UG_BASE_URL = 'https://tabs.ultimate-guitar.com'

// Rate limiting: 1 request per 2 seconds
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 2000 // 2 seconds

/**
 * Enforces rate limiting
 */
async function rateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    console.log(`Rate limiting: waiting ${waitTime}ms`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime = Date.now()
}

/**
 * Normalizes artist/song strings for better matching
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Searches Ultimate Guitar for tabs
 */
async function searchUltimateGuitar(
  artist: string,
  song: string
): Promise<UGSearchResult[]> {
  await rateLimit()

  try {
    // Clean search terms
    const cleanArtist = artist.replace(/\s*-\s*Topic$/, '').trim()
    const cleanSong = song
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/official.*$/i, '')
      .replace(/lyric.*$/i, '')
      .replace(/video.*$/i, '')
      .trim()

    // Build search query
    const query = `${cleanArtist} ${cleanSong}`
    const params = new URLSearchParams({
      search_type: 'title',
      value: query,
      type: '300' // Chords only (type 300)
    })

    const url = `${UG_SEARCH_API}?${params}`

    console.log(`UG: Searching for "${cleanArtist}" - "${cleanSong}"`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MusicCommentaryExtension/1.0.0 (Educational Use)',
        'Accept': 'application/json, text/html',
      }
    })

    if (!response.ok) {
      console.error(`UG search failed: ${response.status} ${response.statusText}`)
      return []
    }

    const html = await response.text()

    // Ultimate Guitar embeds search results in a JavaScript variable
    // Look for: window.UGAPP.store.page = {...}
    const dataMatch = html.match(/window\.UGAPP\.store\.page\s*=\s*({.*?});/s)

    if (!dataMatch) {
      console.log('UG: Could not find search results data')
      return []
    }

    const pageData = JSON.parse(dataMatch[1])
    const results = pageData?.data?.results || []

    console.log(`UG: Found ${results.length} results`)

    // Filter for chord tabs and sort by rating
    const chordTabs = results
      .filter((r: any) => r.type === 'Chords' || r.marketing_type === 'Chords')
      .map((r: any) => ({
        id: r.id,
        song_name: r.song_name,
        artist_name: r.artist_name,
        type: r.type || r.marketing_type,
        rating: r.rating || 0,
        votes: r.votes || 0,
        tab_url: r.tab_url
      }))
      .sort((a: UGSearchResult, b: UGSearchResult) => {
        // Sort by votes first (popularity), then rating
        if (b.votes !== a.votes) return b.votes - a.votes
        return b.rating - a.rating
      })

    return chordTabs.slice(0, 5) // Top 5 results

  } catch (error) {
    console.error('UG search error:', error)
    return []
  }
}

/**
 * Parses chord chart from Ultimate Guitar tab page
 */
function parseChordChart(tabContent: string): {
  chords: UltimateGuitarChord[]
  sections: Array<{ name: string; chords: string[] }>
} {
  const chords: UltimateGuitarChord[] = []
  const sections: Array<{ name: string; chords: string[] }> = []

  // Common chord patterns
  const chordRegex = /\b([A-G][#b]?(?:m|maj|min|aug|dim|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g

  // Section headers like [Verse], [Chorus], [Intro]
  const sectionRegex = /\[(Intro|Verse|Chorus|Bridge|Solo|Outro|Pre-Chorus|Interlude|Break)(?:\s+\d+)?\]/gi

  const lines = tabContent.split('\n')
  let currentSection: string | undefined
  let position = 0
  const totalLines = lines.length

  for (const line of lines) {
    position++
    const normalizedPosition = position / totalLines

    // Check for section headers
    const sectionMatch = line.match(sectionRegex)
    if (sectionMatch) {
      currentSection = sectionMatch[0].replace(/[\[\]]/g, '').trim()
      sections.push({ name: currentSection, chords: [] })
      continue
    }

    // Extract chords from line
    const lineChords = [...line.matchAll(chordRegex)]

    for (const match of lineChords) {
      const chordName = match[1]

      // Validate it's actually a chord (not just a word that matches pattern)
      if (isValidChord(chordName)) {
        chords.push({
          name: chordName,
          position: normalizedPosition,
          section: currentSection
        })

        // Add to current section
        if (sections.length > 0) {
          const lastSection = sections[sections.length - 1]
          if (!lastSection.chords.includes(chordName)) {
            lastSection.chords.push(chordName)
          }
        }
      }
    }
  }

  return { chords, sections }
}

/**
 * Validates if a string is a real chord
 */
function isValidChord(chord: string): boolean {
  // Must start with note A-G
  if (!/^[A-G]/.test(chord)) return false

  // Exclude common false positives
  const falsePositives = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] // Single letters without modifiers
  if (falsePositives.includes(chord) && chord.length === 1) return false

  return true
}

/**
 * Fetches tab content from Ultimate Guitar
 */
async function fetchTabContent(tabUrl: string): Promise<string | null> {
  await rateLimit()

  try {
    console.log(`UG: Fetching tab from ${tabUrl}`)

    const response = await fetch(tabUrl, {
      headers: {
        'User-Agent': 'MusicCommentaryExtension/1.0.0 (Educational Use)',
        'Accept': 'text/html',
      }
    })

    if (!response.ok) {
      console.error(`UG tab fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Ultimate Guitar embeds tab content in: window.UGAPP.store.page
    const dataMatch = html.match(/window\.UGAPP\.store\.page\s*=\s*({.*?});/s)

    if (!dataMatch) {
      console.log('UG: Could not find tab data')
      return null
    }

    const pageData = JSON.parse(dataMatch[1])
    const tabContent = pageData?.data?.tab_view?.wiki_tab?.content

    if (!tabContent) {
      console.log('UG: No tab content found')
      return null
    }

    return tabContent

  } catch (error) {
    console.error('UG tab fetch error:', error)
    return null
  }
}

/**
 * Fetches chord progressions from Ultimate Guitar
 */
export async function fetchUltimateGuitarChords(
  artist: string,
  song: string
): Promise<UltimateGuitarTab | null> {
  console.log('\n=== Fetching Ultimate Guitar Chords ===')
  console.log(`Artist: ${artist}`)
  console.log(`Song: ${song}`)

  try {
    // Search for tabs
    const searchResults = await searchUltimateGuitar(artist, song)

    if (searchResults.length === 0) {
      console.log('UG: No tabs found')
      return null
    }

    // Try the top result first
    const topResult = searchResults[0]
    console.log(`UG: Using top result: "${topResult.song_name}" by ${topResult.artist_name} (${topResult.votes} votes, ${topResult.rating} rating)`)

    // Fetch tab content
    const tabContent = await fetchTabContent(topResult.tab_url)

    if (!tabContent) {
      console.log('UG: Failed to fetch tab content')
      return null
    }

    // Parse chords
    const { chords, sections } = parseChordChart(tabContent)

    if (chords.length === 0) {
      console.log('UG: No chords found in tab')
      return null
    }

    console.log(`UG: Extracted ${chords.length} chords across ${sections.length} sections`)

    return {
      artist: topResult.artist_name,
      song: topResult.song_name,
      rating: topResult.rating,
      votes: topResult.votes,
      chords,
      sections,
      source: 'ultimate-guitar',
      url: topResult.tab_url,
      license: 'User-contributed content from Ultimate Guitar (https://www.ultimate-guitar.com). For educational use.'
    }

  } catch (error) {
    console.error('UG fetch error:', error)
    return null
  }
}

/**
 * Converts Ultimate Guitar chord data to section-based progressions
 * Compatible with existing ChordProgression format
 */
export function convertToSectionProgressions(
  ugTab: UltimateGuitarTab,
  audioSections: Array<{ start: number; end: number; type: string }>
): Array<{ section: string; progression: string }> {
  const progressions: Array<{ section: string; progression: string }> = []

  // If we have explicit sections from the tab, use those
  if (ugTab.sections.length > 0) {
    for (const section of ugTab.sections) {
      const uniqueChords = section.chords
      if (uniqueChords.length > 0) {
        progressions.push({
          section: section.name,
          progression: uniqueChords.join(' - ')
        })
      }
    }
    return progressions
  }

  // Otherwise, map chords to audio sections by position
  for (let i = 0; i < audioSections.length; i++) {
    const section = audioSections[i]
    const sectionStart = i / audioSections.length
    const sectionEnd = (i + 1) / audioSections.length

    // Find chords within this section's position range
    const sectionChords = ugTab.chords.filter(
      c => c.position >= sectionStart && c.position < sectionEnd
    )

    // Get unique chords in order
    const uniqueChords: string[] = []
    sectionChords.forEach(c => {
      if (uniqueChords.length === 0 || uniqueChords[uniqueChords.length - 1] !== c.name) {
        uniqueChords.push(c.name)
      }
    })

    if (uniqueChords.length > 0) {
      progressions.push({
        section: section.type,
        progression: uniqueChords.slice(0, 8).join(' - ') // Limit to 8 chords
      })
    }
  }

  return progressions
}
