// Configuration for Music Commentary Extension

// IMPORTANT: Update this with your Supabase project URL after deployment
// Get this from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
// Format: https://YOUR_PROJECT_REF.supabase.co/functions/v1/analyze-video

const CONFIG = {
  // Supabase Edge Function URL - Production
  SUPABASE_FUNCTION_URL: 'https://zfobytnooazolkaclbxa.supabase.co/functions/v1/analyze-video',

  // For local testing, use:
  // SUPABASE_FUNCTION_URL: 'http://localhost:54321/functions/v1/analyze-video',

  // Timeout for API requests (in milliseconds)
  API_TIMEOUT: 120000, // 120 seconds (2 minutes) - increased for GPT-4o

  // Enable debug logging
  DEBUG: true,
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
