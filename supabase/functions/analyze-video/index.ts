// Supabase Edge Function for Music Commentary
// Analyzes YouTube videos using OpenAI's GPT API with Modal audio analysis

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const MODAL_AUDIO_ANALYSIS_URL = Deno.env.get('MODAL_AUDIO_ANALYSIS_URL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzeRequest {
  videoId: string
  videoTitle: string
  channelName: string
  level: 'novice' | 'intermediate' | 'advanced'
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface AudioAnalysis {
  success: boolean
  duration?: number
  tempo?: number
  key?: string
  beats?: number[]
  sections?: Array<{
    start: number
    end: number
    type: string
  }>
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { videoId, videoTitle, channelName, level }: AnalyzeRequest = await req.json()

    if (!videoId || !level) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: videoId and level' }),
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

    console.log(`Analyzing video ${videoId} at ${level} level`)

    // Initialize Supabase client for caching
    const supabase = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_SERVICE_ROLE_KEY ?? ''
    )

    // Step 1: Check cache for audio analysis
    let audioAnalysis: AudioAnalysis | null = null

    if (supabase) {
      const { data: cachedAnalysis } = await supabase
        .from('audio_analysis_cache')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (cachedAnalysis) {
        console.log('Using cached audio analysis')
        audioAnalysis = {
          success: true,
          duration: cachedAnalysis.duration,
          tempo: cachedAnalysis.tempo,
          key: cachedAnalysis.key,
          beats: cachedAnalysis.beats,
          sections: cachedAnalysis.sections,
        }
      }
    }

    // Step 2: If not cached, call Modal audio analysis service
    if (!audioAnalysis && MODAL_AUDIO_ANALYSIS_URL) {
      console.log('Calling Modal audio analysis service...')

      try {
        const modalResponse = await fetch(MODAL_AUDIO_ANALYSIS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ video_id: videoId }),
        })

        console.log('Modal response status:', modalResponse.status)

        if (modalResponse.ok) {
          const rawResponse = await modalResponse.text()
          console.log('Modal raw response:', rawResponse.substring(0, 200))

          audioAnalysis = JSON.parse(rawResponse)
          console.log('Parsed audioAnalysis:', JSON.stringify(audioAnalysis).substring(0, 200))

          // Cache the analysis if successful
          if (audioAnalysis?.success && supabase) {
            await supabase
              .from('audio_analysis_cache')
              .upsert({
                video_id: videoId,
                video_title: videoTitle,
                duration: audioAnalysis.duration,
                tempo: audioAnalysis.tempo,
                key: audioAnalysis.key,
                beats: audioAnalysis.beats,
                sections: audioAnalysis.sections,
                analyzed_at: new Date().toISOString(),
              })

            console.log('Audio analysis cached successfully')
          } else {
            console.warn('Modal returned success=false or no supabase client')
          }
        } else {
          const errorText = await modalResponse.text()
          console.warn('Modal audio analysis failed with status', modalResponse.status, ':', errorText)
        }
      } catch (modalError) {
        console.error('Error calling Modal service:', modalError)
        // Continue with fallback - don't fail the whole request
      }
    }

    // Step 3: Generate level-specific prompt with audio analysis data
    const prompt = generatePrompt(videoId, videoTitle, channelName, level, audioAnalysis)

    // Step 4: Call OpenAI API
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
        JSON.stringify({ error: 'Failed to analyze video', details: errorText }),
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

    // Return the commentary with audio analysis metadata
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        level,
        commentary,
        audioAnalysis: audioAnalysis?.success ? {
          tempo: audioAnalysis.tempo,
          key: audioAnalysis.key,
          duration: audioAnalysis.duration,
        } : null,
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

function generatePrompt(videoId: string, videoTitle: string, channelName: string, level: string, audioAnalysis: AudioAnalysis | null = null): string {
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

  // Build audio analysis context if available
  let audioContext = ''
  let timestampGuidance = 'Make timestamps realistic estimates based on typical song structure'

  if (audioAnalysis?.success) {
    audioContext = `

AUDIO ANALYSIS DATA (Use these EXACT timestamps):
- Duration: ${audioAnalysis.duration?.toFixed(1)} seconds
- Tempo: ${audioAnalysis.tempo?.toFixed(1)} BPM
- Key: ${audioAnalysis.key}
- Detected Sections:
${audioAnalysis.sections?.map((s, i) =>
  `  ${i + 1}. [${formatTime(s.start)}] ${s.type} (${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s)`
).join('\n')}
`

    timestampGuidance = 'Use the EXACT timestamps from the audio analysis data above. Do NOT estimate - use the provided section start times.'
  }

  return `You are an expert music educator providing educational commentary for a YouTube music video.

Video Information:
- Video ID: ${videoId}
- Title: ${videoTitle}
- Channel: ${channelName}
- YouTube URL: https://www.youtube.com/watch?v=${videoId}
${audioContext}

Education Level: ${level.toUpperCase()}
${levelInstructions[level as keyof typeof levelInstructions]}

Your task:
1. Provide educational music commentary structured as TIMESTAMPED SECTIONS
2. Divide the video into MAJOR SECTIONS (Intro, Verse, Chorus, Bridge, Outro, Solo, etc.)
3. For each section, provide commentary about:
   - Musical elements (melody, harmony, rhythm, structure)
   - Production techniques and sound design
   - Genre characteristics and influences
   - Performance aspects
   - Historical or cultural context (if relevant)

4. CRITICAL FORMAT REQUIREMENTS:
   - Start each section with a timestamp in the format: ## [MM:SS] Section Name
   - Example: ## [0:00] Intro, ## [0:15] Verse 1, ## [0:45] Chorus
   - Follow with 2-4 sentences of educational commentary for that section
   - Use **bold** for important musical terms
   - Use bullet points for listing specific elements
   - Keep each section concise (50-100 words per section)

5. Example structure:
   ## [0:00] Intro
   The song opens with...

   ## [0:15] Verse 1
   The verse introduces...

6. Requirements:
   - ${timestampGuidance}
   - Identify 4-8 major sections (don't over-segment)
   - Keep commentary educational and appropriate for ${level} level
   - Total length: 400-600 words across all sections
   ${audioAnalysis?.success ? `- Reference the detected tempo (${audioAnalysis.tempo?.toFixed(0)} BPM) and key (${audioAnalysis.key}) in your analysis` : ''}

Begin your timestamped analysis:`
}

// Helper function to format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
