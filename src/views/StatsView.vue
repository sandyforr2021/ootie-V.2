<template>
  <section class="page active" id="statsPage">
    <header class="core-page-hero stats-page-hero">
      <div>
        <h1>{{ $t("衣櫥統計") }}</h1>
        <p class="intro">{{ $t("看看你的衣櫥裡，哪些顏色、風格與類別最常出現。") }}</p>
      </div>
      <p class="core-page-note" aria-hidden="true">your closet<br />in numbers ♡</p>
    </header>

    <WardrobeCosts />

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
            {{ appStore.items.length ? '幫衣服補上品牌資訊，看看你的愛用品牌排行吧！' : $t('尚無資料，快去新增你的第一件衣服吧！') }}
          </div>
          <p v-if="brandHighlight" class="brand-stats-highlight">{{ brandHighlight }}</p>
        </article>

        <!-- 年度 No.1 報告 -->
        <article class="stats-card yearly-summary-card">
          <div class="yearly-summary-header">
            <h3>年度 No.1 報告</h3>
            <select
              v-model="selectedYear"
              class="yearly-summary-select"
              aria-label="選擇年度"
              @change="updateYearlySummary"
            >
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
            </select>
          </div>

          <div v-if="hasYearlyData" class="yearly-summary-table-wrap">
            <table class="yearly-summary-table">
              <thead>
                <tr>
                  <th>統計項目</th>
                  <th>No.1 結果</th>
                  <th>數據佐證</th>
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
            今年還沒有相關紀錄，快去新增單品吧！
          </div>
        </article>
      </div>
    </section>

    <!-- 我的百搭神器 Top 5 -->
    <section class="profile-insights top-worn-section" aria-labelledby="topWornTitle">
      <div class="profile-ootd-heading">
        <h2 id="topWornTitle">我的百搭神器</h2>
        <span class="eyebrow">戰力榜 Top 5</span>
      </div>
      <div class="top-worn-list" v-if="topWornItems.length && topWornItems.some(i => i.wear_count > 0)">
        <article
          v-for="(item, index) in topWornItems.slice(0, 5)"
          :key="item.id"
          :class="['top-worn-item', { 'is-champion': index === 0 }]"
        >
          <span :class="['top-worn-rank', `rank-top-${Math.min(index + 1, 5)}`]" :aria-label="`第 ${index + 1} 名`">
            {{ index === 0 ? '♛' : index + 1 }}
          </span>
          <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy" />
          <div class="top-worn-copy">
            <h3>{{ item.name_zh || item.name }}</h3>
            <p>穿了 {{ item.wear_count }}{{ $t("次") }}</p>
          </div>
        </article>
      </div>
      <div v-else class="top-worn-empty">
        還沒有穿搭紀錄，開始記錄你的第一次穿搭吧！
      </div>
    </section>

    <!-- 冷宮衣物排名 完整清單 -->
    <section class="profile-insights disused-ranking-section" aria-labelledby="disusedRankingTitle">
      <div class="profile-ootd-heading">
        <h2 id="disusedRankingTitle">冷宮衣物排名</h2>
        <span class="eyebrow">完整清單</span>
      </div>
      <div class="disused-ranking" v-if="disusedRanking.length">
        <article
          v-for="(item, index) in disusedRanking"
          :key="item.id"
          class="disused-ranking-item"
        >
          <span :class="['disused-rank', `rank-top-${Math.min(index + 1, 5)}`]" :aria-label="`第 ${index + 1} 名`">
            {{ index === 0 ? '♛' : index + 1 }}
          </span>
          <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy" />
          <div class="disused-ranking-copy">
            <h3>{{ item.name_zh || item.name }}</h3>
            <p>{{ getDisusedMessage(item) }}</p>
            <span>{{ $t("穿著") }}{{ item.wear_count || 0 }}{{ $t("次") }}{{
                closetStore.getDaysSinceLastWorn(item.last_worn) !== null
                  ? ` · ${closetStore.getDaysSinceLastWorn(item.last_worn)} 天前`
                  : ' · 尚未穿過'
              }}
            </span>
          </div>
        </article>
      </div>
      <div v-else class="disused-empty">{{ $t("太棒了！你的每件衣服都很常穿，衣櫥利用率很高！") }}</div>
    </section>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import Chart from 'chart.js/auto';
