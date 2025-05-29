# Chrome Extension Integration Setup

## 🎯 Overview

Your Chrome extension integrates directly with your existing Next.js app using **dynamic configuration**. The extension fetches its configuration (like LinkedIn Client ID) from your secure API, so you never need to hardcode sensitive values.

## 🔒 Security Approach

✅ **What's Safe**: Your LinkedIn Client ID, API URL, and OAuth scopes are public by design  
✅ **What's Secure**: Your LinkedIn Client Secret stays server-side only  
✅ **Dynamic Config**: Extension fetches public config from your API at runtime  

## 📋 What's Been Added

### **New API Endpoints:**
- `GET /api/chrome-extension/config` - Serves public configuration
- `POST /api/chrome-extension/linkedin/token-exchange` - Exchanges OAuth code for token
- `GET /api/chrome-extension/linkedin/profile` - Fetches LinkedIn profile

### **CORS Configuration:**
- Added Chrome extension support in `next.config.js`
- Allows requests from any Chrome extension origin

### **Integration Code:**
- Complete Chrome extension OAuth class with dynamic config in `chrome-extension-integration.js`

## 🚀 Setup Steps

### **1. Update Configuration**

In `chrome-extension-integration.js`, you only need to update ONE line:

```javascript
// Base URL for your API (this is the only thing you need to hardcode)
const API_BASE_URL = 'https://your-actual-domain.com'; // Update this to your deployed app
```

For local development, use:
```javascript
const API_BASE_URL = 'http://localhost:3000';
```

### **2. Configure Your Chrome Extension**

In your Chrome extension's `manifest.json`:

```json
{
  "name": "CreatorTask LinkedIn Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "storage",
    "identity",
    "activeTab"
  ],
  "host_permissions": [
    "https://your-actual-domain.com/*",
    "https://www.linkedin.com/*",
    "https://api.linkedin.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/*"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

### **3. Create Chrome Extension Files**

**popup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 300px; padding: 20px; font-family: Arial, sans-serif; }
    button { width: 100%; padding: 10px; margin: 5px 0; border: none; border-radius: 4px; cursor: pointer; }
    .login-btn { background: #0077b5; color: white; }
    .logout-btn { background: #dc3545; color: white; }
    .profile { display: none; }
    .loading { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div id="login-section">
    <h3>CreatorTask LinkedIn</h3>
    <button id="login-btn" class="login-btn">Connect LinkedIn Account</button>
  </div>
  
  <div id="profile-section" class="profile">
    <h3>✅ Connected</h3>
    <div id="profile-info"></div>
    <button id="logout-btn" class="logout-btn">Disconnect</button>
  </div>
  
  <div id="loading" class="loading" style="display: none;">Loading...</div>
  
  <script src="chrome-extension-integration.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js:**
```javascript
// Initialize OAuth service
const linkedInAuth = new LinkedInOAuth();

// DOM elements
const loginSection = document.getElementById('login-section');
const profileSection = document.getElementById('profile-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const profileInfo = document.getElementById('profile-info');
const loading = document.getElementById('loading');

// Check auth status on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
});

// Login button handler
loginBtn.addEventListener('click', async () => {
  try {
    showLoading('Connecting to LinkedIn...');
    
    const result = await linkedInAuth.startOAuthFlow();
    await updateUI();
    
  } catch (error) {
    console.error('Login failed:', error);
    alert('LinkedIn login failed: ' + error.message);
  } finally {
    hideLoading();
  }
});

// Logout button handler
logoutBtn.addEventListener('click', async () => {
  try {
    showLoading('Disconnecting...');
    await linkedInAuth.logout();
    await updateUI();
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    hideLoading();
  }
});

// Update UI based on auth status
async function updateUI() {
  try {
    if (await linkedInAuth.isAuthenticated()) {
      const profile = await linkedInAuth.getUserProfile();
      
      loginSection.style.display = 'none';
      profileSection.style.display = 'block';
      
      profileInfo.innerHTML = `
        <p><strong>Name:</strong> ${profile.name || 'N/A'}</p>
        <p><strong>Email:</strong> ${profile.email || 'N/A'}</p>
        <p style="font-size: 12px; color: #666;">Ready to analyze LinkedIn!</p>
      `;
    } else {
      loginSection.style.display = 'block';
      profileSection.style.display = 'none';
    }
  } catch (error) {
    console.error('UI update failed:', error);
    profileInfo.innerHTML = '<p style="color: red;">Error loading profile</p>';
  }
}

