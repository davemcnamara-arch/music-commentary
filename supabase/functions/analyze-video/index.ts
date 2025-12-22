// Supabase Edge Function for Music Commentary
// Analyzes YouTube videos using OpenAI's GPT API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
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

    // Generate level-specific prompt
    const prompt = generatePrompt(videoId, videoTitle, channelName, level)

    console.log(`Analyzing video ${videoId} at ${level} level`)

    // Call OpenAI API
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

    // Return the commentary
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        level,
        commentary,
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

function generatePrompt(videoId: string, videoTitle: string, channelName: string, level: string): string {
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

  return `You are an expert music educator providing educational commentary for a YouTube music video.

Video Information:
- Video ID: ${videoId}
- Title: ${videoTitle}
- Channel: ${channelName}
- YouTube URL: https://www.youtube.com/watch?v=${videoId}

Education Level: ${level.toUpperCase()}
${levelInstructions[level as keyof typeof levelInstructions]}

Your task:
1. Provide educational music commentary about this video
2. Include insights about:
   - Musical elements (melody, harmony, rhythm, structure)
   - Production techniques and sound design
   - Genre characteristics and influences
   - Performance aspects
   - Historical or cultural context (if relevant)

3. Format your response with clear sections using markdown:
   - Use ## for main section headings
   - Use **bold** for important terms
   - Use bullet points for lists
   - Include specific timestamps if discussing particular moments (e.g., "At 0:45, the chorus introduces...")

4. Keep the commentary:
   - Educational and insightful
   - Appropriate for the ${level} level
   - Engaging and well-structured
   - Between 400-800 words

Begin your analysis:`
}
