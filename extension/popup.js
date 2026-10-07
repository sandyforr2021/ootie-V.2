/**
 * OOTie - Extension Popup Script
 */

const DEFAULT_OOTIE_URL = 'http://localhost:5173/bookmarks';

document.addEventListener('DOMContentLoaded', () => {
  const loadingView = document.getElementById('loadingView');
  const errorView = document.getElementById('errorView');
  const mainView = document.getElementById('mainView');
  const errorMessage = document.getElementById('errorMessage');

  const previewImage = document.getElementById('previewImage');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  const inputTitle = document.getElementById('inputTitle');
  const inputBrand = document.getElementById('inputBrand');
  const inputPrice = document.getElementById('inputPrice');
  const inputColor = document.getElementById('inputColor');
  const inputSize = document.getElementById('inputSize');
  const selectCurrency = document.getElementById('selectCurrency');
  const inputImageUrl = document.getElementById('inputImageUrl');
  const inputUrl = document.getElementById('inputUrl');
  const inputOotieUrl = document.getElementById('inputOotieUrl');

  const refreshBtn = document.getElementById('refreshBtn');
  const retryBtn = document.getElementById('retryBtn');
  const sendToOotieBtn = document.getElementById('sendToOotieBtn');

  // 讀取已儲存的 OOTie 網址設定
  try {
    const savedOotieUrl = localStorage.getItem('ootie_custom_endpoint');
    if (savedOotieUrl) {
      inputOotieUrl.value = savedOotieUrl;
    }
  } catch (e) {}

  inputOotieUrl.addEventListener('change', () => {
    try {
      localStorage.setItem('ootie_custom_endpoint', inputOotieUrl.value.trim());
    } catch (e) {}
  });

  function updatePopupImage(src) {
    const val = (src || '').trim();
    if (val) {
      previewImage.src = val;
      previewImage.style.display = 'block';
      if (previewPlaceholder) previewPlaceholder.style.display = 'none';
      previewImage.onerror = () => {
        previewImage.style.display = 'none';
        if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
      };
    } else {
      previewImage.style.display = 'none';
      if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
    }
  }

  inputImageUrl.addEventListener('input', () => {
    updatePopupImage(inputImageUrl.value.trim());
  });

  async function fetchPageInfo() {
    loadingView.style.display = 'flex';
    errorView.style.display = 'none';
    mainView.style.display = 'none';

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.id || !activeTab.url || !activeTab.url.startsWith('http')) {
        throw new Error('請在一般的電商購物網站頁面使用此擴充功能');
      }

      // 1. 先確保 content.js 已注入到當前分頁
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
      } catch (injErr) {
        console.warn('Script injection note:', injErr);
      }

      // 2. 執行 extractProductInfo 取得解析結果
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          if (typeof extractProductInfo === 'function') {
            return extractProductInfo();
          }
          return null;
        }
      });

      let productData = results && results[0] && results[0].result;

      // 3. 若未直接取得，嘗試傳送 message
      if (!productData) {
        try {
          const resp = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_PRODUCT_INFO' });
          if (resp && resp.success && resp.data) {
            productData = resp.data;
          }
        } catch (msgErr) {}
      }

      // 如果依然沒有，則退回以 activeTab 基本資訊
      if (!productData) {
        productData = {
          url: activeTab.url,
          title: activeTab.title || '',
          image: '',
          price: '',
          currency: 'TWD',
          brand: '',
          color: '',
          size: ''
        };
      }

      // 填入表單
      inputTitle.value = productData.title || '';
      inputBrand.value = productData.brand || '';
      inputPrice.value = (productData.price || '').replace(/[^0-9.]/g, '');
      if (inputColor) inputColor.value = productData.color || '';
      if (inputSize) inputSize.value = productData.size || '';
      if (productData.currency) {
        selectCurrency.value = productData.currency;
      }
      inputImageUrl.value = productData.image || '';
      inputUrl.value = productData.url || activeTab.url;
      updatePopupImage(productData.image || '');

      loadingView.style.display = 'none';
      mainView.style.display = 'block';
    } catch (err) {
      loadingView.style.display = 'none';
      errorView.style.display = 'flex';
      errorMessage.textContent = err.message || '擷取失敗，請確認網頁已載入完成';
    }
  }

  refreshBtn.addEventListener('click', fetchPageInfo);
  retryBtn.addEventListener('click', fetchPageInfo);

  // 傳送到 OOTie
  sendToOotieBtn.addEventListener('click', () => {
    const title = inputTitle.value.trim();
    if (!title) {
      alert('請輸入商品名稱');
      inputTitle.focus();
      return;
    }

    const baseUrl = inputOotieUrl.value.trim() || DEFAULT_OOTIE_URL;
    const params = new URLSearchParams();

    params.set('title', title);
    if (inputUrl.value.trim()) params.set('url', inputUrl.value.trim());
    if (inputImageUrl.value.trim()) params.set('image', inputImageUrl.value.trim());
    if (inputBrand.value.trim()) params.set('brand', inputBrand.value.trim());
    if (inputPrice.value.trim()) params.set('price', inputPrice.value.trim().replace(/[^0-9.]/g, ''));
    if (inputColor && inputColor.value.trim()) params.set('color', inputColor.value.trim());
    if (inputSize && inputSize.value.trim()) params.set('size', inputSize.value.trim());
    if (selectCurrency.value) params.set('currency', selectCurrency.value);

    let targetUrl;
    try {
      const parsedBase = new URL(baseUrl);
      // 合併現有與新增的 query params
      params.forEach((val, key) => parsedBase.searchParams.set(key, val));
      targetUrl = parsedBase.toString();
    } catch (err) {
      targetUrl = `${baseUrl}?${params.toString()}`;
    }

    // 檢查若當前瀏覽器已有開啟 OOTie 書籤頁分頁，直接切換至該分頁更新
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        const existingTab = tabs && tabs.find(t => {
          if (!t.url) return false;
          try {
            const u = new URL(t.url);
            return u.pathname.includes('/bookmarks') || u.pathname.endsWith('bookmarks.html') || u.href.includes('bookmarks');
          } catch (e) {
            return false;
          }
        });

        if (existingTab && existingTab.id) {
          chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
            if (existingTab.windowId && chrome.windows) {
              chrome.windows.update(existingTab.windowId, { focused: true });
            }
            window.close();
          });
        } else {
          chrome.tabs.create({ url: targetUrl });
          window.close();
        }
      });
    } else {
      window.open(targetUrl, '_blank');
      window.close();
    }
  });

  fetchPageInfo();
});
