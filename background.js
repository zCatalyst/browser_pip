// Background service worker for TradingView PiP extension

let captureStream = null;
let overlayWindowId = null;

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('TradingView PiP extension installed');
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('tradingview.com')) {
    console.log('Not on TradingView page');
    return;
  }
  
  switch (command) {
    case 'toggle-pip':
      // Toggle PiP based on current state
      const result = await chrome.storage.local.get(['isCapturing']);
      if (result.isCapturing) {
        stopCapture();
      } else {
        // Check if area is selected
        const areaResult = await chrome.storage.local.get(['selectedArea']);
        if (areaResult.selectedArea) {
          // Start native PiP
          chrome.tabs.sendMessage(tab.id, { 
            action: 'startNativePiP',
            cropArea: areaResult.selectedArea
          });
        } else {
          // Notify user to select area first
          chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Please select a chart area first!' });
        }
      }
      break;
      
    case 'select-area':
      chrome.tabs.sendMessage(tab.id, { action: 'showAreaSelector' });
      break;
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'stopCapture':
      stopCapture();
      break;
    case 'areaSelected':
      // Handle area selection notification
      console.log('Area selected:', message.area);
      break;
    case 'captureStarted':
      // Handle capture started from content script
      console.log('Capture started with crop area:', message.cropArea);
      // Open settings page
      chrome.runtime.openOptionsPage();
      break;
  }
});

// Removed startTabCapture function as capture is now handled in overlay window

function stopCapture() {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }
  
  if (overlayWindowId) {
    chrome.windows.remove(overlayWindowId);
    overlayWindowId = null;
  }
}

async function createOverlayWindow(captureData) {
  try {
    // Use fixed default values since window.screen is not available in service worker
    const defaultWidth = 320;
    const defaultHeight = 240;
    
    // Try to get current window to calculate better positioning
    let left = captureData.left || 100;
    let top = captureData.top || 100;
    
    try {
      const currentWindow = await chrome.windows.getCurrent();
      // Position in bottom-right of current window if no specific position given
      if (!captureData.left && !captureData.top) {
        left = currentWindow.left + currentWindow.width - defaultWidth - 20;
        top = currentWindow.top + currentWindow.height - defaultHeight - 20;
      }
    } catch (error) {
      console.log('Could not get current window for positioning, using defaults');
    }
    
    const width = captureData.width || defaultWidth;
    const height = captureData.height || defaultHeight;
    
    const pipWindow = await chrome.windows.create({
      url: 'overlay.html',
      type: 'popup',
      width: width,
      height: height,
      top: top,
      left: left,
      focused: false
    });
    
    overlayWindowId = pipWindow.id;
    
    // Store window position
    chrome.storage.local.set({
      overlayPosition: {
        width: width,
        height: height,
        top: top,
        left: left
      }
    });
    
    console.log('PiP window created:', pipWindow);
    
  } catch (error) {
    console.error('Failed to create PiP window:', error);
  }
}

function updateOverlayCropArea(cropArea) {
  if (overlayWindowId) {
    chrome.tabs.query({ windowId: overlayWindowId }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateCropArea',
          cropArea: cropArea
        });
      }
    });
  }
}

// Handle window closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === overlayWindowId) {
    overlayWindowId = null;
    stopCapture();
  }
});