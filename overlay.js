// Overlay window script for TradingView PiP extension

let captureStream = null;
let cropArea = null;
let video = null;
let canvas = null;
let ctx = null;
let animationId = null;

document.addEventListener('DOMContentLoaded', async () => {
  video = document.getElementById('captured-video');
  canvas = document.getElementById('crop-canvas');
  ctx = canvas.getContext('2d');
  
  const pipBtn = document.getElementById('pip-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const minimizeBtn = document.getElementById('minimize-btn');
  const closeBtn = document.getElementById('close-btn');
  const resizeHandle = document.getElementById('resize-handle');
  const loadingDiv = document.getElementById('loading');
  const statusDiv = document.getElementById('status');
  
  // Verify video element exists
  if (!video) {
    console.error('Video element not found!');
    showError('Video element not found. Please reload the extension.');
    return;
  }
  
  console.log('Video element found:', video);
  
  // Load saved crop area
  const result = await chrome.storage.local.get(['selectedArea']);
  if (result.selectedArea) {
    cropArea = result.selectedArea;
    console.log('Loaded crop area:', cropArea);
  }
  
  // Set up event listeners
  pipBtn.addEventListener('click', enterPiP);
  refreshBtn.addEventListener('click', refreshCapture);
  minimizeBtn.addEventListener('click', minimizeWindow);
  closeBtn.addEventListener('click', closeOverlay);
  
  // Set up PiP window functionality
  setupPiPWindow(resizeHandle);
  
  // Set up PiP event listeners
  setupPiPEventListeners();
  
  // Start capture
  await startCapture();
});

async function startCapture() {
  try {
    updateStatus('Starting capture...');
    
    // Check if getDisplayMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen capture not supported in this browser');
    }
    
    // Request screen capture directly in the overlay window
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    
    console.log('Screen capture stream obtained:', captureStream);
    
    // Verify we got a valid stream
    if (!captureStream || !captureStream.getTracks || captureStream.getTracks().length === 0) {
      throw new Error('No video tracks available in the captured stream');
    }
    
    // Set up video element
    video.srcObject = captureStream;
    
    // Add event listeners for debugging
    video.addEventListener('loadstart', () => {
      console.log('Video loadstart event');
      updateStatus('Loading video...');
    });
    
    video.addEventListener('loadedmetadata', () => {
      console.log('Video loadedmetadata event - width:', video.videoWidth, 'height:', video.videoHeight);
      updateStatus('Capture active', true);
      document.getElementById('loading').style.display = 'none';
      
      if (cropArea) {
        startCropping();
      } else {
        video.style.display = 'block';
      }
      
      // Enable PiP button once video is loaded
      enablePiPButton();
    });
    
    video.addEventListener('canplay', () => {
      console.log('Video canplay event');
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      showError('Video playback error: ' + (video.error ? video.error.message : 'Unknown error'));
    });
    
    // Handle stream end
    captureStream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('Stream ended');
      updateStatus('Capture ended');
      showError('Screen capture was stopped. Please restart from the extension popup.');
    });
    
    // Try to play the video
    try {
      await video.play();
      console.log('Video play() successful');
    } catch (playError) {
      console.error('Video play() failed:', playError);
      // Don't throw here, let the video try to play naturally
    }
    
  } catch (error) {
    console.error('Failed to start capture:', error);
    updateStatus('Capture failed');
    
    // Try alternative approach - capture the current tab
    try {
      console.log('Trying alternative capture method...');
      updateStatus('Trying alternative method...');
      
      // Try to capture the current tab instead
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const tab = tabs[0];
        if (tab.url.includes('tradingview.com')) {
          // Try to get a screenshot as fallback
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          if (dataUrl) {
            // Create a video-like element with the screenshot
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            
            // Replace video with image
            video.style.display = 'none';
            video.parentNode.insertBefore(img, video);
            
            updateStatus('Screenshot mode', true);
            document.getElementById('loading').style.display = 'none';
            return;
          }
        }
      }
    } catch (fallbackError) {
      console.error('Fallback capture also failed:', fallbackError);
    }
    
    showError('Failed to start screen capture: ' + error.message + '\n\nPlease make sure you have granted screen capture permissions.');
  }
}

function startCropping() {
  if (!cropArea || !video.videoWidth) return;
  
  video.style.display = 'none';
  canvas.style.display = 'block';
  
  // Set canvas size to match the crop area aspect ratio
  const aspectRatio = cropArea.width / cropArea.height;
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  
  let canvasWidth, canvasHeight;
  
  if (containerWidth / containerHeight > aspectRatio) {
    canvasHeight = containerHeight;
    canvasWidth = canvasHeight * aspectRatio;
  } else {
    canvasWidth = containerWidth;
    canvasHeight = canvasWidth / aspectRatio;
  }
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  // Start drawing cropped frames
  drawCroppedFrame();
}

