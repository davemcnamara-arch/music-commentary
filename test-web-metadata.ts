// Test script for web metadata fetching (without audio analysis)
// Run with: deno run --allow-net test-web-metadata.ts

import { fetchWebMetadata } from './supabase/functions/analyze-video/web-metadata-fetcher.ts'

async function testWebMetadata() {
  console.log('Testing Web Metadata Fetching...\n')

  const tests = [
    { artist: 'The Beatles', song: 'Let It Be' },
    { artist: 'Led Zeppelin', song: 'Stairway to Heaven' },
    { artist: 'Pink Floyd', song: 'Comfortably Numb' },
  ]

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: "${test.song}" by ${test.artist}`)
    console.log('='.repeat(60))

    try {
      const metadata = await fetchWebMetadata(test.artist, test.song)

      console.log('\n📊 Results:')
      console.log(`  Confidence: ${metadata.confidence}`)
      console.log(`  Sources: ${metadata.sources.join(', ') || 'none'}`)
      console.log(`  Genre: ${metadata.genre || 'unknown'}`)
      console.log(`  Key: ${metadata.key || 'unknown'}`)
      console.log(`  Tempo: ${metadata.tempo || 'unknown'} BPM`)

      if (metadata.ultimateGuitarTab) {
        console.log('\n🎸 Ultimate Guitar:')
        console.log(`  Rating: ${metadata.ultimateGuitarTab.rating}/5`)
        console.log(`  Votes: ${metadata.ultimateGuitarTab.votes}`)
        console.log(`  Sections: ${metadata.ultimateGuitarTab.sections.length}`)

        if (metadata.ultimateGuitarTab.sections.length > 0) {
          console.log('\n  Chord Progressions:')
          metadata.ultimateGuitarTab.sections.slice(0, 3).forEach(section => {
            console.log(`    ${section.name}: ${section.chords.join(' - ')}`)
          })
        }
      }

      // Wait 3 seconds between requests (rate limiting)
      await new Promise(resolve => setTimeout(resolve, 3000))

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`)
    }
  }

  console.log('\n\n✅ Testing complete!')
}

testWebMetadata()
