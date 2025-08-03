// Settings page script for TradingView PiP extension

let previewStream = null;
let previewVideo = null;
let previewCanvas = null;
let previewCtx = null;
let isPreviewActive = false;
let selectedArea = null;
let previewAnimationId = null;
let croppedVideo = null; // Video element for cropped PiP

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize elements
  previewVideo = document.getElementById('preview-video');
  previewCanvas = document.getElementById('preview-canvas');
  previewCtx = previewCanvas.getContext('2d', {
    alpha: false, // Better performance for opaque content
    desynchronized: true // Better performance for animations
  });
  
  // Set high-quality rendering as default
  previewCtx.imageSmoothingEnabled = true;
  previewCtx.imageSmoothingQuality = 'high';
  
  // Load saved settings
  await loadSettings();
  
  // Set up navigation
  setupNavigation();
  
  // Set up event listeners
  setupEventListeners();
  
  // Update area status
  await updateAreaStatus();
  
  // Check if we should auto-start preview from popup
  const result = await chrome.storage.local.get(['autoStartPreview', 'autoStartPiP']);
  if (result.autoStartPreview) {
    // Clear the flags
    await chrome.storage.local.remove(['autoStartPreview', 'autoStartPiP']);
    
    // Auto-start preview after a short delay to ensure UI is ready
    setTimeout(async () => {
      try {
        await startPreview();
        
        // Check if we should also auto-start PiP
        if (result.autoStartPiP) {
          // Set up auto-PiP on next user interaction
          setTimeout(() => {
            setupAutoPiP();
          }, 1000); // Wait 1 second for video to be ready
        } else {
          showNotification('Preview started! Click the 📺 PiP button to enter Picture-in-Picture mode.');
        }
      } catch (error) {
        console.error('Auto-start failed:', error);
        showNotification('Failed to auto-start preview. Please click "Start Preview" manually.');
        // Reset capture state on failure
        chrome.storage.local.set({ isCapturing: false });
      }
    }, 500);
  }
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
    await setupPreviewStream();
    
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

async function setupPreviewStream() {
  // Set up video
  previewVideo.srcObject = previewStream;
  previewVideo.style.display = 'block';
  document.getElementById('preview-content').style.display = 'none';
  
  const container = document.getElementById('preview-container');
  container.classList.add('active');
  
  isPreviewActive = true;
  
  // Update capture state in storage
  chrome.storage.local.set({ isCapturing: true });
  
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
    showNotification('Capture ended. Preview stopped.');
  });
}

function startPreviewCropping() {
  if (!selectedArea || !previewVideo.videoWidth) return;
  
  previewVideo.style.display = 'none';
  previewCanvas.style.display = 'block';
  
  // Calculate source dimensions for cropping
  const scaleX = previewVideo.videoWidth / selectedArea.windowWidth;
  const scaleY = previewVideo.videoHeight / selectedArea.windowHeight;
  
  const sourceWidth = selectedArea.width * scaleX;
  const sourceHeight = selectedArea.height * scaleY;
  
  // Set canvas to native resolution of selected area for best quality
  const aspectRatio = sourceWidth / sourceHeight;
  
  // Use higher resolution for PiP quality, but limit to reasonable size
  const maxPiPWidth = 1280;
  const maxPiPHeight = 720;
  
  let canvasWidth, canvasHeight;
  
  // For PiP quality, use source resolution up to max limits
  if (sourceWidth <= maxPiPWidth && sourceHeight <= maxPiPHeight) {
    canvasWidth = sourceWidth;
    canvasHeight = sourceHeight;
  } else {
    // Scale down proportionally if source is too large
    if (maxPiPWidth / maxPiPHeight > aspectRatio) {
      canvasHeight = maxPiPHeight;
      canvasWidth = canvasHeight * aspectRatio;
    } else {
      canvasWidth = maxPiPWidth;
      canvasHeight = canvasWidth / aspectRatio;
    }
  }
  
  previewCanvas.width = canvasWidth;
  previewCanvas.height = canvasHeight;
  
  // Set display size for preview (smaller than actual canvas resolution)
  const maxDisplayWidth = 400;
  const maxDisplayHeight = 300;
  
  let displayWidth, displayHeight;
  if (maxDisplayWidth / maxDisplayHeight > aspectRatio) {
    displayHeight = maxDisplayHeight;
    displayWidth = displayHeight * aspectRatio;
  } else {
    displayWidth = maxDisplayWidth;
    displayHeight = displayWidth / aspectRatio;
  }
  
  previewCanvas.style.width = displayWidth + 'px';
  previewCanvas.style.height = displayHeight + 'px';
  
  console.log('Canvas resolution:', canvasWidth, 'x', canvasHeight);
  console.log('Canvas display size:', displayWidth, 'x', displayHeight);
  
  // Create a video element for PiP from the canvas stream
  createCroppedVideoForPiP();
  
  // Start drawing
  drawPreviewFrame();
}

