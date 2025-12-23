// Pop-out window script for Music Commentary Extension

// Text-to-Speech state
let ttsUtterance = null;
let isSpeaking = false;
let commentaryText = '';

// DOM elements
const videoTitleElement = document.getElementById('popout-video-title');
const videoChannelElement = document.getElementById('popout-video-channel');
const levelElement = document.getElementById('popout-level');
const commentaryElement = document.getElementById('popout-commentary');
const readAloudBtn = document.getElementById('popout-read-aloud-btn');
const ttsControls = document.getElementById('popout-tts-controls');
const ttsStatusText = document.getElementById('popout-tts-status-text');
const ttsPauseBtn = document.getElementById('popout-tts-pause-btn');
const ttsResumeBtn = document.getElementById('popout-tts-resume-btn');
const ttsStopBtn = document.getElementById('popout-tts-stop-btn');

// Initialize pop-out window
function initialize() {
  console.log('Pop-out window initialized');

  // Load commentary data from sessionStorage
  const data = sessionStorage.getItem('musicCommentaryPopout');

  if (!data) {
    commentaryElement.innerHTML = '<p style="color: var(--error-color);">No commentary data found. Please reopen from the side panel.</p>';
    return;
  }

  try {
    const popoutData = JSON.parse(data);

    // Update header
    videoTitleElement.textContent = popoutData.videoTitle || 'Unknown Video';
    videoChannelElement.textContent = popoutData.videoChannel || 'Unknown Channel';
    levelElement.textContent = `Level: ${capitalizeFirst(popoutData.level || 'unknown')}`;

    // Display commentary
    commentaryText = popoutData.commentary || '';
    commentaryElement.innerHTML = commentaryText;

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Error parsing pop-out data:', error);
    commentaryElement.innerHTML = '<p style="color: var(--error-color);">Error loading commentary data.</p>';
  }
}

// Set up event listeners
function setupEventListeners() {
  // Read Aloud button
  if (readAloudBtn) {
    readAloudBtn.addEventListener('click', handleReadAloud);
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

// Text-to-Speech Functions
function handleReadAloud() {
  if (!commentaryText) {
    console.warn('No commentary to read');
    return;
  }

  // Check if Web Speech API is supported
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech is not supported in your browser');
    return;
  }

  // Stop any existing speech
  if (isSpeaking) {
    stopReading();
    return;
  }

  // Extract plain text from commentary (remove HTML)
  const textToRead = extractTextFromCommentary(commentaryText);

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

function extractTextFromCommentary(htmlContent) {
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;

  // Remove certain elements we don't want to read
  const elementsToRemove = temp.querySelectorAll('.commentary-header');
  elementsToRemove.forEach(el => el.remove());

  // Get text content
  let text = temp.textContent || temp.innerText || '';

  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Add pauses after section headings (indicated by timestamps)
  text = text.replace(/\[(\d+):(\d+)\]/g, '... $& ... ');

  return text;
}

// Utility function
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Clean up when window closes
window.addEventListener('beforeunload', () => {
  stopReading();
});
