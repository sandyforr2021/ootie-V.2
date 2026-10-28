<template>
  <section class="page active app-page" id="statsPage">
    <header class="core-page-hero stats-page-hero ootie-page-heading">
      <div>
        <h1>{{ $t("衣櫥統計") }}</h1>
      </div>
    </header>

    <!-- 個人統計區塊 -->
    <section class="profile-insights" aria-labelledby="closetStatsTitle">
      <div class="profile-ootd-heading">
        <h2 id="closetStatsTitle">{{ $t("個人統計") }}</h2>
        <span class="eyebrow">{{ $t("可見單品") }}</span>
      </div>

      <div class="stats-grid">
        <!-- 顏色分布 -->
        <article class="stats-card">
          <h3>{{ $t("顏色分布") }}</h3>
          <div class="chart-wrap" v-show="hasColorStats">
            <canvas ref="colorChartRef" aria-label="衣櫥顏色分布圖表"></canvas>
          </div>
          <div v-show="!hasColorStats" class="stats-empty"> {{ $t("尚無資料，快去新增你的第一件衣服吧！") }} </div>
        </article>

        <!-- 色系分布 -->
        <article class="stats-card">
          <h3>{{ $t("色系分布") }}</h3>
          <div class="chart-wrap" v-show="hasColorFamilyStats">
            <canvas ref="colorFamilyChartRef" aria-label="衣櫥色系分布圖表"></canvas>
          </div>
          <div v-show="!hasColorFamilyStats" class="stats-empty"> {{ $t("尚無資料，快去新增你的第一件衣服吧！") }} </div>
        </article>

        <!-- 風格分布 -->
        <article class="stats-card">
          <h3>{{ $t("風格分布") }}</h3>
          <div class="chart-wrap" v-show="hasStyleStats">
            <canvas ref="styleChartRef" aria-label="衣櫥風格分布圖表"></canvas>
          </div>
          <div v-show="!hasStyleStats" class="stats-empty"> {{ $t("尚無資料，快去新增你的第一件衣服吧！") }} </div>
        </article>

        <!-- 類別佔比 -->
        <article class="stats-card">
          <h3>{{ $t("類別佔比") }}</h3>
          <div class="chart-wrap" v-show="hasCategoryStats">
            <canvas ref="categoryChartRef" aria-label="衣櫥類別佔比圖表"></canvas>
          </div>
          <div v-show="!hasCategoryStats" class="stats-empty"> {{ $t("尚無資料，快去新增你的第一件衣服吧！") }} </div>
        </article>

        <!-- 我的愛用品牌 -->
        <article class="stats-card brand-stats-card">
          <h3>{{ $t("我的愛用品牌") }}</h3>
          <div class="chart-wrap" v-show="hasBrandStats">
            <canvas ref="brandChartRef" aria-label="我的愛用品牌單品數量圖表"></canvas>
          </div>
          <div v-show="!hasBrandStats" class="stats-empty">
            {{ appStore.items.length ? $t('補上品牌資訊，查看衣櫥品牌分布。') : $t('尚無資料，快去新增你的第一件衣服吧！') }}
          </div>
          <p v-if="brandHighlight" class="brand-stats-highlight">{{ brandHighlight }}</p>
        </article>

        <!-- 年度 No.1 報告 -->
        <article class="stats-card yearly-summary-card">
          <div class="yearly-summary-header">
            <h3>{{ $t('年度衣櫥回顧') }}</h3>
            <select
              v-model="selectedYear"
              class="yearly-summary-select"
              :aria-label="$t('選擇年度')"
              @change="updateYearlySummary"
            >
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>

          <div v-if="hasYearlyData" class="yearly-summary-table-wrap">
            <table class="yearly-summary-table">
              <thead>
                <tr>
                  <th>{{ $t('統計項目') }}</th>
                  <th>{{ $t('重點紀錄') }}</th>
                  <th>{{ $t('紀錄數量') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in yearlyRows" :key="idx">
                  <td>{{ row.icon }}</td>
                  <td>{{ row.result }}</td>
                  <td>{{ row.proof }}</td>
                </tr>
              </tbody>
            </table>
            <p class="yearly-summary-quote">
              {{ yearlyQuote }}
              <span v-if="yearlyWarning" class="yearly-summary-warning">
                {{ yearlyWarning }}
              </span>
            </p>
          </div>
          <div v-else class="stats-empty">
            {{ $t('所選年度尚無購買或穿著日期紀錄。') }}
          </div>
        </article>
      </div>
    </section>

    <!-- 我的百搭神器 Top 5 -->
    <section class="profile-insights top-worn-section" aria-labelledby="topWornTitle">
      <div class="profile-ootd-heading">
        <h2 id="topWornTitle">{{ $t('OOTD 熱門單品') }}</h2>
        <span class="eyebrow">{{ $t('OOTD 出現次數 Top 5') }}</span>
      </div>
      <div class="top-worn-list" v-if="topWornItems.length">
        <article
          v-for="(item, index) in topWornItems.slice(0, 5)"
          :key="item.id"
          :class="['top-worn-item', { 'is-champion': index === 0 }]"
        >
          <span :class="['top-worn-rank', `rank-top-${Math.min(index + 1, 5)}`]" :aria-label="tf('第 {rank} 名', {rank:index+1})">
            {{ index === 0 ? '♛' : index + 1 }}
          </span>
          <WardrobeCutout class="product-image" :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" />
          <div class="top-worn-copy">
            <h3>{{ itemName(item) }}</h3>
            <p>{{ tf('出現在 {count} 篇 OOTD', { count: item.ootd_count }) }}</p>
          </div>
        </article>
      </div>
      <div v-else class="top-worn-empty">
        {{ $t(ootdStatsError ? 'OOTD 統計暫時無法載入。' : '尚無標記衣物的 OOTD。') }}
      </div>
    </section>

    <!-- 冷宮衣物排名 完整清單 -->
    <section class="profile-insights disused-ranking-section" aria-labelledby="disusedRankingTitle">
      <div class="profile-ootd-heading">
        <h2 id="disusedRankingTitle">{{ $t('OOTD 單品紀錄') }}</h2>
      </div>
      <div class="disused-ranking" v-if="topWornItems.length">
        <article
          v-for="(item, index) in topWornItems"
          :key="item.id"
          class="disused-ranking-item"
        >
          <span :class="['disused-rank', `rank-top-${Math.min(index + 1, 5)}`]" :aria-label="tf('第 {rank} 名', {rank:index+1})">
            {{ index === 0 ? '♛' : index + 1 }}
          </span>
          <WardrobeCutout class="product-image" :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" />
          <div class="disused-ranking-copy">
            <h3>{{ itemName(item) }}</h3>
            <span>{{ tf('出現在 {count} 篇 OOTD', { count:item.ootd_count }) }}</span>
          </div>
        </article>
      </div>
      <div v-else class="disused-empty">{{ $t(ootdStatsError ? 'OOTD 統計暫時無法載入。' : '尚無標記衣物的 OOTD。') }}</div>
    </section>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import Chart from 'chart.js/auto';
import { fetchProfileOotdPosts } from '@/services/supabase';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useStatsStore } from '@/stores/stats';
import { labels } from '@/constants';
import { t, tf, locale } from '@/i18n';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WardrobeCutout from '@/components/closet/WardrobeCutout.vue';

const appStore = useAppStore();
const authStore = useAuthStore();
const statsStore = useStatsStore();

// Chart canvas refs
const colorChartRef = ref(null);
const colorFamilyChartRef = ref(null);
const styleChartRef = ref(null);
const categoryChartRef = ref(null);
const brandChartRef = ref(null);

let charts = {};

// Data states
const colorStats = ref([]);
const colorFamilyStats = ref([]);
const styleStats = ref([]);
const categoryStats = ref([]);
const brandStats = ref([]);
const brandHighlight = ref('');
const topWornItems = ref([]);
const ootdStatsError = ref(false);

// Yearly summary states
const availableYears = ref([]);
const selectedYear = ref(new Date().getFullYear());
const yearlyRows = ref([]);
const yearlyQuote = ref('');
const yearlyWarning = ref('');
const hasYearlyData = ref(false);

const hasColorStats = computed(() => colorStats.value.some((e) => Number(e.count) > 0));
const hasColorFamilyStats = computed(() => colorFamilyStats.value.some((e) => Number(e.count) > 0));
const hasStyleStats = computed(() => styleStats.value.some((e) => Number(e.count) > 0));
const hasCategoryStats = computed(() => categoryStats.value.some((e) => Number(e.count) > 0));
const hasBrandStats = computed(() => {
  const named = brandStats.value.filter((e) => e.brand !== '未分類');
  const unnamed = brandStats.value.find((e) => e.brand === '未分類')?.count || 0;
  const namedCount = named.reduce((sum, e) => sum + e.count, 0);
  return named.length > 0 && unnamed < namedCount;
});

const destroyCharts = () => {
  Object.keys(charts).forEach((key) => {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  });
};

const renderAllCharts = async () => {
  await nextTick();
  destroyCharts();

  const chartColors = ['#F4A9BD', '#F7DD69', '#A9D8F2', '#C8B7EF', '#B8DEC8', '#232127'];
  const colorFamilyColors = {
    '無彩色系': '#D9D7D9',
    '大地色系': '#D9BFA7',
    '清甜暖色系': '#F4A9BD',
    '藍綠冷色系': '#A9D8F2',
    '紫紅神秘系': '#C8B7EF'
  };

  // 1. 顏色分布
  if (colorChartRef.value && hasColorStats.value) {
    charts.color = new Chart(colorChartRef.value, {
      type: 'doughnut',
      data: {
        labels: colorStats.value.map((e) => t(labels[e.color] || e.color)),
        datasets: [
          {
            data: colorStats.value.map((e) => e.count),
            backgroundColor: colorStats.value.map((e, idx) => e.color_hex || chartColors[idx % chartColors.length]),
            borderColor: '#F8F7F3',
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => tf('{count} 件衣物', {count:context.raw})
            }
          }
        }
      }
    });
  }

  // 2. 色系分布
  if (colorFamilyChartRef.value && hasColorFamilyStats.value) {
    charts.colorFamily = new Chart(colorFamilyChartRef.value, {
      type: 'doughnut',
      data: {
        labels: colorFamilyStats.value.map((e) => t(labels[e.secondary_color] || e.secondary_color)),
        datasets: [
          {
            data: colorFamilyStats.value.map((e) => e.count),
            backgroundColor: colorFamilyStats.value.map((e) => colorFamilyColors[e.secondary_color] || '#C8A98A'),
            borderColor: '#F8F7F3',
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => tf('{count} 件衣物', {count:context.raw})
            }
          }
        }
      }
    });
  }

  // 3. 風格分布
  if (styleChartRef.value && hasStyleStats.value) {
    charts.style = new Chart(styleChartRef.value, {
      type: 'bar',
      data: {
        labels: styleStats.value.map((e) => t(labels[e.style] || e.style)),
        datasets: [
          {
            data: styleStats.value.map((e) => e.count),
            backgroundColor: '#C8B7EF',
            borderRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => tf('{count} 件衣物', {count:context.raw})
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#77766F', font: { family: 'DM Sans', size: 10 } }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#77766F', font: { family: 'DM Sans', size: 10 } },
            grid: { color: '#E7E3DC' }
          }
        }
      }
    });
  }

  // 4. 類別佔比
  if (categoryChartRef.value && hasCategoryStats.value) {
    charts.category = new Chart(categoryChartRef.value, {
      type: 'doughnut',
      data: {
        labels: categoryStats.value.map((e) => t(labels[e.category] || e.category)),
        datasets: [
          {
            data: categoryStats.value.map((e) => e.count),
            backgroundColor: chartColors,
            borderColor: '#F8F7F3',
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#77766F',
              font: { family: 'DM Sans', size: 11 },
              padding: 14,
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => tf('{count} 件衣物', {count:context.raw})
            }
          }
        }
      }
    });
  }

  // 5. 愛用品牌
  if (brandChartRef.value && hasBrandStats.value) {
    const namedStats = brandStats.value.filter((e) => e.brand !== '未分類');
    charts.brand = new Chart(brandChartRef.value, {
      type: 'bar',
      data: {
        labels: namedStats.map((e) => e.brand),
        datasets: [
          {
            data: namedStats.map((e) => e.count),
            backgroundColor: '#A9D8F2',
            borderRadius: 7,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => tf('{count} 件衣物', {count:context.raw})
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#77766F', font: { family: 'DM Sans', size: 10 } },
            grid: { color: '#E7E3DC' }
          },
          y: {
            ticks: { color: '#77766F', font: { family: 'DM Sans', size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }
};

const updateYearlySummary = () => {
  const summary = statsStore.getYearlySummary(selectedYear.value);
  const hasData = !!(summary.topColor || summary.topStyle || summary.mostWornItem || summary.topBrand);
  hasYearlyData.value = hasData;

  if (!hasData) return;

  const unavailable = t('所選年度尚無相關紀錄');
  const purchased = count => tf('已記錄購入 {count} 件', { count });
  yearlyRows.value = [
    {icon:t('年度最常購入顏色'),result:summary.topColor ? t(summary.topColor.name) : unavailable,proof:summary.topColor ? purchased(summary.topColor.count) : '—'},
    {icon:t('年度最常購入風格'),result:summary.topStyle ? t(summary.topStyle.name) : unavailable,proof:summary.topStyle ? purchased(summary.topStyle.count) : '—'},
    {icon:t('年度內有穿著紀錄的愛用單品'),result:summary.mostWornItem ? summary.mostWornItem.name : unavailable,proof:summary.mostWornItem ? tf('累計記錄 {count} 次穿著', {count:summary.mostWornItem.wearCount}) : '—'},
    {icon:t('年度最常購入品牌'),result:summary.topBrand?.name || unavailable,proof:summary.topBrand ? purchased(summary.topBrand.count) : '—'}
  ];
  yearlyQuote.value = t('購買統計依填寫的日期；單品穿著次數為累計紀錄。');
  yearlyWarning.value = summary.totalPurchased > 0 && summary.totalPurchased < 3 ? t('此年度的購買紀錄較少，仍可持續補充。') : '';

};

const loadData = async () => {
  // 1. Closet stats
  const stats = await statsStore.getClosetStats();
  colorStats.value = stats.colorStats || [];
  colorFamilyStats.value = stats.colorFamilyStats || [];
  styleStats.value = stats.styleStats || [];
  categoryStats.value = stats.categoryStats || [];

  // 2. Brand stats
  const brands = await statsStore.getBrandStats();
  brandStats.value = brands || [];
  const namedBrands = brands.filter((e) => e.brand !== '未分類');
  const mostWorn = [...namedBrands].sort((a, b) => b.totalWearCount - a.totalWearCount)[0];
  brandHighlight.value = mostWorn && mostWorn.totalWearCount > 0 ? tf('{brand} · {count} 件衣物，累計記錄 {wears} 次穿著', {brand:mostWorn.brand,count:mostWorn.count,wears:mostWorn.totalWearCount}) : '';

  // OOTD post item_ids are the persisted source of truth; count each item once per post.
  const profileId = authStore.profileId;
  const posts = profileId ? await fetchProfileOotdPosts(profileId) : [];
  if (profileId !== authStore.profileId) return;
  ootdStatsError.value = profileId && !Array.isArray(posts);
  const counts = new Map();
  for (const post of posts || []) {
    for (const id of new Set((post.item_ids || []).map(String))) counts.set(id, (counts.get(id) || 0) + 1);
  }
  topWornItems.value = statsStore.getSourceItems().map(item => ({ ...item, ootd_count: counts.get(String(item.id)) || 0 }))
    .filter(item => item.ootd_count > 0 && item.hidden !== true && item.hidden !== 'true')
    .sort((a, b) => b.ootd_count - a.ootd_count);

  // 6. Calculate available years for yearly report
  const yearsSet = new Set();
  statsStore.getSourceItems().forEach((item) => {
    if (item.purchase_date) {
      const y = new Date(item.purchase_date).getFullYear();
      if (!Number.isNaN(y)) yearsSet.add(y);
    }
    if (item.last_worn) {
      const y = new Date(item.last_worn).getFullYear();
      if (!Number.isNaN(y)) yearsSet.add(y);
    }
  });
  yearsSet.add(new Date().getFullYear());
  availableYears.value = [...yearsSet].sort((a, b) => b - a);
  if (!availableYears.value.includes(selectedYear.value)) {
    selectedYear.value = availableYears.value[0];
  }

  updateYearlySummary();
  await renderAllCharts();
};

watch(locale, () => { void loadData(); });

onMounted(() => {
  loadData();
});

onBeforeUnmount(() => {
  destroyCharts();
});

watch(
  () => appStore.items,
  () => {
    loadData();
  },
  { deep: true }
);

watch(
  () => authStore.profileIdentity.status,
  () => {
    loadData();
  }
);
</script>
<style scoped>
#statsPage .top-worn-item .product-image,#statsPage .disused-ranking-item .product-image{object-fit:contain;background:#fff;padding:10px;box-sizing:border-box}
</style>
