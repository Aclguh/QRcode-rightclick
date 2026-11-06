/**
 * QR Code Right-Click Scanner - Background Service Worker
 * Handles context menu creation, image fetching, and decoding via jsQR & OffscreenCanvas.
 */

// Load jsQR library in Service Worker scope
try {
  importScripts('lib/jsQR.js');
} catch (e) {
  console.error('Failed to import jsQR in service worker:', e);
}

const CONTEXT_MENU_ID = 'scan-qr-code-image';

/**
 * Register context menu on installation or startup
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: chrome.i18n.getMessage('contextMenuTitle') || '扫描图片中的二维码',
      contexts: ['image']
    });
  });
});

/**
 * Handle context menu click
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab || !tab.id) {
    return;
  }

  const imageUrl = info.srcUrl;
  if (!imageUrl) {
    notifyContentScript(tab.id, {
      action: 'qr_scan_result',
      success: false,
      error: 'NO_IMAGE_URL',
      message: '未能获取图片地址'
    });
    return;
  }

  // Notify tab that scanning has started
  await notifyContentScript(tab.id, {
    action: 'qr_scan_start',
    imageUrl: imageUrl
  });

  try {
    const result = await decodeImageFromBackground(imageUrl);
    if (result && result.success) {
      // Save to local scan history
      await saveScanToHistory(result.text, imageUrl);

      await notifyContentScript(tab.id, {
        action: 'qr_scan_result',
        success: true,
        text: result.text,
        imageUrl: imageUrl
      });
    } else {
      // Background decoding found no QR code, or fetch was blocked (e.g., blob URL)
      // Delegate to content script to try reading the image from DOM
      await notifyContentScript(tab.id, {
        action: 'qr_scan_fallback_dom',
        imageUrl: imageUrl
      });
    }
  } catch (err) {
    console.warn('Background decode failed, trying content script DOM fallback:', err);
    await notifyContentScript(tab.id, {
      action: 'qr_scan_fallback_dom',
      imageUrl: imageUrl
    });
  }
});

/**
 * Decode image in Service Worker using Fetch + ImageBitmap + OffscreenCanvas + jsQR
 */
async function decodeImageFromBackground(imageUrl) {
  // If it's a blob URL from a page, background fetch might fail due to origin sandbox
  if (imageUrl.startsWith('blob:')) {
    return { success: false, reason: 'BLOB_URL' };
  }

  const response = await fetch(imageUrl, {
    credentials: 'omit',
    cache: 'force-cache'
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  // 1. Check BarcodeDetector if available
  if (typeof BarcodeDetector !== 'undefined') {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(bitmap);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return { success: true, text: barcodes[0].rawValue, method: 'BarcodeDetector' };
      }
    } catch (e) {
      console.warn('BarcodeDetector check skipped:', e);
    }
  }

  // 2. Decode using jsQR
  if (typeof jsQR !== 'undefined') {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    if (code && code.data) {
      return { success: true, text: code.data, method: 'jsQR' };
    }
  }

  return { success: false, reason: 'NOT_FOUND' };
}

/**
 * Send message to tab with auto-injection fallback if content script is not yet ready
 */
async function notifyContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // If content script was not injected (e.g. page loaded before extension was loaded)
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/jsQR.js', 'content.js']
      });
      // Retry sending message after script injection
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, message);
        } catch (retryErr) {
          console.error('Failed to communicate with content script after injection:', retryErr);
        }
      }, 50);
    } catch (injectErr) {
      console.error('Cannot inject content script into tab (may be chrome:// or restricted page):', injectErr);
    }
  }
}

/**
 * Save scanned QR code to chrome.storage.local history
 */
async function saveScanToHistory(text, sourceUrl) {
  if (!text) return;
  try {
    const data = await chrome.storage.local.get(['scan_history']);
    const history = data.scan_history || [];

    // Don't add duplicate if it's identical to the most recent entry
    if (history.length > 0 && history[0].text === text) {
      return;
    }

    const newRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      sourceUrl: sourceUrl || '',
      timestamp: Date.now()
    };

    // Keep max 50 recent records
    const updatedHistory = [newRecord, ...history].slice(0, 50);
    await chrome.storage.local.set({ scan_history: updatedHistory });
  } catch (err) {
    console.warn('Failed to save scan history:', err);
  }
}

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_history') {
    saveScanToHistory(request.text, request.sourceUrl).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
