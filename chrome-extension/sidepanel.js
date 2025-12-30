// Side panel script for Music Commentary Extension

// State management
let currentVideoInfo = null;
let youtubeCookies = null;
let selectedLevel = null;
let timestampedSections = [];
let currentSectionIndex = -1;
let videoTimeInterval = null;
let isPaused = false;

// Text-to-Speech state
let ttsUtterance = null;
let ttsVoice = null;
let currentCommentaryText = '';
let isSpeaking = false;

// DOM elements
const videoTitleElement = document.getElementById('video-title');
const videoChannelElement = document.getElementById('video-channel');
const selectedLevelElement = document.getElementById('selected-level');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingSection = document.getElementById('loading-section');
const progressSection = document.getElementById('progress-section');
const commentarySection = document.getElementById('commentary-section');
const commentaryContent = document.getElementById('commentary-content');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const levelButtons = document.querySelectorAll('.level-btn');
const syncControls = document.getElementById('sync-controls');
const syncEnabled = document.getElementById('sync-enabled');
const syncModeInputs = document.querySelectorAll('input[name="sync-mode"]');
const autoReadEnabled = document.getElementById('auto-read-enabled');
const resumeBtn = document.getElementById('resume-btn');
const manualResumeBtn = document.getElementById('manual-resume-btn');

// Progress stage elements
const stageDownload = document.getElementById('stage-download');
const stageAnalysis = document.getElementById('stage-analysis');
const stageCommentary = document.getElementById('stage-commentary');

// TTS and Pop-out elements
const readAloudBtn = document.getElementById('read-aloud-btn');
const popoutBtn = document.getElementById('popout-btn');
const ttsControls = document.getElementById('tts-controls');
const ttsStatusText = document.getElementById('tts-status-text');
const ttsPauseBtn = document.getElementById('tts-pause-btn');
const ttsResumeBtn = document.getElementById('tts-resume-btn');
const ttsStopBtn = document.getElementById('tts-stop-btn');

// Initialize the side panel
async function initialize() {
  console.log('Side panel initialized');

  // Get video info from the current tab
  await loadVideoInfo();

  // Set up event listeners
  setupEventListeners();
}

// Load video information from the YouTube page
async function loadVideoInfo() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Side panel: Current tab:', tab);

    if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
      console.log('Side panel: Not on YouTube watch page');
      showError('Please navigate to a YouTube video page');
      return;
    }

    console.log('Side panel: Sending message to content script on tab', tab.id);

    // Send message to content script to get video info
    chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_INFO' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Side panel: Error getting video info:', chrome.runtime.lastError);
        showError('Unable to load video information. Please refresh the page.');
        return;
      }

      console.log('Side panel: Received response:', response);

      if (response && response.success) {
        currentVideoInfo = response.data;
        updateVideoDisplay();
      } else {
        console.log('Side panel: Response was not successful');
        showError('Failed to load video information');
      }
    });
  } catch (error) {
    console.error('Side panel: Error loading video info:', error);
    showError('An error occurred while loading video information');
  }
}

// Update the video information display
function updateVideoDisplay() {
  if (currentVideoInfo) {
    videoTitleElement.textContent = currentVideoInfo.title;
    videoChannelElement.textContent = currentVideoInfo.channel;
    hideError();
  }
}

// Set up event listeners
function setupEventListeners() {
  // Level button listeners
  levelButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      levelButtons.forEach(btn => btn.classList.remove('active'));

      // Add active class to clicked button
      button.classList.add('active');

      // Update selected level
      selectedLevel = button.dataset.level;
      selectedLevelElement.textContent = `Selected: ${capitalizeFirst(selectedLevel)}`;
      selectedLevelElement.classList.add('has-selection');

      // Enable analyze button if video info is loaded
      if (currentVideoInfo) {
        analyzeBtn.disabled = false;
      }
    });
  });

  // Analyze button listener
  analyzeBtn.addEventListener('click', handleAnalyze);

  // Read Aloud button listener
  if (readAloudBtn) {
    readAloudBtn.addEventListener('click', handleReadAloud);
  }

  // Pop-out button listener
  if (popoutBtn) {
    popoutBtn.addEventListener('click', handlePopout);
  }

  // TTS control listeners
  if (ttsPauseBtn) {
    ttsPauseBtn.addEventListener('click', () => {
      if (window.speechSynthesis && isSpeaking) {
        window.speechSynthesis.pause();
        ttsPauseBtn.style.display = 'none';
        ttsResumeBtn.style.display = 'inline-block';
        ttsStatusText.textContent = 'Paused';
      }
    });
  }

  if (ttsResumeBtn) {
    ttsResumeBtn.addEventListener('click', () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
        ttsResumeBtn.style.display = 'none';
        ttsPauseBtn.style.display = 'inline-block';
        ttsStatusText.textContent = 'Reading...';
      }
    });
  }

  if (ttsStopBtn) {
    ttsStopBtn.addEventListener('click', stopReading);
  }
}

