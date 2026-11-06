/**
 * QR Code Right-Click Scanner - Popup Script
 * Handles image upload/paste decoding, QR code generation, and scan history.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initScanTab();
  initGenerateTab();
  initHistoryTab();
});

// ---------------- Navigation Tabs ----------------

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (targetId === 'tab-history') {
        loadHistory();
      }
    });
  });
}

// ---------------- Tab 1: Scan (Upload / Paste / Drag & Drop) ----------------

function initScanTab() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const resultCard = document.getElementById('scan-result-card');
  const resultBadge = document.getElementById('result-badge');
  const resultThumb = document.getElementById('result-thumb');
  const resultText = document.getElementById('result-text');
  const btnCopy = document.getElementById('btn-copy-result');
  const btnOpen = document.getElementById('btn-open-result');

  // Click drop zone to select file
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processImageFile(file);
    }
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  });

  // Global paste (Ctrl + V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  });

  // Copy result action
  btnCopy.addEventListener('click', async () => {
    const text = resultText.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      btnCopy.classList.add('btn-success');
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => {
        btnCopy.classList.remove('btn-success');
        btnCopy.textContent = '复制内容';
      }, 1500);
    } catch (_) {
      resultText.select();
      document.execCommand('copy');
      btnCopy.textContent = '已复制 ✓';
    }
  });

  // Open link action
  btnOpen.addEventListener('click', () => {
    const text = resultText.value;
    if (text && isValidUrl(text)) {
      window.open(text, '_blank');
    }
  });

  function processImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('请选择有效的图片文件！');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        decodeImageAndDisplay(img, dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function decodeImageAndDisplay(img, dataUrl) {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    let decodedText = null;

    if (typeof jsQR !== 'undefined') {
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        decodedText = code.data;
      }
    }

    if (decodedText) {
      resultCard.classList.remove('hidden');
      resultThumb.src = dataUrl;
      resultText.value = decodedText;

      const isUrl = isValidUrl(decodedText);
      const isWifi = decodedText.startsWith('WIFI:');

      if (isWifi) {
        resultBadge.textContent = 'WiFi网络';
        resultBadge.className = 'result-badge wifi';
      } else if (isUrl) {
        resultBadge.textContent = '网页链接';
        resultBadge.className = 'result-badge';
      } else {
        resultBadge.textContent = '纯文本';
        resultBadge.className = 'result-badge';
      }

      if (isUrl) {
        btnOpen.classList.remove('hidden');
      } else {
        btnOpen.classList.add('hidden');
      }

      // Save to history
      saveToHistory(decodedText, '本地上传/粘贴');
    } else {
      alert('未能在此图片中识别到二维码，请检查图片清晰度或尝试其他图片。');
    }
  }
}

// ---------------- Tab 2: Generate QR Code ----------------

function initGenerateTab() {
  const genText = document.getElementById('gen-text');
  const btnUseUrl = document.getElementById('btn-use-current-url');
  const btnGenerate = document.getElementById('btn-generate-qr');
  const previewBox = document.getElementById('gen-preview-box');
  const qrOutputWrap = document.getElementById('qr-output-wrap');
  const btnDownload = document.getElementById('btn-download-qr');

  let currentCanvas = null;

  // Fill active tab URL
  btnUseUrl.addEventListener('click', async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url) {
        genText.value = activeTab.url;
      }
    } catch (e) {
      console.warn('Could not query active tab url:', e);
    }
  });

  // Generate QR
  btnGenerate.addEventListener('click', () => {
    const text = (genText.value || '').trim();
    if (!text) {
      alert('请输入要生成二维码的内容！');
      genText.focus();
      return;
    }

    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();

      const count = qr.getModuleCount();
      const cellSize = 6;
      const margin = 16;
      const size = count * cellSize + margin * 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Draw modules
      ctx.fillStyle = '#0f172a';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize);
          }
        }
      }

      qrOutputWrap.innerHTML = '';
      qrOutputWrap.appendChild(canvas);
      previewBox.classList.remove('hidden');
      currentCanvas = canvas;
    } catch (err) {
      console.error('QR generation error:', err);
      alert('生成二维码失败：内容可能过长或包含不支持的字符。');
    }
  });

  // Download QR as PNG
  btnDownload.addEventListener('click', () => {
    if (!currentCanvas) return;
    const link = document.createElement('a');
    link.download = `qrcode_${Date.now()}.png`;
    link.href = currentCanvas.toDataURL('image/png');
    link.click();
  });
}

// ---------------- Tab 3: History ----------------

function initHistoryTab() {
  const btnClear = document.getElementById('btn-clear-history');
  btnClear.addEventListener('click', async () => {
    if (confirm('确定要清空所有扫描历史记录吗？')) {
      await chrome.storage.local.set({ scan_history: [] });
      loadHistory();
    }
  });
}

async function loadHistory() {
  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');

  try {
    const data = await chrome.storage.local.get(['scan_history']);
    const history = data.scan_history || [];

    historyCount.textContent = `共 ${history.length} 条记录`;

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">暂无扫描历史记录</div>';
      return;
    }

    historyList.innerHTML = '';
    history.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

      const isUrl = isValidUrl(item.text);
      const isWifi = item.text.startsWith('WIFI:');
      const badgeText = isWifi ? 'WiFi' : isUrl ? '链接' : '文本';
      const timeStr = formatRelativeTime(item.timestamp);

      itemEl.innerHTML = `
        <div class="history-item-top">
          <span class="history-badge">${badgeText}</span>
          <span class="history-time">${timeStr}</span>
        </div>
        <div class="history-text" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</div>
      `;

      itemEl.addEventListener('click', async () => {
        if (isUrl) {
          if (confirm(`是否在网页中打开该链接？\n\n${item.text}`)) {
            window.open(item.text, '_blank');
            return;
          }
        }
        try {
          await navigator.clipboard.writeText(item.text);
          alert('已复制该条记录内容至剪切板！');
        } catch (_) {
          prompt('记录内容：', item.text);
        }
      });

      historyList.appendChild(itemEl);
    });
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

// ---------------- Shared Utilities ----------------

async function saveToHistory(text, source) {
  try {
    const data = await chrome.storage.local.get(['scan_history']);
    const history = data.scan_history || [];

    if (history.length > 0 && history[0].text === text) {
      return;
    }

    const newRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      sourceUrl: source || '',
      timestamp: Date.now()
    };

    const updated = [newRecord, ...history].slice(0, 50);
    await chrome.storage.local.set({ scan_history: updated });
  } catch (e) {
    console.warn('Failed to save history in popup:', e);
  }
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
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
