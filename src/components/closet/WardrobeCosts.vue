<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { wardrobeCosts } from '@/services/money';
import MoneyAmount from '@/components/ui/MoneyAmount.vue';
import CurrencyNotice from '@/components/ui/CurrencyNotice.vue';
import { itemName } from '@/services/itemPresentation';
const app = useAppStore();
const groups = computed(() => wardrobeCosts(app.items));
const open = id => { app.selectedItemId = id; app.isDetailOpen = true; };
</script>

<template>
  <section class="wardrobe-costs" aria-labelledby="wardrobe-cost-title">
    <div class="cost-heading"><div><span class="eyebrow">{{ $t('衣櫥帳本') }}</span><h2 id="wardrobe-cost-title">{{ $t('每件衣服，都有更多可能。') }}</h2></div><p>{{ $t('每次穿著成本＝購買金額 ÷ 已記錄穿著次數。不同幣別分開統計。') }}</p></div>
    <CurrencyNotice />
    <div v-if="!groups.length" class="cost-empty"><p>{{ $t('加入衣物與購買金額，開始記錄你的衣櫥開銷。') }}</p><router-link class="secondary" to="/closet?quick=add-item">{{ $t('新增衣物') }}</router-link></div>
    <section v-for="group in groups" :key="group.currency" class="cost-currency-group" :aria-label="group.currency">
      <header class="cost-summary"><div><small>{{ $t('已記錄購買金額') }} · {{ group.currency }}</small><strong><MoneyAmount :amount="group.priced ? group.total : null" :currency="group.currency" /></strong></div><dl><div><dt>{{ $t('已填金額') }}</dt><dd>{{ group.priced }}</dd></div><div><dt>{{ $t('金額未填') }}</dt><dd>{{ group.unknown }}</dd></div><div><dt>{{ $t('已記錄穿著') }}</dt><dd>{{ group.wears }}</dd></div></dl></header>
      <div class="cost-table-wrap" tabindex="0" :aria-label="$t('衣物成本明細')"><table><thead><tr><th scope="col">{{ $t('衣物') }}</th><th scope="col">{{ $t('購買金額') }}</th><th scope="col">{{ $t('穿著次數') }}</th><th scope="col">{{ $t('每次穿著成本') }}</th><th scope="col">{{ $t('購買日期') }}</th></tr></thead><tbody><tr v-for="item in group.rows" :key="item.id"><th scope="row"><button class="cost-item" @click="open(item.id)"><img v-if="item.photo" :src="item.photo" alt="" loading="lazy"><span>{{ itemName(item) }}</span></button></th><td><MoneyAmount :amount="item.price" :currency="group.currency" /></td><td>{{ item.wear_count || 0 }}</td><td><MoneyAmount :amount="item.costPerWear" :currency="group.currency" /></td><td>{{ item.purchase_date || '—' }}</td></tr></tbody></table></div>
    </section>
    <p class="cost-footnote">{{ $t('未填金額及尚未記錄穿著的衣物，不會被算成零成本。換算金額依參考匯率顯示。') }}</p>
  </section>
</template>

<style scoped>
.wardrobe-costs{margin:30px 0 46px}.cost-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}.cost-heading h2{font-family:var(--font-display);font-size:clamp(24px,3vw,34px);line-height:1.25;margin:9px 0 0}.cost-heading p{max-width:330px;color:var(--muted);font-size:12px;line-height:1.7}.cost-currency-group{border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:20px 0;background:var(--surface-raised,#fffdf8)}.cost-summary{padding:24px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--accent-blue-soft,#e8f3f8)}.cost-summary small{font-size:11px;color:var(--muted)}.cost-summary strong{display:block;font-size:28px;letter-spacing:-.03em;margin-top:5px;font-variant-numeric:tabular-nums}.cost-summary dl{display:flex;gap:28px;margin:0}.cost-summary dt{font-size:11px;color:var(--muted);margin-bottom:8px}.cost-summary dd{font-size:21px;margin:0;font-variant-numeric:tabular-nums}.cost-table-wrap{overflow-x:auto}.cost-table-wrap table{border-collapse:collapse;width:100%;min-width:600px;font-size:12px}.cost-table-wrap th,.cost-table-wrap td{padding:15px 20px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.cost-table-wrap th:first-child{text-align:left;min-width:210px}.cost-table-wrap thead{font-size:11px;color:var(--muted)}.cost-table-wrap tbody tr:last-child>*{border:0}.cost-item{display:flex;align-items:center;gap:12px;color:var(--ink);border:0;padding:0;background:none;text-align:left;white-space:normal;max-width:290px;line-height:1.5}.cost-item:hover span{text-decoration:underline}.cost-item img{width:38px;height:48px;object-fit:contain;border-radius:6px;background:#fff}.cost-footnote,.cost-empty{font-size:12px;color:var(--muted);line-height:1.7}.cost-empty{padding:28px;background:var(--accent-yellow-soft,#fff5d0);border-radius:16px}.cost-empty a{margin-top:10px}@media(max-width:650px){.cost-heading{display:block}.cost-heading p{max-width:none;margin-top:14px}.cost-summary{display:block;padding:20px}.cost-summary dl{margin-top:22px;justify-content:space-between;gap:12px}.cost-table-wrap th,.cost-table-wrap td{padding:12px 16px}}
</style>
