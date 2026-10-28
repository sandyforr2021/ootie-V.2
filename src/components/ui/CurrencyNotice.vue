<script setup>
import { onMounted } from 'vue';
import { defaultCurrency } from '@/services/money';
import { exchangeRates, exchangeRatesLoading, ensureExchangeRates } from '@/services/exchangeRates';
onMounted(() => { void ensureExchangeRates(); });
</script>
<template>
  <p class="currency-notice">{{ $t('顯示幣別') }}: {{ defaultCurrency() }} ·
    <template v-if="exchangeRates">{{ $t('參考匯率日期') }}: {{ exchangeRates.date }} · {{ $t('約算金額僅供參考，原幣金額不變。') }} <a href="https://github.com/fawazahmed0/exchange-api" target="_blank" rel="noopener noreferrer">{{ $t('匯率來源') }}</a></template>
    <template v-else>{{ $t(exchangeRatesLoading ? '正在取得匯率，暫以原幣顯示。' : '匯率暫時無法取得，保留原幣金額。') }}</template>
  </p>
</template>
<style scoped>
.currency-notice{font-size:11px;line-height:1.7;color:var(--muted);margin:12px 0;overflow-wrap:anywhere}.currency-notice a{color:inherit;text-decoration:underline}
</style>
