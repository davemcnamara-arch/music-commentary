// Side panel script for Music Commentary Extension

// State management
let currentVideoInfo = null;
let selectedLevel = null;

// DOM elements
const videoTitleElement = document.getElementById('video-title');
const videoChannelElement = document.getElementById('video-channel');
const selectedLevelElement = document.getElementById('selected-level');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingSection = document.getElementById('loading-section');
const commentarySection = document.getElementById('commentary-section');
const commentaryContent = document.getElementById('commentary-content');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const levelButtons = document.querySelectorAll('.level-btn');

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

  // Show loading state
  showLoading();
  hideError();
  hideCommentary();

  console.log('Analyzing video:', currentVideoInfo);
  console.log('Level:', selectedLevel);

  try {
    // Call Supabase Edge Function
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
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.commentary) {
      hideLoading();
      showCommentary(formatCommentary(data.commentary, data));
    } else {
      throw new Error('Invalid response from server');
    }

  } catch (error) {
    hideLoading();
    console.error('Error analyzing video:', error);

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
  // Convert markdown to HTML
  const html = markdownToHtml(commentary);

  return `
    <div class="commentary-header" style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--border-color);">
      <div style="margin-bottom: 8px;">
        <strong style="color: var(--primary-color);">🎵 AI-Generated Music Commentary</strong>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        <div>Level: <strong>${capitalizeFirst(data.level)}</strong></div>
        <div>Generated: ${new Date(data.generatedAt).toLocaleString()}</div>
      </div>
    </div>

    <div class="commentary-body">
      ${html}
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

function showCommentary(content) {
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

// Utility functions
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
