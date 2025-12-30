// Supabase Edge Function for Music Commentary with Audio Analysis
// Uses Modal for audio analysis, then OpenAI for generating commentary

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODAL_ENDPOINT = Deno.env.get('MODAL_ENDPOINT')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzeRequest {
  videoId: string
  videoTitle: string
  channelName: string
  level: 'novice' | 'intermediate' | 'advanced'
  cookies: Record<string, string>
}

interface AudioAnalysis {
  duration: number
  tempo: number
  key: string
  beats: number[]
  sections: Array<{
    start: number
    end: number
    type: string
  }>
  chord_progressions?: Array<{
    section: string
    progression: string
  }>
}

interface ClassifiedSection {
  start: number
  end: number
  type: string
  classifiedName: string
}

interface ChordProgression {
  section: string
  progression: string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { videoId, videoTitle, channelName, level, cookies }: AnalyzeRequest = await req.json()

    if (!videoId || !level) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: videoId and level' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!cookies) {
      return new Response(
        JSON.stringify({ error: 'Missing cookies for audio download' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!MODAL_ENDPOINT) {
      return new Response(
        JSON.stringify({ error: 'Modal endpoint not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Analyzing video ${videoId} at ${level} level`)

    // Initialize Supabase client
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Check cache for existing analysis
    console.log('Checking cache for existing analysis...')
    let audioAnalysis: AudioAnalysis | null = null

    const { data: cachedData, error: cacheError } = await supabase
      .from('audio_analysis_cache')
      .select('*')
      .eq('video_id', videoId)
      .single()

    if (cachedData && !cacheError) {
      console.log('Found cached analysis!')
      audioAnalysis = {
        duration: cachedData.duration,
        tempo: cachedData.tempo,
        key: cachedData.key,
        beats: cachedData.beats,
        sections: cachedData.sections,
        chord_progressions: cachedData.chord_progressions
      }
    } else {
      // 2. No cache - call Modal for audio analysis
      console.log('No cache found, calling Modal for audio analysis...')

      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

      const modalResponse = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          youtube_url: youtubeUrl,
          cookies: cookies
        }),
      })

      if (!modalResponse.ok) {
        const errorText = await modalResponse.text()
        console.error('Modal API error:', errorText)
        return new Response(
          JSON.stringify({
            error: 'Failed to analyze audio',
            details: 'Audio download or analysis failed. The video may be private or unavailable.'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const modalData = await modalResponse.json()

      if (!modalData.success || !modalData.analysis) {
        console.error('Modal returned unsuccessful response:', modalData)
        return new Response(
          JSON.stringify({
            error: 'Audio analysis failed',
            details: modalData.error || 'Unknown error from audio analysis service'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      audioAnalysis = modalData.analysis
      console.log('Audio analysis complete:', audioAnalysis)

      // 3. Cache the analysis results
      console.log('Caching analysis results...')
      const cacheData: any = {
        video_id: videoId,
        video_title: videoTitle,
        duration: audioAnalysis.duration,
        tempo: audioAnalysis.tempo,
        key: audioAnalysis.key,
        beats: audioAnalysis.beats,
        sections: audioAnalysis.sections,
      }

      // Add chord progressions if available
      if (audioAnalysis.chord_progressions) {
        cacheData.chord_progressions = audioAnalysis.chord_progressions
      }

      const { error: insertError } = await supabase
        .from('audio_analysis_cache')
        .insert(cacheData)

      if (insertError) {
        console.error('Error caching analysis:', insertError)
        // Don't fail the request, just log the error
      } else {
        console.log('Analysis cached successfully')
      }
    }

    // 4. Detect genre and classify sections
    console.log('Detecting genre and classifying sections...')
    const genre = detectGenre(videoTitle, channelName)
    const classifiedSections = classifySections(audioAnalysis.sections, genre, audioAnalysis)

    // 5. Use chord progressions from Modal (already analyzed by section)
    let chordProgressions: ChordProgression[] | null = null
    if (audioAnalysis.chord_progressions && audioAnalysis.chord_progressions.length > 0) {
      console.log('Using chord progressions from audio analysis...')
      chordProgressions = audioAnalysis.chord_progressions
    }

    // 6. Build enhanced prompt
    console.log('Building enhanced prompt...')
    const prompt = buildEnhancedPrompt(
      videoTitle,
      channelName,
      level,
      genre,
      classifiedSections,
      audioAnalysis,
      chordProgressions
    )

    // 7. Call OpenAI to generate commentary
    console.log('Generating commentary with OpenAI...')
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to generate commentary', details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const openaiData: OpenAIResponse = await openaiResponse.json()

    // Extract the generated commentary
    const commentary = openaiData.choices?.[0]?.message?.content || 'No commentary generated'

    console.log('Successfully generated commentary')

    // Return the commentary
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        level,
        commentary,
        audioAnalysis: {
          duration: audioAnalysis.duration,
          tempo: audioAnalysis.tempo,
          key: audioAnalysis.key,
          sectionCount: audioAnalysis.sections.length
        },
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function detectGenre(title: string, channel: string): string {
  const text = `${title} ${channel}`.toLowerCase()

  // Classical
  if (text.match(/\b(symphony|concerto|sonata|quartet|bach|beethoven|mozart|chopin|brahms|tchaikovsky|classical)\b/i)) {
    return 'classical'
  }

  // Jazz
  if (text.match(/\b(jazz|bebop|swing|coltrane|monk|mingus|standards)\b|miles davis/i)) {
    return 'jazz'
  }

  // Rock (check before Beatles/beat issue)
  if (text.match(/\b(beatles|rock|metal|punk|grunge|alternative|rolling stones|led zeppelin)\b/i)) {
    return 'rock'
  }

  // Hip-hop (use word boundaries to avoid matching "beatles")
  if (text.match(/\b(rap|hiphop|hip-hop|freestyle|trap|drill)\b|\bbeat\b(?!les)/i)) {
    return 'hiphop'
  }

  // Electronic
  if (text.match(/\b(edm|techno|house|electronic|synth|dnb|dubstep|trance)\b/i)) {
    return 'electronic'
  }

  // Folk
  if (text.match(/\b(folk|traditional|ballad|acoustic)\b|singer.songwriter/i)) {
    return 'folk'
  }

  // Default to pop
  return 'pop'
}

function classifyPopSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  // Improved classification for 6-8 section songs
  // Pattern: Intro - Verse - Verse - Chorus - Verse - Chorus - Solo/Bridge - Verse - Chorus - Outro

  return sections.map((section, i) => {
    let name = ''
    const totalSections = sections.length

    // First section: Introduction (if short, < 15 seconds)
    if (i === 0) {
      if (section.end - section.start < 15) {
        name = 'Introduction'
      } else {
        name = 'Verse 1'  // Long first section is probably verse
      }
    }
    // Last section: Outro or Final Chorus
    else if (i === totalSections - 1) {
      if (section.end - section.start > 30) {
        name = 'Final Chorus + Outro'
      } else {
        name = 'Outro'
      }
    }
    // Middle sections: intelligent pattern based on position
    else {
      const position = i / (totalSections - 1)  // 0 to 1

      if (position < 0.3) {
        // Early sections (0-30%): verses
        name = `Verse ${i}`
      } else if (position >= 0.3 && position < 0.45) {
        // First chorus appears around 30-45% through
        name = 'Chorus'
      } else if (position >= 0.45 && position < 0.6) {
        // Middle section (45-60%): verse or instrumental
        if (section.end - section.start > 20) {
          name = 'Instrumental Solo'  // Longer section = solo
        } else {
          name = `Verse ${Math.floor(i * 0.6)}`
        }
      } else if (position >= 0.6 && position < 0.85) {
        // Later sections (60-85%): alternating verse/chorus
        name = position < 0.7 ? `Verse ${Math.floor(i * 0.5)}` : 'Chorus'
      } else {
        // Final sections before outro (85-95%): final chorus or bridge
        name = position < 0.95 ? 'Final Chorus' : 'Bridge/Coda'
      }
    }

    return { ...section, classifiedName: name }
  })
}

function classifyClassicalSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  const totalDuration = analysis.duration

  return sections.map((section, i) => {
    const position = section.start / totalDuration
    let name = ''

    if (i === 0 && section.end - section.start < 60) {
      name = 'Introduction'
    } else if (position < 0.35) {
      name = 'Exposition'
    } else if (position < 0.65) {
      name = 'Development'
    } else if (position < 0.90) {
      name = 'Recapitulation'
    } else {
      name = 'Coda'
    }

    return { ...section, classifiedName: name }
  })
}

function classifyJazzSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  const instruments = ['Trumpet', 'Saxophone', 'Piano', 'Bass', 'Guitar', 'Drums']

  return sections.map((section, i) => {
    let name = ''

    if (i === 0) {
      name = 'Head (Theme Statement)'
    } else if (i === sections.length - 1) {
      name = 'Out Head (Theme Return)'
    } else {
      const soloNum = i - 1
      name = `Solo Section (${instruments[soloNum % instruments.length]})`
    }

    return { ...section, classifiedName: name }
  })
}

function classifyFolkSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  return sections.map((section, i) => {
    let name = ''

    if (i === 0) name = 'Introduction'
    else if (i === sections.length - 1) name = 'Outro'
    else name = i % 2 === 1 ? `Verse ${Math.floor(i / 2) + 1}` : 'Chorus/Refrain'

    return { ...section, classifiedName: name }
  })
}

function classifyHipHopSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  return sections.map((section, i) => {
    let name = ''

    if (i === 0) name = 'Intro'
    else if (i === sections.length - 1) name = 'Outro'
    else name = i % 2 === 1 ? `Verse ${Math.floor(i / 2) + 1}` : 'Hook/Chorus'

    return { ...section, classifiedName: name }
  })
}

function classifyElectronicSections(sections: any[], analysis: AudioAnalysis): ClassifiedSection[] {
  return sections.map((section, i) => {
    let name = ''

    if (i === 0) name = 'Intro/Build-up'
    else if (i === sections.length - 1) name = 'Outro'
    else name = i % 2 === 1 ? 'Build-up' : `Drop ${Math.floor(i / 2)}`

    return { ...section, classifiedName: name }
  })
}

function classifySections(sections: any[], genre: string, analysis: AudioAnalysis): ClassifiedSection[] {
  switch (genre) {
    case 'classical':
      return classifyClassicalSections(sections, analysis)
    case 'jazz':
      return classifyJazzSections(sections, analysis)
    case 'pop':
    case 'rock':
      return classifyPopSections(sections, analysis)
    case 'folk':
      return classifyFolkSections(sections, analysis)
    case 'hiphop':
      return classifyHipHopSections(sections, analysis)
    case 'electronic':
      return classifyElectronicSections(sections, analysis)
    default:
      return classifyPopSections(sections, analysis)
  }
}

function summarizeChordProgressions(sections: ClassifiedSection[], chords: any[], key: string): ChordProgression[] {
  // Group chords by section
  const sectionChords = sections.map(section => {
    // Find chords within this section's timeframe
    const chordsInSection = chords.filter(
      c => c.time >= section.start && c.time < section.end
    )

    if (chordsInSection.length === 0) return null

    // Get unique chords in order
    const uniqueChords: string[] = []
    chordsInSection.forEach(c => {
      if (uniqueChords.length === 0 || uniqueChords[uniqueChords.length - 1] !== c.chord) {
        uniqueChords.push(c.chord)
      }
    })

    return {
      section: section.classifiedName,
      chords: uniqueChords.join(' - ')
    }
  }).filter(Boolean) as ChordProgression[]

  return sectionChords
}

function determineOverallForm(sections: ClassifiedSection[], genre: string): string {
  const names = sections.map(s => s.classifiedName)

  if (names.some(n => n.includes('Exposition'))) return 'Sonata Form'
  if (names.some(n => n.includes('Head'))) return '32-bar AABA Form (Jazz Standard)'
  if (names.filter(n => n.includes('Verse')).length > 0 &&
      names.filter(n => n.includes('Chorus')).length > 0) return 'Verse-Chorus Form'
  if (names.some(n => n.includes('Drop'))) return 'Build-Drop Form'
  if (names.filter(n => n.includes('Verse')).length > 2) return 'Strophic Form'

  return 'Standard Song Form'
}

function selectKeyMoments(sections: ClassifiedSection[], min: number, max: number): ClassifiedSection[] {
  const moments: ClassifiedSection[] = []

  // Always include intro and outro
  moments.push(sections[0])
  moments.push(sections[sections.length - 1])

  // Add sections with type changes (interesting transitions)
  for (let i = 1; i < sections.length - 1; i++) {
    if (sections[i].classifiedName !== sections[i-1].classifiedName) {
      moments.push(sections[i])
    }
  }

  // If too many, keep most diverse
  if (moments.length > max) {
    // Keep intro, outro, and evenly spaced middle moments
    const middle = moments.slice(1, -1)
    const step = Math.floor(middle.length / (max - 2))
    return [
      moments[0],
      ...middle.filter((_, i) => i % step === 0).slice(0, max - 2),
      moments[moments.length - 1]
    ]
  }

  // If too few, add more from middle
  while (moments.length < min && moments.length < sections.length) {
    const gap = Math.floor(sections.length / (moments.length + 1))
    moments.splice(moments.length - 1, 0, sections[gap])
  }

  return moments.sort((a, b) => a.start - b.start)
}

function getWordLimit(level: string, section: string): number {
  const limits: Record<string, Record<string, number>> = {
    novice: { noticing: 30, significance: 30, context: 30, listenTo: 20 },
    intermediate: { noticing: 40, significance: 40, context: 40, listenTo: 25 },
    advanced: { noticing: 60, significance: 60, context: 60, listenTo: 30 }
  }

  return limits[level]?.[section] || 40
}

function getLevelInstructions(level: string): string {
  const instructions: Record<string, string> = {
    novice: `AUDIENCE: Music lovers with no formal training
VOCABULARY: Use everyday language, avoid jargon (or explain it immediately)
TONE: Enthusiastic and welcoming
EXPLANATIONS: Use analogies and comparisons to familiar things
EXAMPLE STYLE: "The trumpet sounds bright and piercing, like a beam of light cutting through fog"`,

    intermediate: `AUDIENCE: Music students, engaged learners, hobbyist musicians
VOCABULARY: Standard music terms (melody, harmony, chord, timbre) with brief inline explanations
TONE: Educational but conversational
EXPLANATIONS: Balance technical accuracy with accessibility
EXAMPLE STYLE: "The piccolo trumpet (a smaller, higher trumpet) plays baroque-style ornamentation, creating timbral contrast with the pop instrumentation"`,

    advanced: `AUDIENCE: Music theory students, professionals, serious analysts
VOCABULARY: Full technical terminology without explanation
TONE: Scholarly and precise
EXPLANATIONS: Reference theoretical frameworks, historical practices, and analytical methods
EXAMPLE STYLE: "The piccolo trumpet's baroque ornamentation and intervallic phrasing references Handelian trumpet writing, creating timbral stratification through spectral separation (2-4kHz emphasis vs 200-800Hz backing)"`
  }

  return instructions[level] || instructions.intermediate
}

function getExampleCommentary(level: string, genre: string): string {
  if (genre === 'pop' && level === 'intermediate') {
    return `EXAMPLE OF EXCELLENT COMMENTARY (for your reference):

[1:29] INSTRUMENTAL SOLO (PICCOLO TRUMPET)

NOTICING: Listen for the bright piccolo trumpet entering with rapid ornamental notes that cascade down the scale. Notice how its high register cuts clearly through the backing track of bass, drums, and piano.

SIGNIFICANCE: This solo creates dramatic contrast by introducing a classical baroque instrument into a pop context. The trumpet's brightness shifts the sonic palette from warm to brilliant, creating a memorable signature moment.

CONTEXT: Producer George Martin hired David Mason from the London Symphony Orchestra for this session. Mason's baroque-style playing references 18th-century composers, connecting 1960s pop to classical traditions - groundbreaking for 1967.

LISTEN TO THIS: Beach Boys - "God Only Knows" (baroque harpsichord in pop), Procol Harum - "A Whiter Shade of Pale" (Bach-influenced organ), The Left Banke - "Walk Away Renée" (orchestral strings in rock).`
  }

  return ''
}

function buildStructureOverview(
  sections: ClassifiedSection[],
  analysis: AudioAnalysis,
  chordProgressions: ChordProgression[] | null,
  genre: string
): string {
  const sectionsList = sections.map(section => {
    const start = formatTime(section.start)
    const end = formatTime(section.end)
    return `[${start}-${end}]  ${section.classifiedName}`
  }).join('\n')

  // Only show chord progressions if they look reasonable
  let chordsSection = ''
  if (chordProgressions && chordProgressions.length > 0) {
    // Filter out nonsensical progressions
    const validProgressions = chordProgressions.filter(cp => {
      return cp.progression &&
             cp.progression !== 'N/A' &&
             cp.progression.split(' - ').length >= 2 &&  // At least 2 chords
             cp.progression.split(' - ').length <= 8     // Not more than 8
    })

    if (validProgressions.length > 0) {
      chordsSection = '\n\nCHORD PROGRESSIONS (Roman numeral analysis):\n' +
        validProgressions
          .filter(cp => !cp.section.toLowerCase().includes('introduction'))  // Skip intro
          .map(cp => `${cp.section}: ${cp.progression}`)
          .join('\n')
    }
  }

  // Determine overall form
  const form = determineOverallForm(sections, genre)

  return `════════════════════════════════════════════════════
SONG STRUCTURE
════════════════════════════════════════════════════

${sectionsList}${chordsSection}

Form: ${form}
Tempo: ${Math.round(analysis.tempo)} BPM
Key: ${analysis.key}
Duration: ${formatTime(analysis.duration)}

════════════════════════════════════════════════════
DETAILED ANALYSIS
════════════════════════════════════════════════════`
}

function buildEnhancedPrompt(
  title: string,
  channel: string,
  level: string,
  genre: string,
  sections: ClassifiedSection[],
  analysis: AudioAnalysis,
  chordProgressions: ChordProgression[] | null
): string {
  // Format structure overview
  const structureOverview = buildStructureOverview(sections, analysis, chordProgressions, genre)

  // Get level-specific instructions
  const levelInstructions = getLevelInstructions(level)

  // Get example commentary
  const exampleCommentary = getExampleCommentary(level, genre)

  // Select key moments for detailed analysis
  const keyMoments = selectKeyMoments(sections, 4, 6)

  return `You are a music educator analyzing this recording for students.

SONG: "${title}" by ${channel}
GENRE: ${genre.toUpperCase()}

${structureOverview}

${levelInstructions}

${exampleCommentary}

CRITICAL CONSTRAINT - VERIFY SECTION STRUCTURE:
The structure analysis is algorithmic and may not be perfect. Use your musical knowledge to:

1. Verify section names make sense (most pop songs don't have 12 verses)
2. Adjust timestamps if they seem off by a few seconds
3. Focus commentary on the ACTUAL musical moments you know exist in this song
4. If a section seems wrong (e.g., "Verse 10"), identify what it actually is based on the music

For well-known songs, use your knowledge of the actual structure as a guide. The detected timestamps are a STARTING POINT - correct obvious errors based on musical reality.

YOUR TASK:

First, output the STRUCTURE OVERVIEW exactly as shown above (copy it verbatim).

Then, generate detailed commentary for ${keyMoments.length} key moments from the structure.

Choose the most musically interesting or significant moments to analyze.

For each moment:

[MM:SS] SECTION NAME

NOTICING: (1-2 sentences)
Direct attention to ONE specific, hearable element.
Be concrete: name instruments, describe sound qualities, identify techniques.
Use "Listen for..." or "Notice how..."

SIGNIFICANCE: (1-2 sentences)
Explain WHY this matters musically - cause and effect.
How does it serve the song? What effect does it create?

CONTEXT: (1-2 sentences)
Historical, cultural, or technical background.
Ground in verifiable facts. Compare to other works if relevant.

LISTEN TO THIS: (1 sentence)
Suggest 2-3 specific songs with SIMILAR characteristics.
Briefly explain the connection (e.g., "similar baroque trumpet fusion").

CRITICAL QUALITY RULES:

1. BE SPECIFIC - reference actual musical elements you can identify
   ❌ "The instruments play together nicely"
   ✅ "The bass plays a descending chromatic line while the drums maintain a steady backbeat"

2. NO GENERIC STATEMENTS - every sentence should teach something concrete
   ❌ "This creates emotion"
   ✅ "The ascending melody over static harmony creates tension and anticipation"

3. GROUND IN AUDIO REALITY - don't invent production details
   If uncertain, use "appears to," "suggests," or "characteristic of"

4. MAKE CONNECTIONS - relate theory to what listener hears
   Don't just state facts, explain their musical effect

5. STAY FOCUSED - each moment should highlight ONE main point

6. VERIFY SUGGESTIONS - only recommend songs that genuinely share characteristics

WORD LIMITS (strictly enforce):
- NOTICING: max ${getWordLimit(level, 'noticing')} words
- SIGNIFICANCE: max ${getWordLimit(level, 'significance')} words
- CONTEXT: max ${getWordLimit(level, 'context')} words
- LISTEN TO THIS: max ${getWordLimit(level, 'listenTo')} words

BEFORE FINALIZING, CHECK EACH BLOCK:
✓ Does NOTICING describe something you can actually HEAR?
✓ Does SIGNIFICANCE explain a musical CAUSE and EFFECT?
✓ Does CONTEXT include a VERIFIABLE fact?
✓ Does LISTEN TO THIS explain WHY the suggestions are similar?
✓ Is every sentence teaching something SPECIFIC?

Generate the complete analysis now (structure overview + detailed commentary):
`
}

function buildPromptWithTimestamps(
  videoTitle: string,
  channelName: string,
  level: string,
  analysis: AudioAnalysis
): string {
  const levelInstructions = {
    novice: `
      Target audience: Complete beginners with little to no musical knowledge.
      - Use simple, everyday language
      - Explain basic concepts like rhythm, melody, harmony
      - Avoid technical jargon or define it clearly when necessary
      - Focus on what listeners can hear and feel
      - Make connections to familiar experiences
    `,
    intermediate: `
      Target audience: People with some musical knowledge or experience.
      - Use standard music theory terminology
      - Explain chord progressions, key signatures, and song structure
      - Discuss basic production techniques
      - Analyze compositional choices
      - Reference common musical patterns and genres
    `,
    advanced: `
      Target audience: Musicians, producers, or serious music students.
      - Use advanced music theory and production terminology
      - Deep dive into harmonic analysis, modulations, and complex structures
      - Discuss production techniques, mixing, and sound design
      - Analyze artistic choices and influences
      - Reference specific techniques and advanced concepts
    `
  }

  // Format sections with timestamps
  const sectionsText = analysis.sections
    .map((section, index) => {
      const startTime = formatTime(section.start)
      const endTime = formatTime(section.end)
      return `  [${startTime}-${endTime}] Section ${index + 1} (${section.type})`
    })
    .join('\n')

  return `You are an expert music educator providing educational commentary for a YouTube music video.

Video Information:
- Title: ${videoTitle}
- Channel: ${channelName}

Audio Analysis Results (EXACT, from librosa analysis):
- Duration: ${analysis.duration.toFixed(1)} seconds
- Tempo: ${analysis.tempo.toFixed(1)} BPM
- Key: ${analysis.key}
- Detected Sections:
${sectionsText}

Education Level: ${level.toUpperCase()}
${levelInstructions[level as keyof typeof levelInstructions]}

Your task:
Provide timestamped educational music commentary using the EXACT timestamps from the audio analysis above. You MUST use these exact section timestamps to structure your commentary.

Format Requirements:
- Use heading format: ## [MM:SS] Section Name
- For each major section, provide educational commentary about what's happening musically
- Include 4-6 key moments from the sections above
- Use **bold** for important musical terms
- Reference the detected tempo (${analysis.tempo.toFixed(1)} BPM) and key (${analysis.key}) in your analysis
- Keep each section description concise (2-3 sentences)
- Total length: 400-600 words

Example format:
## [0:00] Intro
The song opens in **${analysis.key}** with a moderate tempo of **${analysis.tempo.toFixed(0)} BPM**...

## [0:15] First Verse
Notice how the **melody** develops here...

Focus on providing deep insight into the music itself, explaining WHY the musical choices work and WHAT techniques are being used. Use the exact timestamps provided above.

Begin your analysis:`
}