// Handle analyze button click
async function handleAnalyze() {
  if (!currentVideoInfo || !selectedLevel) {
    showError('Please select a level and ensure video information is loaded');
    return;
  }

  // Check if Supabase URL is configured
  if (!CONFIG.SUPABASE_FUNCTION_URL || CONFIG.SUPABASE_FUNCTION_URL === 'YOUR_SUPABASE_FUNCTION_URL_HERE') {
    showError('Please configure your Supabase Edge Function URL in config.js');
    return;
  }

  // Track if user manually resumed video
  let userResumed = false;

  try {
    // 1. PAUSE VIDEO IMMEDIATELY
    await pauseVideo();
    console.log('Video paused for analysis');

    // 2. SHOW PROGRESS UI
    hideError();
    hideCommentary();
    hideLoading();
    showProgress();

    // 3. SET UP MANUAL RESUME HANDLER
    const handleManualResume = async () => {
      userResumed = true;
      await playVideo();
      manualResumeBtn.classList.add('hidden');
      updateProgressInfo('Analysis continuing in background...', '');
      console.log('User manually resumed video');
    };

    manualResumeBtn.classList.remove('hidden');
    manualResumeBtn.addEventListener('click', handleManualResume, { once: true });

    console.log('Analyzing video:', currentVideoInfo);
    console.log('Level:', selectedLevel);

    // 4. GET YOUTUBE COOKIES FOR AUDIO DOWNLOAD
    updateProgressInfo('🔐 Getting cookies for audio download...', 'Estimated time: ~20-30 seconds');
    youtubeCookies = await getYouTubeCookies();

    if (!youtubeCookies) {
      throw new Error('Failed to get YouTube cookies. Please make sure you are logged into YouTube.');
    }

    console.log('Successfully captured YouTube cookies');

    // 5. START ANALYSIS - Update stage to downloading
    updateStage('download', 'in-progress', 'Downloading audio...');

    // 6. Call Supabase Edge Function with cookies
    updateStage('analysis', 'in-progress', 'Analyzing structure...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

    const response = await fetch(CONFIG.SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: currentVideoInfo.videoId,
        videoTitle: currentVideoInfo.title,
        channelName: currentVideoInfo.channel,
        level: selectedLevel,
        cookies: youtubeCookies,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    updateStage('analysis', 'completed', 'Analysis complete');

    // 7. Commentary generation stage
    updateStage('commentary', 'in-progress', 'Generating commentary...');

    const data = await response.json();

    if (data.success && data.commentary) {
      updateStage('commentary', 'completed', 'Commentary generated');

      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      hideProgress();
      showCommentary(formatCommentary(data.commentary, data));

      // Clear cookies from memory (privacy)
      youtubeCookies = null;
      console.log('Cleared cookies from memory');

      // 8. AUTO-RESUME VIDEO (if user hasn't manually resumed)
      if (!userResumed) {
        await playVideo();
        console.log('Auto-resumed video after analysis complete');
      }
    } else {
      throw new Error('Invalid response from server');
    }

  } catch (error) {
    hideProgress();
    console.error('Error analyzing video:', error);

    // Clear cookies from memory (privacy)
    youtubeCookies = null;

    // ALWAYS RESUME VIDEO ON ERROR
    if (!userResumed) {
      await playVideo();
      console.log('Auto-resumed video after error');
    }

    if (error.name === 'AbortError') {
      showError('Request timed out. The analysis is taking longer than expected. Please try again.');
    } else if (error.message.includes('Failed to fetch')) {
      showError('Unable to connect to the server. Please check your Supabase configuration and internet connection.');
    } else {
      showError(`Error: ${error.message}`);
    }
  }
}

// Format commentary from API response
function formatCommentary(commentary, data) {
  // Check if commentary contains structure overview
  const parts = commentary.split('DETAILED ANALYSIS');

  let structureHtml = '';
  let detailedHtml = '';

  if (parts.length === 2) {
    // Has structure overview
    const structureOverview = parts[0].trim();
    const detailedAnalysis = parts[1].trim();

    // Format structure overview (keep as monospace text)
    structureHtml = `<div class="structure-overview">${escapeHtml(structureOverview)}</div>`;

    // Parse timestamps from detailed analysis
    timestampedSections = parseTimestamps(detailedAnalysis);

    // Convert detailed analysis to HTML with timestamp data
    detailedHtml = markdownToHtmlWithTimestamps(detailedAnalysis);
  } else {
    // No structure overview, fallback to old behavior
    timestampedSections = parseTimestamps(commentary);
    detailedHtml = markdownToHtmlWithTimestamps(commentary);
  }

  // Show sync controls if we have timestamps
  if (timestampedSections.length > 0) {
    syncControls.style.display = 'block';
    setupSyncListeners();
  }

  return `
    <div class="commentary-header" style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--border-color);">
      <div style="margin-bottom: 8px;">
        <strong style="color: var(--primary-color);">🎵 AI-Generated Music Commentary</strong>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        <div>Level: <strong>${capitalizeFirst(data.level)}</strong></div>
        <div>Generated: ${new Date(data.generatedAt).toLocaleString()}</div>
        <div style="color: var(--success-color);">✓ ${timestampedSections.length} sections detected</div>
      </div>
    </div>

    ${structureHtml}

    <div class="commentary-body" id="commentary-body">
      ${detailedHtml}
    </div>
  `;
}

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
  let html = markdown;

  // Convert headers (## Header -> <h2>Header</h2>)
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-top: 20px; margin-bottom: 12px;">$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-top: 16px; margin-bottom: 10px;">$1</h3>');

  // Convert bold (**text** -> <strong>text</strong>)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: var(--text-primary);">$1</strong>');

  // Convert italic (*text* -> <em>text</em>)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert bullet points (- item or * item -> <li>item</li>)
  html = html.replace(/^[\-\*] (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 8px; line-height: 1.6;">$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/gim, '<ul style="margin: 12px 0; padding-left: 0; list-style-position: inside;">$&</ul>');

  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    if (p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<ul') || p.startsWith('<li')) {
      return p;
    }
    return `<p style="margin-bottom: 12px; line-height: 1.6; color: var(--text-primary);">${p.trim()}</p>`;
  }).join('');

  return html;
}

// UI state management functions
function showLoading() {
  loadingSection.style.display = 'block';
}

function hideLoading() {
  loadingSection.style.display = 'none';
}

function showProgress() {
  progressSection.style.display = 'block';
  // Reset all stages to waiting
  resetStages();
}

function hideProgress() {
  progressSection.style.display = 'none';
}

function resetStages() {
  const stages = [stageDownload, stageAnalysis, stageCommentary];
  stages.forEach(stage => {
    stage.className = 'stage waiting';
    const status = stage.querySelector('.stage-status');
    if (status) status.textContent = 'Waiting...';
  });
}

function updateStage(stageName, state, statusText) {
  let stageElement;
  switch(stageName) {
    case 'download':
      stageElement = stageDownload;
      break;
    case 'analysis':
      stageElement = stageAnalysis;
      break;
    case 'commentary':
      stageElement = stageCommentary;
      break;
    default:
      return;
  }

  // Update stage class
  stageElement.className = `stage ${state}`;

  // Update status text
  const statusElement = stageElement.querySelector('.stage-status');
  if (statusElement) {
    statusElement.textContent = statusText;
  }

  console.log(`Stage ${stageName}: ${state} - ${statusText}`);
}

function updateProgressInfo(pauseText, timeText) {
  const pauseNotice = document.querySelector('.pause-notice');
  const timeEstimate = document.querySelector('.time-estimate');

  if (pauseNotice && pauseText !== undefined) {
    pauseNotice.textContent = pauseText;
  }

  if (timeEstimate && timeText !== undefined) {
    timeEstimate.textContent = timeText;
  }
}

function showCommentary(content) {
  // Store commentary for TTS and pop-out
  currentCommentaryText = content;

  commentaryContent.innerHTML = content;
  commentarySection.style.display = 'block';
}

function hideCommentary() {
  commentarySection.style.display = 'none';
}

function showError(message) {
  errorMessage.textContent = message;
  errorSection.style.display = 'block';
}

function hideError() {
  errorSection.style.display = 'none';
}

// Parse timestamps from commentary
function parseTimestamps(commentary) {
  const sections = [];
  // Match pattern like: ## [0:15] Verse 1 or ## [1:23] Chorus
  const timestampRegex = /##\s*\[(\d+):(\d+)\]\s*(.+)/g;

  let match;
  while ((match = timestampRegex.exec(commentary)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const timeInSeconds = minutes * 60 + seconds;
    const sectionName = match[3].trim();

    sections.push({
      time: timeInSeconds,
      name: sectionName,
      timestamp: `${match[1]}:${match[2]}`
    });
  }

  return sections.sort((a, b) => a.time - b.time);
}

// Convert markdown to HTML with timestamp data attributes
function markdownToHtmlWithTimestamps(markdown) {
  let html = markdown;
  let sectionIndex = 0;

  // Convert timestamped headers with data attributes
  html = html.replace(/^## \[(\d+):(\d+)\] (.+$)/gim, (match, min, sec, title) => {
    const dataAttr = `data-section="${sectionIndex}" data-time="${parseInt(min) * 60 + parseInt(sec)}"`;
    sectionIndex++;
    return `<h2 class="timestamp-section" ${dataAttr} style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-top: 20px; margin-bottom: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; transition: all 0.3s;">[${min}:${sec}] ${title}</h2>`;
  });

  // Convert other headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-top: 16px; margin-bottom: 10px;">$1</h3>');

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: var(--text-primary);">$1</strong>');

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert bullet points
  html = html.replace(/^[\-\*] (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 8px; line-height: 1.6;">$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/gim, '<ul style="margin: 12px 0; padding-left: 0; list-style-position: inside;">$&</ul>');

  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    if (p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<ul') || p.startsWith('<li')) {
      return p;
    }
    return `<p style="margin-bottom: 12px; line-height: 1.6; color: var(--text-primary);">${p.trim()}</p>`;
  }).join('');

  return html;
}

// Setup sync event listeners
function setupSyncListeners() {
  // Sync toggle listener
  syncEnabled.addEventListener('change', (e) => {
    if (e.target.checked) {
      startVideoSync();
    } else {
      stopVideoSync();
    }
  });

  // Resume button listener
  resumeBtn.addEventListener('click', () => {
    playVideo();
    resumeBtn.style.display = 'none';
    isPaused = false;

    // Pause TTS if it's speaking
    if (isSpeaking && window.speechSynthesis) {
      window.speechSynthesis.pause();
      if (ttsPauseBtn && ttsResumeBtn) {
        ttsPauseBtn.style.display = 'none';
        ttsResumeBtn.style.display = 'inline-block';
      }
      if (ttsStatusText) {
        ttsStatusText.textContent = 'Paused (video resumed)';
      }
    }
  });

  // Click on timestamp sections to jump to that time
  document.querySelectorAll('.timestamp-section').forEach(section => {
    section.addEventListener('click', () => {
      const time = parseInt(section.dataset.time);
      seekVideoTo(time);
    });
  });

  // Start sync if enabled by default
  if (syncEnabled.checked) {
    startVideoSync();
  }
}

// Start video sync tracking
function startVideoSync() {
  if (videoTimeInterval) return; // Already running

  console.log('Starting video sync...');
  currentSectionIndex = -1;

  // Poll current video time every 500ms
  videoTimeInterval = setInterval(async () => {
    const currentTime = await getCurrentVideoTime();
    if (currentTime !== null) {
      checkAndUpdateSection(currentTime);
    }
  }, 500);
}

// Stop video sync tracking
function stopVideoSync() {
  if (videoTimeInterval) {
    clearInterval(videoTimeInterval);
    videoTimeInterval = null;
  }

  // Clear all highlights
  document.querySelectorAll('.timestamp-section').forEach(section => {
    section.style.background = 'var(--bg-secondary)';
    section.style.borderLeft = 'none';
  });

  currentSectionIndex = -1;
  console.log('Video sync stopped');
}

// Check and update current section
function checkAndUpdateSection(currentTime) {
  // Find which section we're in
  let newSectionIndex = -1;
  for (let i = timestampedSections.length - 1; i >= 0; i--) {
    if (currentTime >= timestampedSections[i].time) {
      newSectionIndex = i;
      break;
    }
  }

  // Section changed
  if (newSectionIndex !== currentSectionIndex && newSectionIndex >= 0) {
    const previousIndex = currentSectionIndex;
    currentSectionIndex = newSectionIndex;

    // Unhighlight previous section
    if (previousIndex >= 0) {
      const prevSection = document.querySelector(`[data-section="${previousIndex}"]`);
      if (prevSection) {
        prevSection.style.background = 'var(--bg-secondary)';
        prevSection.style.borderLeft = 'none';
      }
    }

    // Highlight current section
    const currentSection = document.querySelector(`[data-section="${currentSectionIndex}"]`);
    if (currentSection) {
      currentSection.style.background = 'var(--primary-light)';
      currentSection.style.borderLeft = '4px solid var(--primary-color)';

      // Scroll into view
      currentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Check sync mode
    const syncMode = document.querySelector('input[name="sync-mode"]:checked').value;
    if (syncMode === 'pause' && !isPaused) {
      // Auto-pause mode
      pauseVideo();
      resumeBtn.style.display = 'block';
      isPaused = true;

      // Auto-read section if enabled
      if (autoReadEnabled && autoReadEnabled.checked) {
        // Stop any existing speech first
        if (isSpeaking) {
          stopReading();
        }
        // Read the current section
        setTimeout(() => {
          readCurrentSection(currentSectionIndex);
        }, 500); // Small delay to let pause happen smoothly
      }
    }
  }
}

// Get current video time from YouTube
async function getCurrentVideoTime() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_TIME' });
    return response?.time || null;
  } catch (error) {
    console.error('Error getting video time:', error);
    return null;
  }
}

