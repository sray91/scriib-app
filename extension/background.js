// LinkedIn Posts Sync Extension - Background Service Worker

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  console.log('LinkedIn Posts Sync Extension installed/updated');
  
  if (details.reason === 'install') {
    // First time installation
    console.log('Extension installed for the first time');
    
    // Set default settings
    chrome.storage.sync.set({
      apiEndpoint: 'http://localhost:3000',
      autoSync: false,
      maxPosts: 30
    });
    
    // Open welcome page or instructions
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVersion') {
    sendResponse({ version: chrome.runtime.getManifest().version });
  } else if (request.action === 'openTab') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  } else if (request.action === 'getSettings') {
    chrome.storage.sync.get(['userToken', 'apiEndpoint', 'autoSync'], (result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle tab updates to detect LinkedIn visits
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com')) {
    // Could potentially inject content script or prepare for scraping
    console.log('LinkedIn tab detected:', tab.url);
  }
});

// Keep service worker active
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Minimal activity to keep service worker active
    console.log('Service worker keepalive');
  }
});

// Handle extension icon click (optional fallback)
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('linkedin.com')) {
    // Extension popup should handle this, but this is a fallback
    console.log('Extension icon clicked on LinkedIn');
  } else {
    // Redirect to LinkedIn if not already there
    chrome.tabs.create({ url: 'https://www.linkedin.com' });
  }
}); 