import WardrobeCosts from '@/components/closet/WardrobeCosts.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { useStatsStore } from '@/stores/stats';
import { labels } from '@/constants';

const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
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
const costRanking = ref([]);
const disusedRanking = ref([]);

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

const getDisusedMessage = (item) => {
  const days = closetStore.getDaysSinceLastWorn(item.last_worn);
  if (item.wear_count === 0 && !item.last_worn) {
    return '你從來沒穿過耶！';
  }
  if (days !== null) {
    return `已經 ${days} 天沒穿囉！`;
  }
  return `只穿過 ${Number(item.wear_count || 0)} 次。`;
};

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
        labels: colorStats.value.map((e) => labels[e.color] || e.color),
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
              label: (context) => ` ${context.raw} 件`
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
        labels: colorFamilyStats.value.map((e) => labels[e.secondary_color] || e.secondary_color),
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
              label: (context) => ` ${context.raw} 件`
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
        labels: styleStats.value.map((e) => labels[e.style] || e.style),
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
              label: (context) => ` ${context.raw} 件`
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
        labels: categoryStats.value.map((e) => labels[e.category] || e.category),
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
              label: (context) => ` ${context.raw} 件`
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
              label: (context) => ` ${context.raw} 件`
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

  yearlyRows.value = [
    {
      icon: '🏆 年度最愛顏色',
      result: summary.topColor ? summary.topColor.name : '今年還沒有相關紀錄',
      proof: summary.topColor ? `共購入 ${summary.topColor.count} 件` : '無數據'
    },
    {
      icon: '🏆 年度最愛風格',
      result: summary.topStyle ? summary.topStyle.name : '今年還沒有相關紀錄',
      proof: summary.topStyle ? `共購入 ${summary.topStyle.count} 件` : '無數據'
    },
    {
      icon: '🏆 年度最常穿單品',
      result: summary.mostWornItem ? summary.mostWornItem.name : '今年還沒有相關紀錄',
      proof: summary.mostWornItem ? `共穿著 ${summary.mostWornItem.wearCount} 次` : '無數據'
    },
    {
      icon: '🏆 年度最愛品牌',
      result: summary.topBrand ? summary.topBrand.name : '今年還沒有相關紀錄',
      proof: summary.topBrand ? `共購入 ${summary.topBrand.count} 件` : '無數據'
    }
  ];

  const colorText = summary.topColor ? `${summary.topColor.name}的` : '';
  const styleText = summary.topStyle ? `${summary.topStyle.name}風格` : '風格多樣的';
  const brandText = summary.topBrand ? `最愛的品牌是 ${summary.topBrand.name}` : '嘗試了許多不同品牌';
  const itemText = summary.mostWornItem ? `而穿最兇的單品是${summary.mostWornItem.name}！` : '目前還沒有特別頻繁穿著的單品。';

  yearlyQuote.value = `「你 ${selectedYear.value} 年最常買${colorText}${styleText}衣服，${brandText}，${itemText}」`;
  yearlyWarning.value = summary.totalPurchased > 0 && summary.totalPurchased < 3 ? `⚠️ 提醒：${selectedYear.value} 年購入單品少於 3 件，統計僅供參考。` : '';
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
  brandHighlight.value = mostWorn && mostWorn.totalWearCount > 0 ? `你最常穿的品牌是 ${mostWorn.brand}，共有 ${mostWorn.count} 件單品\n總共穿了 ${mostWorn.totalWearCount} 次！` : '';

  // 3. Top worn items
  topWornItems.value = await statsStore.getTopWornItems();

  // 4. Cost ranking
  costRanking.value = await statsStore.getCostPerWearRanking();

  // 5. Disused ranking
  disusedRanking.value = await statsStore.getDisusedRanking();

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