function drawCroppedFrame() {
  if (!video.videoWidth || !cropArea) return;
  
  // Calculate source coordinates relative to video dimensions
  const scaleX = video.videoWidth / cropArea.windowWidth;
  const scaleY = video.videoHeight / cropArea.windowHeight;
  
  const sourceX = cropArea.x * scaleX;
  const sourceY = cropArea.y * scaleY;
  const sourceWidth = cropArea.width * scaleX;
  const sourceHeight = cropArea.height * scaleY;
  
  // Draw cropped frame
  ctx.drawImage(
    video,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, canvas.width, canvas.height
  );
  
  // Continue animation
  animationId = requestAnimationFrame(drawCroppedFrame);
}

function refreshCapture() {
  updateStatus('Refreshing...');
  
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
  }
  
  document.getElementById('loading').style.display = 'block';
  video.style.display = 'none';
  canvas.style.display = 'none';
  
  setTimeout(startCapture, 500);
}

function enablePiPButton() {
  const pipBtn = document.getElementById('pip-btn');
  if (pipBtn) {
    pipBtn.disabled = false;
    pipBtn.title = 'Enter Picture-in-Picture';
  }
}

async function enterPiP() {
  try {
    if (!video) {
      console.error('No video element available');
      return;
    }
    
    // Check if PiP is supported
    if (!document.pictureInPictureEnabled) {
      showError('Picture-in-Picture is not supported in this browser');
      return;
    }
    
    // Check if already in PiP
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      updateStatus('Exited PiP mode');
    } else {
      // Enter PiP mode
      await video.requestPictureInPicture();
      updateStatus('Entered PiP mode', true);
      
      // Update button
      const pipBtn = document.getElementById('pip-btn');
      if (pipBtn) {
        pipBtn.textContent = '📺';
        pipBtn.title = 'Exit Picture-in-Picture';
      }
    }
    
  } catch (error) {
    console.error('PiP error:', error);
    showError('Failed to enter Picture-in-Picture: ' + error.message);
  }
}

function minimizeWindow() {
  // Minimize the PiP window
  chrome.windows.getCurrent((window) => {
    chrome.windows.update(window.id, { state: 'minimized' });
  });
}

function setupPiPWindow(resizeHandle) {
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  // Resize functionality
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    chrome.windows.getCurrent((window) => {
      startWidth = window.width;
      startHeight = window.height;
    });
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(200, startWidth + deltaX);
    const newHeight = Math.max(150, startHeight + deltaY);
    
    chrome.windows.getCurrent((window) => {
      chrome.windows.update(window.id, {
        width: newWidth,
        height: newHeight
      });
    });
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      // Save new window size
      chrome.windows.getCurrent((window) => {
        chrome.storage.local.set({
          overlayPosition: {
            width: window.width,
            height: window.height,
            top: window.top,
            left: window.left
          }
        });
      });
    }
  });
  
  // Save window position when moved
  let isDragging = false;
  let dragStartX, dragStartY;
  
  document.addEventListener('mousedown', (e) => {
    // Only start dragging if clicking on the background (not on controls or video)
    if (e.target === document.body || e.target.id === 'video-container') {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    chrome.windows.getCurrent((window) => {
      chrome.windows.update(window.id, {
        left: window.left + deltaX,
        top: window.top + deltaY
      });
    });
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      // Save new window position
      chrome.windows.getCurrent((window) => {
        chrome.storage.local.set({
          overlayPosition: {
            width: window.width,
            height: window.height,
            top: window.top,
            left: window.left
          }
        });
      });
    }
  });
}

function setupPiPEventListeners() {
  // Listen for PiP enter/exit events
  video.addEventListener('enterpictureinpicture', () => {
    console.log('Entered PiP mode');
    updateStatus('PiP Active', true);
    
    // Update button
    const pipBtn = document.getElementById('pip-btn');
    if (pipBtn) {
      pipBtn.textContent = '📺';
      pipBtn.title = 'Exit Picture-in-Picture';
    }
  });
  
  video.addEventListener('leavepictureinpicture', () => {
    console.log('Exited PiP mode');
    updateStatus('PiP Inactive');
    
    // Update button
    const pipBtn = document.getElementById('pip-btn');
    if (pipBtn) {
      pipBtn.textContent = '📺';
      pipBtn.title = 'Enter Picture-in-Picture';
    }
  });
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function closeOverlay() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
  }
  
  chrome.runtime.sendMessage({ action: 'stopCapture' });
  window.close();
}

function updateStatus(message, active = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = active ? 'status-indicator active' : 'status-indicator';
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.innerHTML = `
    <div>${message}</div>
    <button id="retry-btn" style="margin-top: 10px; padding: 5px 10px; background: #2962ff; color: white; border: none; border-radius: 3px; cursor: pointer;">
      Try Again
    </button>
  `;
  
  document.getElementById('video-container').appendChild(errorDiv);
  
  // Add event listener properly instead of inline onclick
  document.getElementById('retry-btn').addEventListener('click', refreshCapture);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'updateCropArea':
      cropArea = message.cropArea;
      if (video.videoWidth) {
        startCropping();
      }
      break;
    case 'updateStream':
      // Handle stream updates if needed
      break;
  }
});

// Save window position when moved/resized
window.addEventListener('beforeunload', () => {
  chrome.storage.local.set({
    overlayPosition: {
      width: window.outerWidth,
      height: window.outerHeight,
      top: window.screenY,
      left: window.screenX
    }
  });
});