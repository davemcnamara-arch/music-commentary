// Content script for YouTube pages

// Function to extract video information from YouTube page
function getVideoInfo() {
  const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
                     document.querySelector('h1.title')?.textContent?.trim() ||
                     'Video title not found';

  const channelName = document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
                      document.querySelector('#channel-name a')?.textContent?.trim() ||
                      'Channel not found';

  const videoId = new URLSearchParams(window.location.search).get('v') || '';

  return {
    title: videoTitle,
    channel: channelName,
    videoId: videoId,
    url: window.location.href
  };
}

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_VIDEO_INFO') {
    const videoInfo = getVideoInfo();
    sendResponse({ success: true, data: videoInfo });
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