// Pause YouTube video
async function pauseVideo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'PAUSE_VIDEO' });
  } catch (error) {
    console.error('Error pausing video:', error);
  }
}

// Play YouTube video
async function playVideo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'PLAY_VIDEO' });
  } catch (error) {
    console.error('Error playing video:', error);
  }
}

// Seek video to specific time
async function seekVideoTo(time) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'SEEK_VIDEO', time });
  } catch (error) {
    console.error('Error seeking video:', error);
  }
}

// Text-to-Speech Functions
function handleReadAloud() {
  if (!currentCommentaryText) {
    console.warn('No commentary to read');
    return;
  }

  // Check if Web Speech API is supported
  if (!('speechSynthesis' in window)) {
    showError('Text-to-speech is not supported in your browser');
    return;
  }

  // Stop any existing speech
  if (isSpeaking) {
    stopReading();
    return;
  }

  // Extract plain text from commentary (remove markdown and HTML)
  const textToRead = extractTextFromCommentary(currentCommentaryText);

  // Create utterance
  ttsUtterance = new SpeechSynthesisUtterance(textToRead);

  // Configure voice (prefer English voices)
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
  if (englishVoice) {
    ttsUtterance.voice = englishVoice;
  }

  // Configure speech parameters
  ttsUtterance.rate = 0.9; // Slightly slower for better comprehension
  ttsUtterance.pitch = 1.0;
  ttsUtterance.volume = 1.0;

  // Event handlers
  ttsUtterance.onstart = () => {
    isSpeaking = true;
    ttsControls.style.display = 'flex';
    ttsPauseBtn.style.display = 'inline-block';
    ttsResumeBtn.style.display = 'none';
    ttsStatusText.textContent = 'Reading...';
    readAloudBtn.textContent = '⏹️ Stop Reading';
    console.log('Started reading commentary');
  };

  ttsUtterance.onend = () => {
    stopReading();
    console.log('Finished reading commentary');
  };

  ttsUtterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
    stopReading();
  };

  // Start speaking
  window.speechSynthesis.speak(ttsUtterance);
}