function createCroppedVideoForPiP() {
  // Create or reuse video element for cropped stream
  if (!croppedVideo) {
    croppedVideo = document.createElement('video');
    croppedVideo.style.display = 'none';
    croppedVideo.muted = true;
    croppedVideo.playsInline = true;
    croppedVideo.autoplay = true;
    document.body.appendChild(croppedVideo);
  }
  
  // Clean up any existing stream
  if (croppedVideo.srcObject) {
    croppedVideo.srcObject.getTracks().forEach(track => track.stop());
  }
  
  // Create a high-quality stream from the canvas
  // Use 60 FPS for smoother motion
  const canvasStream = previewCanvas.captureStream(60);
  
  // Get the video track and configure it for better quality if possible
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack) {
    // Apply constraints for better quality
    videoTrack.applyConstraints({
      width: { ideal: previewCanvas.width },
      height: { ideal: previewCanvas.height },
      frameRate: { ideal: 60 }
    }).catch(err => console.log('Could not apply track constraints:', err));
  }
  
  croppedVideo.srcObject = canvasStream;
  
  // Wait for video to be ready
  croppedVideo.addEventListener('loadedmetadata', async () => {
    try {
      await croppedVideo.play();
      console.log('Cropped video ready for PiP at', croppedVideo.videoWidth, 'x', croppedVideo.videoHeight);
    } catch (error) {
      console.error('Failed to play cropped video:', error);
    }
  }, { once: true });
  
  // Force the canvas to start streaming by drawing at least one frame
  setTimeout(() => {
    if (previewCanvas && selectedArea) {
      drawPreviewFrame();
    }
  }, 100);
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
  
  // Enable high-quality image rendering
  previewCtx.imageSmoothingEnabled = true;
  previewCtx.imageSmoothingQuality = 'high';
  
  // Clear canvas for clean frame
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Draw cropped frame with high quality
  previewCtx.drawImage(
    previewVideo,
    Math.round(sourceX), Math.round(sourceY), Math.round(sourceWidth), Math.round(sourceHeight),
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
  
  // Clean up cropped video
  if (croppedVideo) {
    if (croppedVideo.srcObject) {
      croppedVideo.srcObject.getTracks().forEach(track => track.stop());
      croppedVideo.srcObject = null;
    }
    croppedVideo.remove();
    croppedVideo = null;
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
  
  // Update capture state in storage
  chrome.storage.local.set({ isCapturing: false });
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
    
    // Use the first webpage tab
    const tab = tabs[0];
    
    // Focus the tab
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    
    // Check if content script is loaded, inject if needed
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (error) {
      // Content script not loaded, inject both script and CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Wait for script to load
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
        alert('Failed to inject content script. Please refresh the page and try again.');
        return;
      }
    }
    
    // Close settings page temporarily
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.windows.remove(currentWindow.id);
    
    // Send message to content script
    await chrome.tabs.sendMessage(tab.id, { action: 'showAreaSelector' });
    
  } catch (error) {
    console.error('Error testing area selection:', error);
    alert('Please refresh the webpage and try again.');
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
    // Stop animation and clean up cropped video
    if (previewAnimationId) {
      cancelAnimationFrame(previewAnimationId);
      previewAnimationId = null;
    }
    
    if (croppedVideo) {
      if (croppedVideo.srcObject) {
        croppedVideo.srcObject.getTracks().forEach(track => track.stop());
        croppedVideo.srcObject = null;
      }
      croppedVideo.remove();
      croppedVideo = null;
    }
    
    // Switch back to full video
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
    if (!isPreviewActive) {
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
      // Determine which video element to use for PiP
      let videoForPiP = previewVideo;
      
      // If area is selected and cropped video is ready, use the cropped video
      if (selectedArea && croppedVideo && croppedVideo.srcObject) {
        videoForPiP = croppedVideo;
        console.log('Using cropped video for PiP');
      } else {
        console.log('Using original video for PiP');
      }
      
      // Wait a moment for video to be ready if needed
      if (videoForPiP.readyState < 2) {
        showNotification('Preparing video for PiP...');
        await new Promise(resolve => {
          const onReady = () => {
            videoForPiP.removeEventListener('canplay', onReady);
            resolve();
          };
          videoForPiP.addEventListener('canplay', onReady);
        });
      }
      
      // Enter PiP mode
      await videoForPiP.requestPictureInPicture();
      
      if (selectedArea && videoForPiP === croppedVideo) {
        showNotification('Entered PiP mode with selected area');
      } else {
        showNotification('Entered PiP mode');
      }
    }
    
  } catch (error) {
    console.error('PiP error:', error);
    showNotification('Failed to toggle PiP: ' + error.message);
  }
}

function setupAutoPiP() {
  // Make PiP button prominent
  const pipBtn = document.getElementById('pip-btn');
  if (!pipBtn) return;
  
  // Make the button very prominent
  pipBtn.style.cssText = `
    background: #ff4444 !important;
    color: white !important;
    font-size: 18px !important;
    padding: 15px 25px !important;
    border: 3px solid #fff !important;
    border-radius: 8px !important;
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.5) !important;
    animation: pulse 1s infinite !important;
    transform: scale(1.1) !important;
    position: relative !important;
    z-index: 1000 !important;
  `;
  
  // Add pulsing animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.5); }
      50% { box-shadow: 0 0 30px rgba(255, 68, 68, 0.8); }
      100% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.5); }
    }
  `;
  document.head.appendChild(style);
  
  // Show prominent notification
  showNotification('🎯 Click anywhere on this page to start Picture-in-Picture automatically!');
  
  // Set up one-time click listener for auto-PiP
  const autoPiPHandler = async (event) => {
    try {
      // Remove the listener so it only fires once
      document.removeEventListener('click', autoPiPHandler);
      
      // Reset button style
      pipBtn.style.cssText = '';
      
      await togglePiP();
      showNotification('Picture-in-Picture started automatically!');
      
      // Hide the settings window after successful PiP start
      setTimeout(() => {
        chrome.windows.getCurrent().then(currentWindow => {
          if (currentWindow) {
            chrome.windows.update(currentWindow.id, { state: 'minimized' });
          }
        });
      }, 1500);
      
    } catch (pipError) {
      console.error('Auto-PiP failed:', pipError);
      showNotification('Click the 📺 PiP button to enter Picture-in-Picture mode.');
      // Reset button style on error
      pipBtn.style.cssText = '';
    }
  };
  
  // Add click listener to document
  document.addEventListener('click', autoPiPHandler);
  
  // Also add it specifically to the PiP button
  pipBtn.addEventListener('click', autoPiPHandler);
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