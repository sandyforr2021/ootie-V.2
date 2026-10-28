<script setup>
import { computed, onMounted } from 'vue';
import { moneyQuote } from '@/services/money';
import { ensureExchangeRates } from '@/services/exchangeRates';
const props = defineProps({ amount: { type: [Number, String], default: null }, currency: { type: String, default: 'TWD' } });
const quote = computed(() => moneyQuote(props.amount, props.currency));
onMounted(() => { void ensureExchangeRates(); });
</script>
<template>
  <span class="money-amount"><span>{{ quote.formatted }}</span><small v-if="quote.converted">{{ $t('原幣金額') }} {{ quote.original }}</small><small v-else-if="quote.unavailable">{{ $t('暫以原幣顯示') }}</small></span>
</template>
<style scoped>
.money-amount{display:inline-flex;flex-direction:column;gap:3px;line-height:1.5;font-variant-numeric:tabular-nums}.money-amount small{font-size:11px;font-weight:400;color:var(--muted);white-space:normal}
</style>
