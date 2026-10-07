const DEFAULT_DESCRIPTION = 'OOTIE 整合數位衣櫥、穿搭靈感、Style SOS 與 AI 視覺預覽，陪你找到每天想穿的樣子。';
const ROUTE_TITLES = {
  Home: 'OOTIE｜你的衣櫥，更多穿搭可能', Explore: '探索 OOTD｜OOTIE', Closet: '我的衣櫥｜OOTIE',
  Bookmarks: '書籤與收藏穿搭｜OOTIE', Stats: '衣櫥統計｜OOTIE', Sos: '穿搭 SOS｜OOTIE',
  Ai: 'AI 穿搭助理｜OOTIE', Tryon: '虛擬試穿｜OOTIE', Profile: '個人檔案｜OOTIE',
  Membership: '方案與點數｜OOTIE', Settings: '帳號設定｜OOTIE', Legal: '資訊與條款｜OOTIE',
  OotdDetail: 'OOTD 詳情｜OOTIE', NotFound: '找不到頁面｜OOTIE'
};

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
};

const upsertCanonical = (href) => {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
};

export const updatePublicContentMeta = ({ title, description, image, url }) => {
  const safeTitle = title || 'OOTIE｜數位衣櫥與穿搭社群';
  const safeDescription = description || DEFAULT_DESCRIPTION;
  const safeUrl = url || window.location.href;
  document.title = safeTitle;
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: safeTitle });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: safeDescription });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: safeUrl });
  if (image) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
  upsertCanonical(safeUrl);
};

export const updateDocumentMeta = (route) => {
  const title = ROUTE_TITLES[route?.name] || 'OOTIE｜數位衣櫥與穿搭社群';
  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description', content: DEFAULT_DESCRIPTION });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: DEFAULT_DESCRIPTION });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: window.location.href });
  upsertCanonical(window.location.href);
};
