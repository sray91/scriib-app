# LinkedIn Posts Sync Extension

A Chrome/Firefox browser extension that scrapes your LinkedIn posts directly from the DOM and syncs them to your CreatorTask app, bypassing LinkedIn's API geographic restrictions.

## 🚀 Features

- **Direct DOM Scraping** - Extracts post data directly from LinkedIn's web interface
- **Real-time Sync** - Sends scraped data securely to your CreatorTask app
- **Engagement Metrics** - Captures likes, comments, shares, and views
- **Auto-scroll Support** - Automatically loads more posts while scanning
- **Secure Authentication** - Uses tokens to authenticate with your app
- **Geographic Independence** - Works worldwide, bypassing API restrictions

## 📦 Installation

### Chrome Installation

1. **Download Extension Files**
   ```bash
   # Copy the entire extension/ folder to your local machine
   cp -r extension/ ~/linkedin-extension/
   ```

2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `extension/` folder
   - Extension should appear in your extensions list

4. **Pin Extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "LinkedIn Posts Sync" for easy access

### Firefox Installation

1. **Open Firefox Add-ons**
   - Go to `about:debugging`
   - Click "This Firefox"

2. **Load Extension**
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from the `extension/` folder

## ⚙️ Setup

### 1. Get Authentication Token

1. **Open CreatorTask** in your browser
2. **Sign in** to your account
3. **Go to Settings** → Extensions tab
4. **Generate Token** for browser extension
5. **Copy the token** (keep it secure!)

### 2. Configure Extension

1. **Click extension icon** in browser toolbar
2. **Select API Endpoint:**
   - `localhost:3000` for local development
   - `app.creatortask.com` or `app.creatortask.app` for production
3. **Paste your token** in the Authentication Token field
4. **Wait for green checkmark** confirming connection

## 🎯 Usage

### Basic Sync

1. **Visit LinkedIn.com** and navigate to your posts
   - Go to your profile
   - Click "Posts" or "Activity" tab

2. **Open Extension** (click icon in toolbar)

3. **Start Sync**
   - Click "🚀 Start Sync"
   - Extension will scan visible posts
   - Progress shown in real-time

4. **View Results**
   - Synced posts appear in CreatorTask
   - Check the "View Synced Posts" link

### Advanced Options

- **Auto-scroll**: Enable to automatically load more posts
- **Max Posts**: Set limit (20-100 posts)
- **Auto-sync**: Automatically sync when browsing posts

## 🔧 Troubleshooting

### Extension Not Working

- **Check if you're on LinkedIn.com**
- **Refresh the page** and try again
- **Verify token** is correct and not expired
- **Check browser console** for error messages

### No Posts Found

- **Make sure posts are visible** on the page
- **Try scrolling down** to load more posts
- **Check if posts have content** (empty posts are skipped)
- **LinkedIn may have changed their DOM** - extension might need updates

### Connection Issues

- **Verify API endpoint** matches your CreatorTask instance
- **Check internet connection**
- **Confirm CreatorTask app is running**
- **Try regenerating token** in CreatorTask settings

## 🔒 Security

- **Data stays secure** - only sent to your CreatorTask instance
- **Tokens are encrypted** and stored locally
- **No data sent to third parties**
- **Respects LinkedIn's rate limits**

## 🛠 Development

### File Structure
```
extension/
├── manifest.json          # Extension configuration
├── content.js            # LinkedIn DOM scraping logic
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── popup.css             # Popup styles
├── background.js         # Background service worker
├── content.css           # Injected styles
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Updating Selectors

LinkedIn may change their DOM structure. Update selectors in `content.js`:

```javascript
// Update these selectors if LinkedIn changes their structure
const postSelectors = [
  'div[data-urn*="urn:li:activity"]',  // Main posts
  'article[data-urn*="activity"]',     // Profile posts
  '.feed-shared-update-v2',            // Alternative
];
```

### API Integration

Extension sends data to: `/api/linkedin/posts/sync/extension`

Expected payload:
```json
{
  "posts": [...],
  "source": "extension",
  "timestamp": "2025-01-XX..."
}
```

## 📊 Data Captured

For each LinkedIn post:
- **Content** - Full post text
- **Published Date** - When post was created
- **Engagement** - Likes, comments, shares
- **Media URLs** - Images/videos if present
- **Post Type** - Text, image, video, article
- **Post URL** - Direct link to post
- **Metadata** - Scraping timestamp, browser info

## 🤝 Support

- **Issues**: Report bugs in CreatorTask
- **Feature Requests**: Suggest improvements
- **Updates**: Extension auto-notifies of updates

## 📜 Legal

- **Respect LinkedIn's Terms of Service**
- **Only scrape your own posts**
- **Use responsibly** and avoid excessive requests
- **Data privacy** - extension only accesses visible content

---

**Enjoy effortless LinkedIn post syncing! 🚀** 