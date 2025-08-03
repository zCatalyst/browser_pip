// Settings page script for TradingView PiP extension

let previewStream = null;
let previewVideo = null;
let previewCanvas = null;
let previewCtx = null;
let isPreviewActive = false;
let selectedArea = null;
let previewAnimationId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize elements
  previewVideo = document.getElementById('preview-video');
  previewCanvas = document.getElementById('preview-canvas');
  previewCtx = previewCanvas.getContext('2d');
  
  // Load saved settings
  await loadSettings();
  
  // Set up navigation
  setupNavigation();
  
  // Set up event listeners
  setupEventListeners();
  
  // Update area status
  await updateAreaStatus();
  
  // Note: Preview is now manual - user clicks "Start Preview" button
});

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      
      // Update navigation
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update sections
      sections.forEach(section => section.classList.remove('active'));
      document.getElementById(sectionId).classList.add('active');
    });
  });
}

function setupEventListeners() {
  // Preview controls
  document.getElementById('start-preview').addEventListener('click', startPreview);
  document.getElementById('stop-preview').addEventListener('click', stopPreview);
  document.getElementById('pip-btn').addEventListener('click', togglePiP);
  document.getElementById('test-area-selection').addEventListener('click', testAreaSelection);
  
  // Overlay settings
  document.getElementById('overlay-opacity').addEventListener('input', updateOpacityDisplay);
  document.getElementById('save-overlay-settings').addEventListener('click', saveOverlaySettings);
  
  // Capture settings
  document.getElementById('save-capture-settings').addEventListener('click', saveCaptureSettings);
  
  // Area selection
  document.getElementById('select-new-area').addEventListener('click', selectNewArea);
  document.getElementById('clear-area').addEventListener('click', clearArea);
}

async function loadSettings() {
  const result = await chrome.storage.local.get([
    'overlayPosition',
    'overlayOpacity',
    'videoQuality',
    'frameRate',
    'autoRestart',
    'alwaysOnTop',
    'selectedArea'
  ]);
  
  // Load overlay settings
  const position = result.overlayPosition || { width: 400, height: 300, top: 100, left: 100 };
  document.getElementById('overlay-width').value = position.width;
  document.getElementById('overlay-height').value = position.height;
  document.getElementById('overlay-x').value = position.left;
  document.getElementById('overlay-y').value = position.top;
  document.getElementById('overlay-opacity').value = result.overlayOpacity || 100;
  updateOpacityDisplay();
  
  // Load capture settings
  document.getElementById('video-quality').value = result.videoQuality || '720p';
  document.getElementById('frame-rate').value = result.frameRate || '30';
  document.getElementById('auto-restart').checked = result.autoRestart || false;
  document.getElementById('always-on-top').checked = result.alwaysOnTop !== false;
  
  // Load selected area
  selectedArea = result.selectedArea;
}

function updateOpacityDisplay() {
  const opacity = document.getElementById('overlay-opacity').value;
  document.getElementById('opacity-value').textContent = opacity + '%';
}

async function startPreview() {
  if (isPreviewActive) return;
  
  try {
    console.log('Starting preview capture...');
    
    // Request screen capture - this will show the browser's screen selection dialog
    previewStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    
    console.log('Screen capture stream obtained:', previewStream);
    
    // Set up video
    previewVideo.srcObject = previewStream;
    previewVideo.style.display = 'block';
    document.getElementById('preview-content').style.display = 'none';
    
    const container = document.getElementById('preview-container');
    container.classList.add('active');
    
    isPreviewActive = true;
    
    // Wait for video to load
    await new Promise((resolve, reject) => {
      previewVideo.addEventListener('loadedmetadata', () => {
        console.log('Video loaded - width:', previewVideo.videoWidth, 'height:', previewVideo.videoHeight);
        updatePreviewStats();
        
        // Enable PiP button
        document.getElementById('pip-btn').disabled = false;
        
        if (selectedArea) {
          startPreviewCropping();
        }
        
        resolve();
      }, { once: true });
      
      previewVideo.addEventListener('error', (e) => {
        console.error('Video error:', e);
        reject(new Error('Video failed to load'));
      }, { once: true });
    });
    
    // Try to play the video
    try {
      await previewVideo.play();
      console.log('Video play successful');
    } catch (playError) {
      console.error('Video play failed:', playError);
      // Continue anyway, the video might still work for PiP
    }
    
    // Handle stream end
    previewStream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('Stream ended');
      stopPreview();
    });
    
  } catch (error) {
    console.error('Failed to start preview:', error);
    
    let errorMessage = 'Failed to start preview';
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission denied. Please allow screen sharing.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Screen capture is not supported in this browser.';
    } else {
      errorMessage = 'Failed to start preview: ' + error.message;
    }
    
    alert(errorMessage);
  }
}

function startPreviewCropping() {
  if (!selectedArea || !previewVideo.videoWidth) return;
  
  previewVideo.style.display = 'none';
  previewCanvas.style.display = 'block';
  
  // Set canvas size
  const aspectRatio = selectedArea.width / selectedArea.height;
  const maxWidth = 400;
  const maxHeight = 300;
  
  let canvasWidth, canvasHeight;
  
  if (maxWidth / maxHeight > aspectRatio) {
    canvasHeight = maxHeight;
    canvasWidth = canvasHeight * aspectRatio;
  } else {
    canvasWidth = maxWidth;
    canvasHeight = canvasWidth / aspectRatio;
  }
  
  previewCanvas.width = canvasWidth;
  previewCanvas.height = canvasHeight;
  
  // Start drawing
  drawPreviewFrame();
}

