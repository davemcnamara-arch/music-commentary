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

  // Show loading state
  showLoading();
  hideError();
  hideCommentary();

  console.log('Analyzing video:', currentVideoInfo);
  console.log('Level:', selectedLevel);

  // TODO: In Session 2, we'll integrate with Supabase Edge Functions + Gemini API
  // For now, show a placeholder response
  setTimeout(() => {
    hideLoading();
    showCommentary(generatePlaceholderCommentary());
  }, 2000);
}

// Generate placeholder commentary for testing
function generatePlaceholderCommentary() {
  const levelDescriptions = {
    novice: 'beginner-friendly explanations',
    intermediate: 'moderate technical depth',
    advanced: 'advanced music theory and production techniques'
  };

  return `
    <div style="margin-bottom: 16px;">
      <strong style="color: var(--primary-color);">🎵 Music Commentary Ready!</strong>
    </div>

    <div style="margin-bottom: 12px;">
      <strong>Video:</strong> ${currentVideoInfo.title}
    </div>

    <div style="margin-bottom: 12px;">
      <strong>Channel:</strong> ${currentVideoInfo.channel}
    </div>

    <div style="margin-bottom: 12px;">
      <strong>Level:</strong> ${capitalizeFirst(selectedLevel)} (${levelDescriptions[selectedLevel]})
    </div>

    <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px; border-left: 4px solid var(--primary-color);">
      <p style="margin-bottom: 12px;"><strong>📝 Placeholder Commentary</strong></p>
      <p style="color: var(--text-secondary); font-size: 13px;">
        This is a placeholder for the AI-generated commentary. In Session 2, we'll integrate:
      </p>
      <ul style="margin-top: 8px; margin-left: 20px; color: var(--text-secondary); font-size: 13px;">
        <li>Supabase Edge Functions</li>
        <li>Gemini API for video analysis</li>
        <li>Timestamped commentary sections</li>
        <li>Musical insights based on your selected level</li>
      </ul>
    </div>

    <div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px;">
      <p style="color: #16a34a; font-size: 13px;">
        ✅ Extension skeleton is working! Ready for backend integration.
      </p>
    </div>
  `;
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