function stopReading() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  isSpeaking = false;
  ttsControls.style.display = 'none';
  ttsPauseBtn.style.display = 'inline-block';
  ttsResumeBtn.style.display = 'none';
  readAloudBtn.textContent = '🔊 Read Aloud';
  ttsUtterance = null;
}

function readCurrentSection(sectionIndex) {
  // Check if Web Speech API is supported
  if (!('speechSynthesis' in window)) {
    console.warn('Text-to-speech is not supported');
    return;
  }

  // Get the section element
  const sectionElement = document.querySelector(`[data-section="${sectionIndex}"]`);
  if (!sectionElement) {
    console.warn('Section element not found');
    return;
  }

  // Get the section title and content
  const sectionTitle = sectionElement.textContent || '';

  // Get all content until the next section
  let contentText = sectionTitle;
  let nextElement = sectionElement.nextElementSibling;

  while (nextElement && !nextElement.classList.contains('timestamp-section')) {
    const text = nextElement.textContent || '';
    if (text.trim()) {
      contentText += ' ' + text;
    }
    nextElement = nextElement.nextElementSibling;
  }

  // Clean up text
  contentText = contentText.replace(/\s+/g, ' ').trim();

  // Create utterance for this section only
  ttsUtterance = new SpeechSynthesisUtterance(contentText);

  // Configure voice
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
  if (englishVoice) {
    ttsUtterance.voice = englishVoice;
  }

  // Configure speech parameters
  ttsUtterance.rate = 0.9;
  ttsUtterance.pitch = 1.0;
  ttsUtterance.volume = 1.0;

  // Event handlers
  ttsUtterance.onstart = () => {
    isSpeaking = true;
    ttsControls.style.display = 'flex';
    ttsPauseBtn.style.display = 'inline-block';
    ttsResumeBtn.style.display = 'none';
    ttsStatusText.textContent = 'Reading current section...';
    readAloudBtn.textContent = '⏹️ Stop Reading';
    console.log('Started reading section:', sectionIndex);
  };

  ttsUtterance.onend = () => {
    stopReading();
    console.log('Finished reading section');
  };

  ttsUtterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
    stopReading();
  };

  // Start speaking
  window.speechSynthesis.speak(ttsUtterance);
}