function drawPreviewFrame() {
  if (!previewVideo.videoWidth || !selectedArea || !isPreviewActive) return;
  
  // Calculate source coordinates
  const scaleX = previewVideo.videoWidth / selectedArea.windowWidth;
  const scaleY = previewVideo.videoHeight / selectedArea.windowHeight;
  
  const sourceX = selectedArea.x * scaleX;
  const sourceY = selectedArea.y * scaleY;
  const sourceWidth = selectedArea.width * scaleX;
  const sourceHeight = selectedArea.height * scaleY;
  
  // Draw cropped frame
  previewCtx.drawImage(
    previewVideo,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, previewCanvas.width, previewCanvas.height
  );
  
  // Continue animation
  previewAnimationId = requestAnimationFrame(drawPreviewFrame);
}

function stopPreview() {
  if (!isPreviewActive) return;
  
  isPreviewActive = false;
  
  if (previewAnimationId) {
    cancelAnimationFrame(previewAnimationId);
    previewAnimationId = null;
  }
  
  if (previewStream) {
    previewStream.getTracks().forEach(track => track.stop());
    previewStream = null;
  }
  
  previewVideo.style.display = 'none';
  previewCanvas.style.display = 'none';
  document.getElementById('preview-content').style.display = 'block';
  
  const container = document.getElementById('preview-container');
  container.classList.remove('active');
  
  // Disable PiP button
  document.getElementById('pip-btn').disabled = true;
  
  // Reset stats
  document.getElementById('preview-fps').textContent = '--';
  document.getElementById('preview-resolution').textContent = '--';
}

function updatePreviewStats() {
  if (!previewVideo.videoWidth) return;
  
  document.getElementById('preview-resolution').textContent = 
    `${previewVideo.videoWidth}x${previewVideo.videoHeight}`;
    
  if (selectedArea) {
    document.getElementById('crop-area-size').textContent = 
      `${selectedArea.width}x${selectedArea.height}`;
  }
  
  // Estimate FPS (simplified)
  document.getElementById('preview-fps').textContent = '30';
}

async function testAreaSelection() {
  try {
    // Get any webpage tabs
    const tabs = await chrome.tabs.query({ url: ['https://*/*', 'http://*/*'] });
    
    if (tabs.length === 0) {
      alert('Please open a webpage in a tab first!');
      return;
    }
    
    // Use the first TradingView tab
    const tab = tabs[0];
    
    // Focus the tab
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    
    // Close settings page temporarily
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.windows.remove(currentWindow.id);
    
    // Send message to content script
    await chrome.tabs.sendMessage(tab.id, { action: 'showAreaSelector' });
    
  } catch (error) {
    console.error('Error testing area selection:', error);
    alert('Please refresh the TradingView page and try again.');
  }
}

async function selectNewArea() {
  await testAreaSelection();
}

async function clearArea() {
  selectedArea = null;
  await chrome.storage.local.remove('selectedArea');
  await updateAreaStatus();
  
  // Update preview if active
  if (isPreviewActive && previewCanvas.style.display === 'block') {
    previewCanvas.style.display = 'none';
    previewVideo.style.display = 'block';
  }
}

async function updateAreaStatus() {
  const result = await chrome.storage.local.get(['selectedArea']);
  selectedArea = result.selectedArea;
  
  const statusElement = document.getElementById('area-status');
  const detailsElement = document.getElementById('area-details');
  
  if (selectedArea) {
    statusElement.innerHTML = '<p><span class="status-indicator green"></span>Area selected and ready</p>';
    detailsElement.style.display = 'block';
    
    // Update details
    document.getElementById('area-x').textContent = selectedArea.x;
    document.getElementById('area-y').textContent = selectedArea.y;
    document.getElementById('area-width').textContent = selectedArea.width;
    document.getElementById('area-height').textContent = selectedArea.height;
    
    // Update crop area display
    document.getElementById('crop-area-size').textContent = 
      `${selectedArea.width}x${selectedArea.height}`;
  } else {
    statusElement.innerHTML = '<p><span class="status-indicator red"></span>No area selected</p>';
    detailsElement.style.display = 'none';
    document.getElementById('crop-area-size').textContent = '--';
  }
}

async function saveOverlaySettings() {
  const settings = {
    overlayPosition: {
      width: parseInt(document.getElementById('overlay-width').value),
      height: parseInt(document.getElementById('overlay-height').value),
      left: parseInt(document.getElementById('overlay-x').value),
      top: parseInt(document.getElementById('overlay-y').value)
    },
    overlayOpacity: parseInt(document.getElementById('overlay-opacity').value),
    alwaysOnTop: document.getElementById('always-on-top').checked
  };
  
  await chrome.storage.local.set(settings);
  
  // Show success message
  showNotification('Overlay settings saved!');
}

async function saveCaptureSettings() {
  const settings = {
    videoQuality: document.getElementById('video-quality').value,
    frameRate: parseInt(document.getElementById('frame-rate').value),
    autoRestart: document.getElementById('auto-restart').checked
  };
  
  await chrome.storage.local.set(settings);
  
  // Show success message
  showNotification('Capture settings saved!');
}

async function togglePiP() {
  try {
    if (!previewVideo || !isPreviewActive) {
      showNotification('No active video to enter PiP mode');
      return;
    }
    
    // Check if PiP is supported
    if (!document.pictureInPictureEnabled) {
      showNotification('Picture-in-Picture is not supported in this browser');
      return;
    }
    
    // Check if already in PiP
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      showNotification('Exited PiP mode');
    } else {
      // Enter PiP mode
      await previewVideo.requestPictureInPicture();
      showNotification('Entered PiP mode');
    }
    
  } catch (error) {
    console.error('PiP error:', error);
    showNotification('Failed to toggle PiP: ' + error.message);
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4caf50;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Listen for area selection updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.selectedArea) {
    updateAreaStatus();
  }
});