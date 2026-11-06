/**
 * QR Code Right-Click Scanner - Content Script
 * Listens for context menu events and renders the Shadow DOM result modal.
 */

(function () {
  // Prevent duplicate script execution
  if (window.__QR_SCANNER_EXT_INJECTED__) {
    return;
  }
  window.__QR_SCANNER_EXT_INJECTED__ = true;

  let lastRightClickedElement = null;

  // Track the last right-clicked element on the page
  document.addEventListener(
    'contextmenu',
    (e) => {
      lastRightClickedElement = e.target;
    },
    true
  );

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'qr_scan_start':
        showToast('正在识别二维码...');
        break;

      case 'qr_scan_result':
        hideToast();
        if (request.success) {
          showResultModal({
            success: true,
            text: request.text,
            imageUrl: request.imageUrl
          });
        } else {
          showResultModal({
            success: false,
            message: request.message || '未在当前图片中识别到二维码',
            imageUrl: request.imageUrl
          });
        }
        break;

      case 'qr_scan_fallback_dom':
        decodeFromDOM(request.imageUrl);
        break;
    }
  });

  /**
   * Fallback: Try decoding directly from the in-page DOM element or an in-memory image
   */
  async function decodeFromDOM(imageUrl) {
    let imgElement = null;

    // Check if the right-clicked element is an image or contains one
    if (lastRightClickedElement instanceof HTMLImageElement) {
      imgElement = lastRightClickedElement;
    } else if (lastRightClickedElement && lastRightClickedElement.querySelector) {
      imgElement = lastRightClickedElement.querySelector('img');
    }

    if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
      try {
        const result = scanImageElement(imgElement);
        if (result) {
          hideToast();
          chrome.runtime.sendMessage({
            action: 'save_history',
            text: result,
            sourceUrl: imageUrl || imgElement.src
          });
          showResultModal({
            success: true,
            text: result,
            imageUrl: imageUrl || imgElement.src
          });
          return;
        }
      } catch (e) {
        console.warn('Canvas DOM scan error (likely tainted):', e);
      }
    }

    // Try loading via Image object
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const result = scanImageElement(img);
          hideToast();
          if (result) {
            chrome.runtime.sendMessage({
              action: 'save_history',
              text: result,
              sourceUrl: imageUrl
            });
            showResultModal({
              success: true,
              text: result,
              imageUrl: imageUrl
            });
          } else {
            showResultModal({
              success: false,
              message: '未在图片中检测到有效二维码',
              imageUrl: imageUrl
            });
          }
        } catch (err) {
          hideToast();
          showResultModal({
            success: false,
            message: '图片受跨域限制或未检测到二维码',
            imageUrl: imageUrl
          });
        }
      };
      img.onerror = () => {
        hideToast();
        showResultModal({
          success: false,
          message: '图片加载失败，无法扫描',
          imageUrl: imageUrl
        });
      };
      img.src = imageUrl;
    } else {
      hideToast();
      showResultModal({
        success: false,
        message: '未能找到待扫描的图片',
        imageUrl: imageUrl
      });
    }
  }

  /**
   * Draw HTMLImageElement onto canvas and run jsQR
   */
  function scanImageElement(img) {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    if (typeof jsQR !== 'undefined') {
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        return code.data;
      }
    }
    return null;
  }

  // ---------------- Shadow DOM UI ----------------

  let shadowHost = null;
  let shadowRoot = null;

  function ensureShadowRoot() {
    if (!shadowHost || !document.contains(shadowHost)) {
      shadowHost = document.createElement('div');
      shadowHost.id = 'qr-scanner-ext-root';
      document.body.appendChild(shadowHost);
      shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      injectStyles(shadowRoot);
    }
    return shadowRoot;
  }

  function injectStyles(target) {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #1f2937;
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: inherit;
      }

      /* Backdrop */
      .qr-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        padding: 16px;
        animation: qr-fade-in 0.2s ease-out;
      }

      /* Modal Card */
      .qr-card {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
        width: 100%;
        max-width: 480px;
        overflow: hidden;
        animation: qr-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .qr-card {
          background: #1e293b;
          color: #f3f4f6;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        .qr-header {
          border-bottom-color: #334155 !important;
        }
        .qr-footer {
          border-top-color: #334155 !important;
          background: #0f172a !important;
        }
        .qr-textbox {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .btn-secondary {
          background: #334155 !important;
          color: #f1f5f9 !important;
          border-color: #475569 !important;
        }
        .btn-secondary:hover {
          background: #475569 !important;
        }
      }

      /* Header */
      .qr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
      }

      .qr-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .qr-header-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
      }

      .qr-header-icon.success {
        background: #dcfce7;
        color: #15803d;
      }

      .qr-header-icon.failed {
        background: #fee2e2;
        color: #b91c1c;
      }

      .qr-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .qr-close-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        color: #9ca3af;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .qr-close-btn:hover {
        background: rgba(156, 163, 175, 0.15);
        color: #4b5563;
      }

      /* Body */
      .qr-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .qr-top-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .qr-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 500;
      }

      .badge-url {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .badge-wifi {
        background: #fdf2f8;
        color: #be185d;
      }

      .badge-text {
        background: #f3f4f6;
        color: #4b5563;
      }

      .qr-thumb-preview {
        width: 44px;
        height: 44px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }

      .qr-textbox {
        width: 100%;
        max-height: 180px;
        min-height: 80px;
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.6;
        word-break: break-all;
        white-space: pre-wrap;
        overflow-y: auto;
        color: #334155;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      /* WiFi Info Card */
      .wifi-card {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 12px;
        font-size: 13px;
        color: #166534;
      }

      .wifi-row {
        display: flex;
        margin-bottom: 6px;
      }

      .wifi-row:last-child {
        margin-bottom: 0;
      }

      .wifi-label {
        font-weight: 600;
        width: 80px;
        flex-shrink: 0;
      }

      /* Failure Banner */
      .qr-error-msg {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 16px 0;
        gap: 10px;
      }

      .qr-error-tip {
        font-size: 12px;
        color: #6b7280;
        margin-top: 4px;
      }

      /* Footer */
      .qr-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 20px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid transparent;
      }

      .btn-primary {
        background: #2563eb;
        color: #ffffff;
      }

      .btn-primary:hover {
        background: #1d4ed8;
      }

      .btn-success {
        background: #10b981;
        color: #ffffff;
      }

      .btn-secondary {
        background: #ffffff;
        color: #374151;
        border-color: #d1d5db;
      }

      .btn-secondary:hover {
        background: #f3f4f6;
      }

      /* Toast Notification */
      .qr-toast {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: rgba(17, 24, 39, 0.9);
        color: #ffffff;
        padding: 12px 18px;
        border-radius: 9999px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2147483647;
        font-size: 14px;
        animation: qr-fade-in 0.2s ease-out;
      }

      .qr-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: qr-spin 0.8s linear infinite;
      }

      @keyframes qr-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes qr-slide-up {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes qr-spin {
        to { transform: rotate(360deg); }
      }
    `;
    target.appendChild(style);
  }

  // Toast UI
  let activeToast = null;

  function showToast(message) {
    const root = ensureShadowRoot();
    hideToast();

    const toast = document.createElement('div');
    toast.className = 'qr-toast';
    toast.innerHTML = `
      <div class="qr-spinner"></div>
      <span>${escapeHtml(message)}</span>
    `;
    root.appendChild(toast);
    activeToast = toast;
  }

  function hideToast() {
    if (activeToast && activeToast.parentNode) {
      activeToast.parentNode.removeChild(activeToast);
      activeToast = null;
    }
  }

  // Result Modal UI
  let activeModal = null;

  function showResultModal(data) {
    const root = ensureShadowRoot();
    closeResultModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'qr-backdrop';

    const card = document.createElement('div');
    card.className = 'qr-card';

    if (data.success) {
      const text = data.text;
      const isUrl = isValidUrl(text);
      const wifiInfo = parseWifi(text);

      let badgeHtml = '';
      if (wifiInfo) {
        badgeHtml = '<span class="qr-badge badge-wifi">📶 WiFi 网络</span>';
      } else if (isUrl) {
        badgeHtml = '<span class="qr-badge badge-url">🔗 网页链接</span>';
      } else {
        badgeHtml = '<span class="qr-badge badge-text">📄 纯文本</span>';
      }

      let wifiHtml = '';
      if (wifiInfo) {
        wifiHtml = `
          <div class="wifi-card">
            <div class="wifi-row"><span class="wifi-label">网络名称:</span> <strong>${escapeHtml(wifiInfo.ssid)}</strong></div>
            <div class="wifi-row"><span class="wifi-label">密码:</span> <code>${escapeHtml(wifiInfo.password || '(无密码)')}</code></div>
            <div class="wifi-row"><span class="wifi-label">加密类型:</span> <span>${escapeHtml(wifiInfo.auth || 'WPA/WPA2')}</span></div>
          </div>
        `;
      }

      const thumbHtml = data.imageUrl
        ? `<img class="qr-thumb-preview" src="${escapeHtml(data.imageUrl)}" alt="QR Preview" />`
        : '';

      card.innerHTML = `
        <div class="qr-header">
          <div class="qr-title-group">
            <div class="qr-header-icon success">✓</div>
            <h3>识别成功</h3>
          </div>
          <button class="qr-close-btn" id="qr-btn-close" title="关闭 (Esc)">×</button>
        </div>
        <div class="qr-body">
          <div class="qr-top-meta">
            ${badgeHtml}
            ${thumbHtml}
          </div>
          ${wifiHtml}
          <textarea class="qr-textbox" id="qr-textbox" readonly>${escapeHtml(text)}</textarea>
        </div>
        <div class="qr-footer">
          <button class="btn btn-secondary" id="qr-btn-cancel">关闭</button>
          <button class="btn btn-primary" id="qr-btn-copy">
            <span>复制内容</span>
          </button>
          ${
            isUrl
              ? `<button class="btn btn-primary" id="qr-btn-open" style="background:#059669;">打开链接</button>`
              : ''
          }
        </div>
      `;
    } else {
      // Failure card
      card.innerHTML = `
        <div class="qr-header">
          <div class="qr-title-group">
            <div class="qr-header-icon failed">!</div>
            <h3>识别提示</h3>
          </div>
          <button class="qr-close-btn" id="qr-btn-close" title="关闭 (Esc)">×</button>
        </div>
        <div class="qr-body">
          <div class="qr-error-msg">
            <div style="font-size: 15px; font-weight: 500;">${escapeHtml(data.message)}</div>
            <div class="qr-error-tip">提示：请确保所选图片包含清晰完整的二维码。</div>
          </div>
        </div>
        <div class="qr-footer">
          <button class="btn btn-primary" id="qr-btn-cancel">我知道了</button>
        </div>
      `;
    }

    backdrop.appendChild(card);
    root.appendChild(backdrop);
    activeModal = backdrop;

    // Events
    const closeBtn = card.querySelector('#qr-btn-close');
    const cancelBtn = card.querySelector('#qr-btn-cancel');
    const copyBtn = card.querySelector('#qr-btn-copy');
    const openBtn = card.querySelector('#qr-btn-open');
    const textBox = card.querySelector('#qr-textbox');

    const handleClose = () => closeResultModal();

    if (closeBtn) closeBtn.onclick = handleClose;
    if (cancelBtn) cancelBtn.onclick = handleClose;

    // Backdrop click outside card to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) handleClose();
    });

    // Copy action
    if (copyBtn && textBox) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(textBox.value);
          copyBtn.className = 'btn btn-success';
          copyBtn.innerHTML = '<span>已复制 ✓</span>';
          setTimeout(() => {
            if (copyBtn) {
              copyBtn.className = 'btn btn-primary';
              copyBtn.innerHTML = '<span>复制内容</span>';
            }
          }, 1800);
        } catch (e) {
          // Fallback selection copy
          textBox.select();
          document.execCommand('copy');
          copyBtn.innerHTML = '<span>已复制 ✓</span>';
        }
      };
    }

    // Open link action
    if (openBtn && data.text) {
      openBtn.onclick = () => {
        window.open(data.text, '_blank', 'noopener,noreferrer');
        handleClose();
      };
    }

    // Escape key to dismiss
    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        document.removeEventListener('keydown', keydownHandler);
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }

  function closeResultModal() {
    if (activeModal && activeModal.parentNode) {
      activeModal.parentNode.removeChild(activeModal);
      activeModal = null;
    }
  }

  // ---------------- Helpers ----------------

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function parseWifi(text) {
    if (!text || !text.startsWith('WIFI:')) return null;
    // Format: WIFI:S:SSID;T:WPA;P:password;;
    const ssidMatch = text.match(/S:([^;]+)/);
    const passMatch = text.match(/P:([^;]+)/);
    const typeMatch = text.match(/T:([^;]+)/);
    if (!ssidMatch) return null;
    return {
      ssid: ssidMatch ? ssidMatch[1] : '',
      password: passMatch ? passMatch[1] : '',
      auth: typeMatch ? typeMatch[1] : 'WPA'
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
