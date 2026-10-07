/**
 * OOTie - Content Script
 * 智慧電商商品資訊解析引擎 (通用型解析：Microdata -> DOM <h1> -> 智慧正則清洗)
 */

function toAbsoluteUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  try {
    return new URL(trimmed, window.location.href).href;
  } catch (e) {
    if (trimmed.startsWith('//')) return 'https:' + trimmed;
    return trimmed;
  }
}

function cleanTitleString(rawTitle) {
  if (!rawTitle) return '';
  let title = String(rawTitle).trim();

  // 若含 SEO 分隔符號（如 |、-、_），優先取前半段商品名
  if (title.includes('|')) {
    title = title.split('|')[0].trim();
  } else if (/\s+[-–—_]\s+/.test(title)) {
    title = title.split(/\s+[-–—_]\s+/)[0].trim();
  }

  // 移除常見品牌或網站後綴
  title = title
    .replace(/\s*([|\-–—_•·]|::)\s*(lativ|米格國際|uniqlo|uniqlo台灣|zara|gu|h&m|gap|momo|shopee|蝦皮|yahoo|pchome|taobao).*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return title;
}

function isSiteBrandOnly(text) {
  if (!text) return true;
  const t = text.trim().toLowerCase();
  const sitePatterns = ['net線上購物', 'net fashion', 'net', 'lativ', 'uniqlo', 'uniqlo台灣', 'zara', 'gu', 'h&m', 'pazzo', 'meier.q', '50%', 'queen shop', 'd+af', 'grace gift', '蝦皮購物', 'momo購物網', 'yahoo購物中心', '首頁', '商品列表', '全部商品'];
  return sitePatterns.some(p => t === p || t === p + '線上購物');
}

function extractCleanSize(val) {
  if (!val) return '';
  let s = String(val).trim();

  const isInvalid = s.includes('請選擇') || s.includes('選取') || s.includes('選擇') || s.includes('全部') || s.includes('丈量') || s.includes('參考') || s.includes('查看') || s.includes('尺寸表') || s.includes('規格') || s.includes('說明') || s.includes('為xs') || s.includes('商品尺寸') || s.includes('未販售') || s.includes('建議') || s.includes('試穿');
  if (isInvalid) return '';

  // 若字串包含多個尺碼代碼（如 "XS S M L XL"），表示這是一整排可選列表，而非單一選中尺寸
  const sizeMatches = s.match(/\b(3?XS|2?XS|XS|S|M|L|2?XL|3?XL|4?XL)\b/gi);
  if (sizeMatches && sizeMatches.length > 1) {
    return '';
  }

  s = s.replace(/^(女裝|男裝|童裝|男女適穿|男女兼用|男女)[\s/／]*/i, '').trim();
  s = s.replace(/^[\s/／]*(男女適穿|男女兼用|女裝|男裝|童裝)\s*/i, '').trim();
  s = s.replace(/^(尺寸|尺碼|size)[:：\s]*/i, '').trim();

  const tokenMatch = s.match(/\b(3?XS|2?XS|XS|S|M|L|2?XL|3?XL|4?XL|FREE|F|\d{2,3}(?:\.\d)?)\b/i);
  if (tokenMatch) return tokenMatch[0].toUpperCase();

  return (s.length <= 15) ? s : '';
}

function isInvalidImgSrc(src) {
  if (!src) return true;
  const s = src.toLowerCase();
  return (
    s.includes('_color_') ||
    s.includes('/color_') ||
    s.includes('color_') ||
    s.includes('/chip/') ||
    s.includes('chip/') ||
    s.includes('08000800') ||
    s.includes('00480048') ||
    s.includes('icon_') ||
    s.includes('logo') ||
    s.includes('banner') ||
    s.includes('spacer') ||
    s.includes('tracking') ||
    s.includes('blank') ||
    s.startsWith('data:')
  );
}

function extractProductInfo() {
  const result = {
    url: window.location.href,
    title: '',
    image: '',
    price: '',
    currency: 'TWD',
    brand: '',
    color: '',
    size: '',
    sourceDomain: window.location.hostname.replace(/^www\./i, '')
  };

  const hostAndUrl = (result.sourceDomain + ' ' + window.location.href).toLowerCase();
  const isUniqlo = hostAndUrl.includes('uniqlo');
  const isLativ = hostAndUrl.includes('lativ');
  const isNet = hostAndUrl.includes('net-fashion') || hostAndUrl.includes('net.com');

  // 1. 識別品牌
  if (isNet) result.brand = 'NET';
  else if (isLativ) result.brand = 'Lativ';
  else if (isUniqlo) result.brand = 'UNIQLO';
  else if (hostAndUrl.includes('gu-global') || hostAndUrl.includes('gu.com')) result.brand = 'GU';
  else if (hostAndUrl.includes('pazzo')) result.brand = 'PAZZO';
  else if (hostAndUrl.includes('meierq')) result.brand = 'MEIER.Q';
  else if (hostAndUrl.includes('50-shop') || hostAndUrl.includes('fifty')) result.brand = '50% FIFTY PERCENT';
  else if (hostAndUrl.includes('queenshop')) result.brand = 'QUEEN SHOP';
  else if (hostAndUrl.includes('zara')) result.brand = 'ZARA';
  else if (hostAndUrl.includes('aritzia')) result.brand = 'Aritzia';
  else if (hostAndUrl.includes('hm.com')) result.brand = 'H&M';

  // 2. 標題：Microdata -> 專用電商標題 Class (NET, PAZZO, Uniqlo, Lativ等) -> <h1> -> og:title
  if (!result.title) {
    const itempropName = document.querySelector('[itemprop="name"]');
    if (itempropName) {
      const val = (itempropName.getAttribute('content') || itempropName.innerText || itempropName.textContent || '').trim();
      if (val && val.length >= 2 && val.length <= 80 && !isSiteBrandOnly(val)) result.title = cleanTitleString(val);
    }
  }

  if (!result.title) {
    const titleSelectors = [
      '.product_detail_Right_title',
      '.product_detail_title',
      '.product-detail-title',
      '.product-detail-list-title',
      '[class*="product_detail"][class*="title"]',
      '[class*="product_detail"][class*="name"]',
      '[class*="product-detail"][class*="title"]',
      '[class*="product-name"], [class*="productName"], [class*="product_name"]',
      '[class*="product-title"], [class*="productTitle"], [class*="product_title"]',
      '[class*="goods-name"], [class*="goods_name"], [class*="item-name"]',
      '[class*="pdp-title"], [class*="pdp-name"]',
      'h1'
    ];

    for (const sel of titleSelectors) {
      const elList = Array.from(document.querySelectorAll(sel));
      for (const el of elList) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text && text.length >= 2 && text.length <= 60 && !isSiteBrandOnly(text) && !text.includes('購物車') && !text.includes('搜尋')) {
          result.title = cleanTitleString(text);
          break;
        }
      }
      if (result.title) break;
    }
  }

  if (!result.title) {
    const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content;
    const fallback = ogTitle || document.title;
    if (fallback && !isSiteBrandOnly(fallback)) {
      result.title = cleanTitleString(fallback);
    }
  }

  // 3. 圖片擷取 (優先從動態 DOM 抓取當前選取款式/顏色大圖，排除色塊圖與長條說明圖)
  if (isUniqlo) {
    // UNIQLO 專屬鎖定：<div class="h-picture h-picture-loaded"><img class="picture-img" src="..."></div>
    const uniqloImgSelectors = [
      '.h-picture.h-picture-loaded img.picture-img',
      '.h-picture.h-picture-loaded img',
      'div.h-picture img.picture-img',
      'img.picture-img',
      'picture.image img',
      'img[src*="/sku/"]'
    ];
    for (const sel of uniqloImgSelectors) {
      const img = document.querySelector(sel);
      if (img) {
        const src = img.currentSrc || img.src || img.getAttribute('src');
        if (src && !isInvalidImgSrc(src)) {
          result.image = toAbsoluteUrl(src);
          break;
        }
      }
    }
  } else if (isLativ) {
    // Lativ 專屬鎖定：500x500 高清大圖 (src 包含 upload-v1/05000500)
    const lativImgSelectors = [
      'img[src*="upload-v1/05000500"]',
      'img[src*="05000500"]',
      'img[width="500"][height="500"][src*="upload"]',
      'img[fetchpriority="high"][src*="upload"]',
      'img.cursor-pointer[src*="05000500"]',
      'app-marketing-category img[src*="upload-v1"]',
      'app-product img[src*="upload-v1"]',
      '#picLarge img',
      '#main-image img'
    ];
    for (const sel of lativImgSelectors) {
      const img = document.querySelector(sel);
      if (img) {
        const src = img.currentSrc || img.src || img.getAttribute('src');
        if (src && !isInvalidImgSrc(src)) {
          result.image = toAbsoluteUrl(src);
          break;
        }
      }
    }
  } else if (isNet) {
    // NET 專屬鎖定：#PRODUCT_IMAGE_MAIN 與 _400_ 主圖（排除 _color_ 色塊）
    const netImgSelectors = [
      '#PRODUCT_IMAGE_MAIN',
      'img[id*="PRODUCT_IMAGE"]',
      'img[src*="_400_"]'
    ];
    for (const sel of netImgSelectors) {
      const img = document.querySelector(sel);
      if (img) {
        const src = img.currentSrc || img.src || img.getAttribute('src');
        if (src && !isInvalidImgSrc(src)) {
          result.image = toAbsoluteUrl(src);
          break;
        }
      }
    }
  }

  // 通用 DOM 主圖降級掃描
  if (!result.image) {
    const candidateSelectors = [
      'img[fetchpriority="high"]',
      '.swiper-slide-active img',
      '.slick-current img',
      '.carousel-item.active img',
      '#mainImage',
      '.product-main-image img',
      '.primary-image img',
      '.product_detail_Left img',
      '.main_image img',
      '#product_detail img',
      '.product-image img',
      '.pdp-image img',
      'main img'
    ];

    for (const sel of candidateSelectors) {
      const elList = Array.from(document.querySelectorAll(sel));
      for (const img of elList) {
        const src = img.currentSrc || img.src || img.dataset.src || img.dataset.original || img.dataset.zoomImage || img.dataset.large;
        if (src && !isInvalidImgSrc(src)) {
          const rect = img.getBoundingClientRect();
          if ((rect.width >= 120 || img.naturalWidth >= 150) && (rect.height >= 120 || img.naturalHeight >= 150)) {
            result.image = toAbsoluteUrl(src);
            break;
          }
        }
      }
      if (result.image) break;
    }
  }

  // 4. 價格擷取 (優先抓取當前促銷價/現價，排除原價/刪除線標籤)
  if (isUniqlo) {
    // UNIQLO 專屬紅字特價/現價鎖定：<span class="h-currency h-currency-red font-reg">NT$390</span>
    const uniqloPriceSelectors = [
      '.h-currency.h-currency-red',
      'span.h-currency-red',
      '.h-currency-red',
      '.h-price.font-red',
      '.h-price-special',
      '.h-price',
      'span.h-price',
      '.product-price .h-currency'
    ];
    for (const sel of uniqloPriceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && !el.closest('del, s, strike, .origin-price, .old-price')) {
        const match = el.textContent.trim().match(/(?:NT\$|NTD|\$|¥|€|£|HK\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:元)?/i);
        if (match && match[1]) {
          const num = match[1].replace(/,/g, '');
          if (Number(num) > 0) {
            result.price = num;
            break;
          }
        }
      }
    }
  }

  if (!result.price) {
    const salePriceSelectors = [
      '.special-price',
      '.sale-price',
      '.discount-price',
      '.now-price',
      '.current-price',
      '.sales-price',
      '.price-special',
      'span[class*="font-red"]',
      'span[class*="sale"]',
      '[class*="special-price"]',
      '.product_detail_Right_price',
      '[class*="product_detail"][class*="price"]',
      '.product_detail_price',
      '.price',
      '.product-price',
      '.goods-price',
      '.pdp-price',
      'span.price',
      'span.now'
    ];
    for (const sel of salePriceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && !el.closest('del, s, strike, .origin-price, .old-price, [class*="origin"]')) {
        const match = el.textContent.trim().match(/(?:NT\$|NTD|\$|¥|€|£|HK\$|特價|售價|優惠價)?\s*([\d,]+(?:\.\d+)?)\s*(?:元)?/i);
        if (match && match[1]) {
          const num = match[1].replace(/,/g, '');
          if (Number(num) > 0) {
            result.price = num;
            break;
          }
        }
      }
    }
  }

  // 5. 顏色擷取
  const colorSelectors = [
    // Uniqlo 精準顏色標籤
    'span.select-color',
    '.select-color',
    '[class*="select-color"]',
    '[data-test="color-chip"].selected',
    'li.chip.selected[title]',
    // Lativ 當前選取顏色 (img alt)
    'a.color-item.current img[alt]',
    'a.color-item.active img[alt]',
    '.color-box.selected img[alt]',
    '[class*="color_item"].selected img[alt]',
    '[class*="color"].active img[alt]',
    '[class*="color"].selected img[alt]',
    '#colorName',
    '[class*="color-text"]',
    // NET / PAZZO / Universal
    'li.color_box.selected img[alt]',
    'li.color_box.selected',
    'li.color_box.active',
    '.color-selected',
    '.selected-color',
    '[class*="color"][class*="active"]',
    '[class*="color"][class*="selected"]',
    '[class*="color"][class*="checked"]',
    '[aria-selected="true"][class*="color"]',
    '[class*="swatch"][class*="active"]',
    'input[name*="color"]:checked + label',
    'input[name*="color"]:checked',
    '[class*="color_name"]',
    '[class*="selected-color"]'
  ];

  for (const sel of colorSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const val = el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || el.textContent || el.value;
      if (val) {
        const clean = val.replace(/^(顏色|color|colour)[:：\s]*/i, '').trim();
        const isInvalid = clean.includes('請選擇') || clean.includes('全部') || clean.includes('包含未販售') || clean.includes('未販售') || clean.includes('商品顏色');
        if (clean && clean.length <= 25 && !isInvalid) {
          result.color = clean;
          break;
        }
      }
    }
  }

  // 6. 尺寸擷取 (未選擇時嚴格保持留空)
  if (isUniqlo) {
    // UNIQLO 專屬尺寸邏輯：僅讀取明確選中的尺寸標籤，若未選則直接留空
    const uniqloSizeSelectors = [
      'span.select-size',
      '.select-size',
      'li.chip.selected[data-test="size-chip"]',
      'li.size-chip.selected',
      'button.chip.selected',
      'li.selected[data-size]'
    ];
    for (const sel of uniqloSizeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('data-size') || el.innerText || el.textContent;
        const clean = extractCleanSize(val);
        if (clean) {
          result.size = clean;
          break;
        }
      }
    }
  } else {
    // 通用尺寸選取器
    const sizeSelectors = [
      'span.select-size',
      '.select-size',
      '.size-box.selected',
      'a.size-item.selected',
      'a.size-item.active',
      'li.size_box.selected',
      'li.size_box.active',
      '[class*="size"].selected',
      '[class*="size"].active',
      '[class*="size"].checked',
      '[aria-selected="true"][class*="size"]',
      'input[name*="size"]:checked + label',
      'input[name*="size"]:checked',
      '.selected-size',
      '[class*="selected-size"]'
    ];

    for (const sel of sizeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('data-size') || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('aria-label') || el.innerText || el.textContent || el.value;
        if (val) {
          const clean = extractCleanSize(val);
          if (clean) {
            result.size = clean;
            break;
          }
        }
      }
    }
  }

  // Lativ 規格標籤（如：粉紫－S 或 淺米－L）
  if (isLativ || !result.color || !result.size) {
    const lativSpecMatch = document.body.innerText.match(/[（(]([^\s()（）－\-_—/]{1,10})[－\-_—]([^\s()（）－\-_—]{1,8})[）)]/);
    if (lativSpecMatch) {
      if (!result.color) result.color = lativSpecMatch[1].trim();
      if (!result.size) result.size = extractCleanSize(lativSpecMatch[2]);
    }
  }

  // 7. JSON-LD / Meta 降級備援補漏
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const raw = JSON.parse(script.textContent || '{}');
        const items = Array.isArray(raw) ? raw : (raw['@graph'] ? raw['@graph'] : [raw]);
        for (const item of items) {
          if (!item) continue;
          const type = String(item['@type'] || '');
          if (type.toLowerCase().includes('product')) {
            if (item.name && !result.title) result.title = cleanTitleString(item.name);
            if (!result.image) {
              const img = typeof item.image === 'string' ? item.image : (Array.isArray(item.image) ? item.image[0] : (item.image?.url || item.image?.contentUrl));
              if (img && !isInvalidImgSrc(img)) result.image = toAbsoluteUrl(typeof img === 'string' ? img : img.url);
            }
            if (!result.brand) result.brand = typeof item.brand === 'string' ? item.brand : (item.brand?.name || '');
            if (item.offers && !result.price) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              const p = offer?.price !== undefined ? offer.price : offer?.lowPrice;
              if (p !== undefined && p !== null) result.price = String(p).trim();
              if (offer?.priceCurrency) result.currency = String(offer.priceCurrency).trim().toUpperCase();
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  if (!result.image) {
    const metaImg = document.querySelector('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[itemprop="image"], link[rel="image_src"]');
    if (metaImg) {
      const src = metaImg.getAttribute('content') || metaImg.getAttribute('href');
      if (src && !isInvalidImgSrc(src)) result.image = toAbsoluteUrl(src);
    }
  }

  if (!result.brand) {
    const brandMeta = document.querySelector('meta[property="product:brand"], meta[name="brand"], meta[itemprop="brand"]');
    if (brandMeta) result.brand = (brandMeta.getAttribute('content') || brandMeta.innerText || '').trim();
  }

  if (!result.brand) {
    const siteName = document.querySelector('meta[property="og:site_name"], meta[name="twitter:site"]')?.content;
    if (siteName) result.brand = siteName.replace(/^@/, '').trim();
  }

  if (!result.brand) {
    const seg = result.sourceDomain.split('.')[0];
    if (seg) result.brand = seg.charAt(0).toUpperCase() + seg.slice(1);
  }

  if (!result.price) {
    const itempropPrice = document.querySelector('[itemprop="price"], [data-price], [data-product-price]');
    if (itempropPrice) {
      const val = itempropPrice.getAttribute('content') || itempropPrice.getAttribute('data-price') || itempropPrice.innerText;
      if (val) {
        const m = val.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
        if (m) result.price = m[0];
      }
    }
  }

  if (!result.price) {
    const priceMeta = document.querySelector('meta[itemprop="price"], meta[property="product:price:amount"], meta[property="og:price:amount"], meta[name="price"]');
    if (priceMeta) result.price = (priceMeta.getAttribute('content') || '').replace(/[^0-9.]/g, '');
  }

  // 貨幣識別
  const metaCur = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"], meta[itemprop="priceCurrency"]')?.content;
  if (metaCur) {
    result.currency = metaCur.toUpperCase().trim();
  } else if (result.sourceDomain.endsWith('.tw') || window.location.href.includes('.tw')) {
    result.currency = 'TWD';
  }

  if (result.price) {
    result.price = result.price.replace(/[^0-9.]/g, '');
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) result.url = canonical.href;

  return result;
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'GET_PRODUCT_INFO') {
      try {
        const data = extractProductInfo();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });
}