async function checkAuthStatus() {
  showLoading('Checking authentication...');
  await updateUI();
  hideLoading();
}

function showLoading(message) {
  loading.textContent = message;
  loading.style.display = 'block';
  loginSection.style.display = 'none';
  profileSection.style.display = 'none';
}

function hideLoading() {
  loading.style.display = 'none';
}
```

**background.js:**
```javascript
// Service worker for background tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ CreatorTask LinkedIn Extension installed');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    // Handle auth checks from content scripts
    sendResponse({ status: 'received' });
  }
  
  if (request.action === 'getProfile') {
    // Handle profile requests
    chrome.storage.local.get('linkedin_profile', (result) => {
      sendResponse(result.linkedin_profile);
    });
    return true; // Keep message channel open
  }
});
```

**content.js (optional - for LinkedIn page analysis):**
```javascript
// Content script for LinkedIn pages
(async function() {
  console.log('🔄 CreatorTask: Analyzing LinkedIn page...');
  
  // Check if user is authenticated
  chrome.runtime.sendMessage({ action: 'getProfile' }, (profile) => {
    if (profile) {
      console.log('✅ User authenticated:', profile.name);
      // Add your LinkedIn page analysis code here
      initializePageAnalysis();
    } else {
      console.log('ℹ️ User not authenticated - some features may be limited');
    }
  });
  
  function initializePageAnalysis() {
    // Your LinkedIn page analysis logic
    console.log('🔍 Ready to analyze LinkedIn data');
    
    // Example: Detect profile pages
    if (window.location.pathname.includes('/in/')) {
      console.log('👤 LinkedIn profile page detected');
    }
    
    // Example: Detect company pages
    if (window.location.pathname.includes('/company/')) {
      console.log('🏢 LinkedIn company page detected');
    }
  }
})();
```

### **4. Test the Dynamic Configuration**

1. **Test the config endpoint:**
   ```bash
   curl http://localhost:3000/api/chrome-extension/config
   ```
   
   Should return:
   ```json
   {
     "LINKEDIN_CLIENT_ID": "your_actual_client_id",
     "REDIRECT_URI": "http://localhost:3000/auth/linkedin/callback",
     "SCOPES": "r_liteprofile r_emailaddress w_member_social r_member_social",
     "API_BASE_URL": "http://localhost:3000"
   }
   ```

2. **Load your Chrome extension:**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select your extension folder

3. **Test the OAuth flow:**
   - Click the extension icon
   - Click "Connect LinkedIn Account"
   - Complete the OAuth flow

## 🎯 Advantages of Dynamic Config

✅ **No hardcoded secrets** - Only your domain URL is in the extension  
✅ **Easy updates** - Change LinkedIn app settings without republishing extension  
✅ **Environment flexibility** - Automatically works for dev/staging/production  
✅ **Consistent with your backend** - All config managed in one place  

## 🔧 Advanced Usage

### **Environment Detection**

Your config endpoint automatically detects the environment:

- **Development**: `http://localhost:3000`
- **Production**: `https://your-deployed-domain.com`

### **Error Handling**

The extension gracefully handles config fetch failures:

```javascript
// If config fetch fails, user gets a clear error message
try {
  const config = await configManager.getConfig();
} catch (error) {
  console.error('Could not load extension configuration');
}
```

## 🔍 Testing Checklist

- [ ] ✅ Config endpoint returns valid data
- [ ] ✅ Chrome extension loads without errors  
- [ ] ✅ OAuth flow completes successfully
- [ ] ✅ User profile fetches correctly
- [ ] ✅ Token persistence works
- [ ] ✅ Logout clears stored data
- [ ] ✅ Works in both dev and production

## 🚨 Troubleshooting

### **Config Fetch Errors:**
- Check that your Next.js app is running
- Verify the API_BASE_URL in the extension matches your server
- Check browser console for CORS errors

### **OAuth Errors:**
- Verify LinkedIn app redirect URI matches exactly
- Check that environment variables are set correctly
- Ensure LinkedIn app has required permissions

## 🎉 You're Ready!

Your Chrome extension now dynamically fetches its configuration from your secure API, making it both secure and flexible. Only your domain URL needs to be updated in the extension code! 