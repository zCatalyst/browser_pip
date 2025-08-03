# Browser PiP Extension

A Chrome/Edge browser extension that allows you to capture any webpage content in Picture-in-Picture mode with customizable area selection.

## Features

- **Universal Web Capture**: Capture any webpage content in real-time
- **Area Selection**: Select specific content regions to focus on
- **Picture-in-Picture**: Native browser PiP with full controls
- **Customizable Settings**: Adjust capture quality and preview settings
- **Live Preview**: Test your settings before activating PiP
- **Low Resource Usage**: Optimized for minimal CPU and memory impact

## Use Cases

### 📊 Financial & Trading
- **TradingView charts** - Monitor stock/crypto charts
- **Yahoo Finance** - Track stock tickers
- **Coinbase/Binance** - Watch crypto prices
- **Bloomberg Terminal** - Monitor market data

### 🎮 Gaming & Entertainment  
- **Twitch streams** - Watch while browsing
- **YouTube videos** - Keep playing while working
- **Discord calls** - See who's talking
- **Spotify/Apple Music** - Visualizer while working

### 💼 Productivity & Work
- **Slack/Discord** - Monitor channels while working
- **Email notifications** - Keep inbox visible
- **Calendar apps** - Track meetings/schedule
- **Project management** - Jira, Trello, Asana boards

### 📈 Analytics & Monitoring
- **Google Analytics** - Real-time data
- **Server monitoring** - Dashboard tracking
- **Social media** - Engagement metrics
- **Website performance** - Uptime monitoring

## Installation

1. Download or clone this repository
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The TradingView PiP icon should appear in your extensions toolbar

## How to Use

1. **Navigate to any webpage** in any browser tab
2. **Click the extension icon** in your toolbar
3. **Select Content Area**: Click "Select Content Area" and drag to select the region you want to monitor
4. **Open Settings**: Click "Settings & Preview" to open the settings page
5. **Start Preview**: Click "Start Preview" and select the tab to capture
6. **Use PiP**: Click "📺 PiP" to open browser's native Picture-in-Picture window

## Settings & Configuration

Access the settings page by:
- Clicking "Settings & Preview" in the extension popup
- Right-clicking the extension icon and selecting "Options"

### Available Settings

**Overlay Window**:
- Default window size and position
- Opacity control
- Always-on-top behavior

**Capture Quality**:
- Video resolution (480p, 720p, 1080p)
- Frame rate (15, 30, 60 FPS)
- Auto-restart on connection failure

**Area Selection**:
- Crop specific chart regions
- Preview selected areas
- Clear or reselect areas

## Keyboard Shortcuts

- **Esc**: Cancel area selection
- **Enter**: Confirm area selection (when in selection mode)

## Troubleshooting

**Extension not capturing**:
- Ensure you're on a TradingView page
- Refresh the TradingView tab and try again
- Check that screen capture permissions are granted

**Poor performance**:
- Lower the video quality in settings
- Reduce frame rate to 15-30 FPS
- Close unnecessary browser tabs

**Window positioning issues**:
- Reset window position in settings
- Manually drag the overlay window to desired location

## Technical Details

**Permissions Required**:
- `activeTab`: Access current tab for capture
- `tabCapture`: Capture tab video stream
- `storage`: Save user preferences
- `windows`: Create floating overlay windows

**Supported Browsers**:
- Chrome 88+
- Edge 88+
- Other Chromium-based browsers

## Privacy & Security

- No data is sent to external servers
- All capture happens locally in your browser
- Settings are stored locally using Chrome's storage API
- Extension only activates on TradingView domains

## Development

**File Structure**:
```
├── manifest.json          # Extension configuration
├── background.js          # Service worker for tab capture
├── popup.html/js          # Extension popup interface
├── content.js/css         # TradingView page integration
├── overlay.html/js        # Floating window interface
├── settings.html/js       # Settings and preview page
└── icons/                 # Extension icons
```

**Key Technologies**:
- Chrome Extensions Manifest V3
- MediaDevices.getDisplayMedia() API
- Canvas 2D API for video processing
- Chrome Storage API for preferences

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

## License

MIT License - feel free to modify and distribute.

---

**Note**: This extension is not affiliated with TradingView. It's an independent tool to enhance your trading workflow.