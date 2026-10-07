import { defineStore } from 'pinia';
import { useAppStore } from './app';
import { CLOSET_DATA_MODE, useClosetStore } from './closet';
import { useAuthStore } from './auth';
import { ASYNC_STATUS } from '@/contracts/asyncState';
import { labels, getColorFamilyForPrimaryColor } from '@/constants';

export const useStatsStore = defineStore('stats', () => {
  const appStore = useAppStore();
  const closetStore = useClosetStore();
  const authStore = useAuthStore();
  let sourceLoad = null;
  let activeSourceItems = [];

  const ensureDataSource = async () => {
    if (authStore.isMember && authStore.profileId) {
      if (
        closetStore.dataMode === CLOSET_DATA_MODE.REMOTE &&
        [ASYNC_STATUS.SUCCESS, ASYNC_STATUS.EMPTY].includes(closetStore.remoteState.status)
      ) {
        activeSourceItems = appStore.items;
        return activeSourceItems;
      }
      if (!sourceLoad) {
        sourceLoad = closetStore.loadRemoteItems(authStore.profileId)
          .then((result) => {
            activeSourceItems = result?.ok ? appStore.items : [];
            return activeSourceItems;
          })
          .finally(() => {
            sourceLoad = null;
          });
      }
      return sourceLoad;
    }

    // A session without a resolved profile is not a Guest. Keep stats empty
    // until the existing identity contract becomes ready.
    if (authStore.session) {
      activeSourceItems = [];
      return activeSourceItems;
    }
    // Loading the Guest namespace replaces appStore.items. Reuse the active
    // Guest collection on subsequent reads so a deep items watcher cannot
    // recursively trigger another replacement while the Statistics view is open.
    activeSourceItems = appStore.isGuestItemsActive
      ? appStore.items
      : appStore.loadGuestItems();
    return activeSourceItems;
  };

  const colorFamilyMap = {
    '無彩色系': '無彩色系', '白色': '無彩色系', '黑色': '無彩色系', '炭灰色': '無彩色系', '米白色': '無彩色系', '白色系': '無彩色系', '黑色系': '無彩色系', '灰色系': '無彩色系',
    '大地色系': '大地色系', '卡其色': '大地色系', '奶茶色': '大地色系', '棕色': '大地色系', '米色': '大地色系', '棕色系': '大地色系', '米色系': '大地色系',
    '清甜暖色系': '清甜暖色系', '暖橙色': '清甜暖色系', '奶油黃': '清甜暖色系', '櫻花粉': '清甜暖色系', '芥末黃': '清甜暖色系',
    '藍綠冷色系': '藍綠冷色系', '丹寧藍': '藍綠冷色系', '天藍色': '藍綠冷色系', '軍綠色': '藍綠冷色系', '酪梨綠': '藍綠冷色系', '藍色系': '藍綠冷色系',
    '紫紅神秘系': '紫紅神秘系', '酒紅色': '紫紅神秘系', '薰衣草紫': '紫紅神秘系', '玫瑰紅': '紫紅神秘系', '葡萄紫': '紫紅神秘系'
  };

  const aggregateLocalClosetStats = (sourceItems = appStore.items) => {
    const visibleItems = sourceItems.filter((item) => item.hidden !== true && item.hidden !== 'true');
    const groupBy = (field, includeColor) => {
      return Object.values(
        visibleItems.reduce((groups, item) => {
          let value = item[field];
          if (field === 'secondary_color') {
            value = colorFamilyMap[String(item[field] || '').trim()] || getColorFamilyForPrimaryColor(item.primary_color) || '未分類';
          }
          const groupValue = value || '未分類';
          if (!groups[groupValue]) {
            groups[groupValue] = {
              [field === 'primary_color' ? 'color' : field]: groupValue,
              count: 0
            };
          }
          groups[groupValue].count += 1;
          if (includeColor && !groups[groupValue].color_hex) {
            groups[groupValue].color_hex = item.color_hex || '#D8D2C8';
          }
          return groups;
        }, {})
      );
    };

    return {
      colorStats: groupBy('primary_color', true),
      colorFamilyStats: groupBy('secondary_color', false),
      styleStats: groupBy('style', false),
      categoryStats: groupBy('category', false)
    };
  };

  const getClosetStats = async () => {
    const sourceItems = await ensureDataSource();
    return aggregateLocalClosetStats(sourceItems);
  };

  const getBrandStats = async () => {
    const sourceItems = await ensureDataSource();

    const groups = {};
    sourceItems
      .filter((item) => item.hidden !== true && item.hidden !== 'true')
      .forEach((item) => {
        const displayBrand = String(item.brand || '').trim();
        const brandKey = displayBrand.toLowerCase() || '未分類';
        if (!groups[brandKey]) {
          groups[brandKey] = { brand: displayBrand || '未分類', count: 0, totalWearCount: 0 };
        }
        groups[brandKey].count += 1;
        groups[brandKey].totalWearCount += Number(item.wear_count || 0);
      });

    return Object.values(groups)
      .sort((a, b) => b.count - a.count || b.totalWearCount - a.totalWearCount)
      .slice(0, 10);
  };

  const getTopWornItems = async () => {
    const sourceItems = await ensureDataSource();

    return [...sourceItems]
      .filter((item) => item.hidden !== true && item.hidden !== 'true')
      .sort((a, b) => Number(b.wear_count || 0) - Number(a.wear_count || 0));
  };

  const getCostPerWearRanking = async () => {
    const sourceItems = await ensureDataSource();

    return [...sourceItems]
      .filter((item) => item.hidden !== true && item.hidden !== 'true' && closetStore.calculateCostPerWear(item) !== null)
      .sort((a, b) => (closetStore.calculateCostPerWear(a) || 0) - (closetStore.calculateCostPerWear(b) || 0))
      .map((item) => ({
        ...item,
        cost_per_wear: closetStore.calculateCostPerWear(item)
      }));
  };

  const getDisusedRanking = async () => {
    const sourceItems = await ensureDataSource();
    return sourceItems.filter(closetStore.isDisusedItem);
  };

  const getYearlySummary = (year) => {
    const targetYear = Number(year);
    const visibleItems = activeSourceItems.filter((item) => item.hidden !== true && item.hidden !== 'true');

    const purchasedInYear = visibleItems.filter((item) => {
      if (!item.purchase_date) return false;
      const d = new Date(item.purchase_date);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });

    const wornInYear = visibleItems.filter((item) => {
      if (!item.last_worn) return false;
      const d = new Date(item.last_worn);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear;
    });

    // 1. 年度最愛顏色
    const colorCounts = {};
    const colorWearSums = {};
    purchasedInYear.forEach((item) => {
      const c = String(item.primary_color || '').trim();
      if (!c) return;
      colorCounts[c] = (colorCounts[c] || 0) + 1;
      colorWearSums[c] = (colorWearSums[c] || 0) + Number(item.wear_count || 0);
    });
    const topColorEntry = Object.entries(colorCounts).sort(
      (a, b) => b[1] - a[1] || (colorWearSums[b[0]] || 0) - (colorWearSums[a[0]] || 0)
    )[0];
    const topColor = topColorEntry ? { name: topColorEntry[0], count: topColorEntry[1] } : null;

    // 2. 年度最愛風格
    const styleCounts = {};
    purchasedInYear.forEach((item) => {
      const s = String(item.style || '').trim();
      if (!s) return;
      styleCounts[s] = (styleCounts[s] || 0) + 1;
    });
    const topStyleEntry = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0];
    const topStyle = topStyleEntry ? { name: labels[topStyleEntry[0]] || topStyleEntry[0], count: topStyleEntry[1] } : null;

    // 3. 年度最常穿單品
    const mostWornItem = [...wornInYear].sort((a, b) => Number(b.wear_count || 0) - Number(a.wear_count || 0))[0] || null;

    // 4. 年度最愛品牌
    const brandCounts = {};
    purchasedInYear.forEach((item) => {
      const b = String(item.brand || '').trim();
      if (!b) return;
      brandCounts[b] = (brandCounts[b] || 0) + 1;
    });
    const topBrandEntry = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0];
    const topBrand = topBrandEntry ? { name: topBrandEntry[0], count: topBrandEntry[1] } : null;

    return {
      year: targetYear,
      totalPurchased: purchasedInYear.length,
      topColor,
      topStyle,
      mostWornItem: mostWornItem
        ? {
            name: mostWornItem.name_zh || mostWornItem.name || '未命名單品',
            wearCount: Number(mostWornItem.wear_count || 0)
          }
        : null,
      topBrand
    };
  };

  return {
    getClosetStats,
    getBrandStats,
    getTopWornItems,
    getCostPerWearRanking,
    getDisusedRanking,
    getYearlySummary,
    getSourceItems: () => activeSourceItems
  };
});
