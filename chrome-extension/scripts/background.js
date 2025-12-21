// Background service worker for Music Commentary Extension

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Check if we're on a YouTube watch page
  if (tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // Show a notification if not on a YouTube video page
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId: tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 2000);
  }
});

// Enable the side panel on YouTube watch pages
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.sidePanel.setOptions({
      tabId,
      enabled: true
    });
  }
});

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_INFO') {
    // Forward video info to side panel if needed
    console.log('Video info received:', message.data);
  }
  return true;
});
