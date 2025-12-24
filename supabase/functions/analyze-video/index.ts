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
        sections: cachedData.sections
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
      const { error: insertError } = await supabase
        .from('audio_analysis_cache')
        .insert({
          video_id: videoId,
          video_title: videoTitle,
          duration: audioAnalysis.duration,
          tempo: audioAnalysis.tempo,
          key: audioAnalysis.key,
          beats: audioAnalysis.beats,
          sections: audioAnalysis.sections,
        })

      if (insertError) {
        console.error('Error caching analysis:', insertError)
        // Don't fail the request, just log the error
      } else {
        console.log('Analysis cached successfully')
      }
    }

    // 4. Build OpenAI prompt with exact timestamps
    console.log('Building prompt with timestamps...')
    const prompt = buildPromptWithTimestamps(
      videoTitle,
      channelName,
      level,
      audioAnalysis
    )

    // 5. Call OpenAI to generate commentary
    console.log('Generating commentary with OpenAI...')
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
