export const NAVIGATION_ITEMS = Object.freeze([
  { routeName: 'Home', path: '/', label: '首頁', shortLabel: '首頁', icon: '⌂', mobile: 'primary' },
  { routeName: 'Shop', path: '/shop', label: '試穿工作室', shortLabel: '試穿', icon: '✧', mobile: 'primary' },
  { routeName: 'Explore', path: '/explore', label: '探索', shortLabel: '探索', icon: '✦', mobile: 'primary' },
  { routeName: 'Closet', path: '/closet', label: '我的衣櫥', shortLabel: '衣櫥', icon: '👚', mobile: 'primary' },
  { routeName: 'Sos', path: '/sos', label: '穿搭求救', shortLabel: 'SOS', icon: '♡', mobile: 'more' },
  { routeName: 'Profile', path: '/profile', label: '個人檔案', shortLabel: '我的', icon: '◯', mobile: 'more' },
  { routeName: 'Stats', path: '/stats', label: '衣櫥統計', shortLabel: '統計', icon: '▥', mobile: 'more' },
  { routeName: 'Credits', path: '/credits', label: '方案與點數', shortLabel: '點數', icon: '◇', mobile: 'more' },
  { routeName: 'Settings', path: '/settings', label: '帳號設定', shortLabel: '設定', icon: '⚙', mobile: 'more' }
]);

export const MOBILE_PRIMARY_ITEMS = NAVIGATION_ITEMS.filter((item) => item.mobile === 'primary');
export const MOBILE_MORE_ITEMS = NAVIGATION_ITEMS.filter((item) => item.mobile === 'more');