function extractTextFromCommentary(htmlContent) {
  // If it's already plain text, return it
  if (typeof htmlContent === 'string' && !htmlContent.includes('<')) {
    return htmlContent;
  }

  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;

  // Remove certain elements we don't want to read
  const elementsToRemove = temp.querySelectorAll('.commentary-header');
  elementsToRemove.forEach(el => el.remove());

  // Get text content - use innerText first as it preserves spacing better
  let text = temp.innerText || temp.textContent || '';

  // If we got very little text, try a different approach
  if (text.length < 50 && htmlContent.length > 100) {
    // Fallback: strip HTML tags manually
    text = htmlContent.replace(/<[^>]*>/g, ' ');
  }

  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Add pauses after section headings (indicated by timestamps)
  text = text.replace(/\[(\d+):(\d+)\]/g, '... $& ... ');

  console.log('TTS text length:', text.length, 'First 200 chars:', text.substring(0, 200));

  return text;
}

// Pop-out Window Functions
function handlePopout() {
  if (!currentCommentaryText || !currentVideoInfo) {
    console.warn('No commentary to display in pop-out');
    return;
  }

  // Create pop-out data object
  const popoutData = {
    videoTitle: currentVideoInfo.title,
    videoChannel: currentVideoInfo.channel,
    videoId: currentVideoInfo.videoId,
    level: selectedLevel,
    commentary: currentCommentaryText,
    timestamp: Date.now()
  };

  // Store data in sessionStorage for the pop-out window to access
  sessionStorage.setItem('musicCommentaryPopout', JSON.stringify(popoutData));

  // Calculate pop-out window size and position
  const width = 500;
  const height = 600;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;

  // Open pop-out window
  const popout = window.open(
    chrome.runtime.getURL('popout.html'),
    'musicCommentaryPopout',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (popout) {
    console.log('Opened pop-out window');

    // Close the side panel to reduce clutter
    // User can reopen it by clicking the extension icon if needed
    setTimeout(() => {
      window.close();
    }, 300); // Small delay to ensure pop-out opens first
  } else {
    showError('Failed to open pop-out window. Please allow pop-ups for this extension.');
  }
}

// Get YouTube cookies for audio download
async function getYouTubeCookies() {
  try {
    console.log('Getting YouTube cookies...');

    // Get all cookies from .youtube.com domain
    const cookies = await chrome.cookies.getAll({
      domain: '.youtube.com'
    });

    console.log(`Found ${cookies.length} YouTube cookies`);

    // Convert to simple object { name: value }
    const cookieDict = {};
    cookies.forEach(cookie => {
      cookieDict[cookie.name] = cookie.value;
    });

    return cookieDict;
  } catch (error) {
    console.error('Error getting YouTube cookies:', error);
    return null;
  }
}

// Utility functions
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for video changes from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_CHANGED') {
    currentVideoInfo = message.data;
    updateVideoDisplay();
    hideCommentary();
  }
});

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
