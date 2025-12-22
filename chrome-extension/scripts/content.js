// Content script for YouTube pages
console.log('Music Commentary: Content script loaded');

// Function to extract video information from YouTube page
function getVideoInfo() {
  console.log('Music Commentary: Getting video info...');

  const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
                     document.querySelector('h1.title')?.textContent?.trim() ||
                     'Video title not found';

  const channelName = document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
                      document.querySelector('#channel-name a')?.textContent?.trim() ||
                      'Channel not found';

  const videoId = new URLSearchParams(window.location.search).get('v') || '';

  console.log('Music Commentary: Video info extracted:', { videoTitle, channelName, videoId });

  return {
    title: videoTitle,
    channel: channelName,
    videoId: videoId,
    url: window.location.href
  };
}

// Get YouTube video player
function getYouTubePlayer() {
  return document.querySelector('video');
}

// Get current video time
function getCurrentTime() {
  const player = getYouTubePlayer();
  return player ? player.currentTime : null;
}

// Pause video
function pauseVideo() {
  const player = getYouTubePlayer();
  if (player && !player.paused) {
    player.pause();
    console.log('Music Commentary: Video paused');
  }
}

// Play video
function playVideo() {
  const player = getYouTubePlayer();
  if (player && player.paused) {
    player.play();
    console.log('Music Commentary: Video playing');
  }
}

// Seek to specific time
function seekTo(time) {
  const player = getYouTubePlayer();
  if (player) {
    player.currentTime = time;
    console.log(`Music Commentary: Seeked to ${time}s`);
  }
}

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Music Commentary: Received message:', message);

  if (message.type === 'GET_VIDEO_INFO') {
    const videoInfo = getVideoInfo();
    console.log('Music Commentary: Sending response:', videoInfo);
    sendResponse({ success: true, data: videoInfo });
  }
  else if (message.type === 'GET_VIDEO_TIME') {
    const time = getCurrentTime();
    sendResponse({ time });
  }
  else if (message.type === 'PAUSE_VIDEO') {
    pauseVideo();
    sendResponse({ success: true });
  }
  else if (message.type === 'PLAY_VIDEO') {
    playVideo();
    sendResponse({ success: true });
  }
  else if (message.type === 'SEEK_VIDEO') {
    seekTo(message.time);
    sendResponse({ success: true });
  }

  return true;
});

// Notify when video changes (for YouTube's SPA navigation)
let currentVideoId = new URLSearchParams(window.location.search).get('v');

const observer = new MutationObserver(() => {
  const newVideoId = new URLSearchParams(window.location.search).get('v');
  if (newVideoId && newVideoId !== currentVideoId) {
    currentVideoId = newVideoId;
    // Video changed, send update if side panel is open
    chrome.runtime.sendMessage({
      type: 'VIDEO_CHANGED',
      data: getVideoInfo()
    }).catch(() => {
      // Side panel might not be open, ignore error
    });
  }
});

// Start observing for URL changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});
