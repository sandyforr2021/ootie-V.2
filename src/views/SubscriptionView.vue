<template>
  <section v-if="!auth.isMember" class="page active profile-locked-state">
    <p class="eyebrow">OOTIE Member Access</p>
    <h1>登入後查看方案與點數</h1>
    <p class="intro">登入即可查看目前方案、可用點數與使用紀錄。</p>
    <button class="primary" @click="auth.openAuthModal('login', null, '/membership')">會員登入</button>
  </section>
  <section v-else class="page active membership-page">
    <div class="membership-hero">
      <div>
        <p class="eyebrow">OOTIE Membership</p>
        <h1>方案與 OOTIE 點數</h1>
        <p class="intro">選擇適合你的方案，管理 AI 點數與查看每一筆點數紀錄。</p>
      </div>
      <div class="points-balance-card">
        <span>目前點數</span>
        <strong>{{ store.pointsBalance }}</strong>
        <small>每日 AI 圖片上限仍為 3 張，與點數分開計算。</small>
      </div>
    </div>

    <section class="membership-section">
      <div class="section-heading"><h2>訂閱方案</h2><span class="eyebrow">目前方案 · {{ store.currentPlan }}</span></div>
      <CurrencyNotice />
      <div class="plan-grid">
        <article v-for="plan in store.plans" :key="plan.id" :class="['plan-card', { current: store.currentPlan === plan.id }]">
          <span v-if="store.currentPlan === plan.id" class="plan-badge">目前方案</span>
          <h3>{{ plan.name }}</h3>
          <p class="plan-price"><MoneyAmount :amount="plan.monthlyPrice" currency="TWD" /> <small>/ 月</small></p>
          <p>{{ plan.description }}</p>
          <strong>每月 {{ plan.monthlyPoints }} 點</strong>
          <button class="primary" :disabled="store.loading || store.currentPlan === plan.id" @click="openPlanCheckout(plan.id)">
            {{ store.currentPlan === plan.id ? '目前使用中' : '升級方案' }}
          </button>
        </article>
      </div>
      <button v-if="store.subscription?.status === 'ACTIVE' && store.currentPlan !== 'FREE'" class="secondary cancel-demo" :disabled="store.loading" @click="store.cancel()">取消方案</button>
    </section>

    <section class="membership-section">
      <div class="section-heading"><h2>點數補給</h2><span>選擇需要的點數包</span></div>
      <div class="credit-grid">
        <article v-for="pack in store.creditPacks" :key="pack.id" class="credit-card">
          <div><strong>{{ pack.name }}</strong><span>＋{{ pack.points }} 點</span></div>
          <button class="secondary" :disabled="store.loading" @click="openCreditCheckout(pack.id)">購買點數 · <MoneyAmount :amount="pack.price" currency="TWD" /></button>
        </article>
      </div>
    </section>

    <section class="membership-section">
      <div class="section-heading"><h2>點數紀錄</h2><span>生日獎勵每年最多一次</span></div>
      <div v-if="store.transactions.length" class="transaction-list">
        <article v-for="entry in store.transactions" :key="entry.id" class="transaction-row">
          <div><strong>{{ labelFor(entry) }}</strong><small>{{ formatDate(entry.created_at) }}</small></div>
          <span :class="entry.amount >= 0 ? 'credit' : 'debit'">{{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}</span>
        </article>
      </div>
      <div v-else class="empty-state">尚無點數紀錄。</div>
    </section>

    <div v-if="store.checkout" class="checkout-backdrop" @click.self="store.closeCheckout()">
      <section class="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <button class="checkout-close" type="button" aria-label="關閉訂單摘要" :disabled="store.checkout.status === PAYMENT_STATUS.PENDING" @click="store.closeCheckout()">×</button>
        <p class="eyebrow">訂單摘要</p>
        <h2 id="checkout-title">{{ checkoutHeading }}</h2>

        <template v-if="store.checkout.status === PAYMENT_STATUS.DRAFT || store.checkout.status === PAYMENT_STATUS.PENDING">
          <dl class="order-summary">
            <div><dt>項目</dt><dd>{{ store.checkout.title }}</dd></div>
            <div><dt>包含點數</dt><dd>{{ store.checkout.points }} 點</dd></div>
            <div v-if="store.checkout.billingPeriod"><dt>方案週期</dt><dd>每月</dd></div>
            <div class="order-total"><dt>合計</dt><dd><MoneyAmount :amount="store.checkout.amount" currency="TWD" /></dd></div>
          </dl>
          <p class="checkout-note">確認後會更新目前方案或點數餘額；此頁不會要求輸入信用卡資料。</p>
          <div class="checkout-actions">
            <button class="secondary" type="button" :disabled="store.loading" @click="store.closeCheckout()">返回</button>
            <button class="primary" type="button" :disabled="store.loading" @click="store.confirmCheckout()">
              {{ store.loading ? '處理中…' : confirmLabel }}
            </button>
          </div>
        </template>

        <div v-else class="checkout-result" :class="store.checkout.status.toLowerCase()" role="status">
          <span class="checkout-result-mark" aria-hidden="true">{{ store.checkout.status === PAYMENT_STATUS.SUCCEEDED ? '✓' : '!' }}</span>
          <h3>{{ store.checkout.status === PAYMENT_STATUS.SUCCEEDED ? '已完成更新' : '目前無法完成' }}</h3>
          <p>{{ store.checkout.status === PAYMENT_STATUS.SUCCEEDED ? '方案與點數資料已同步至帳戶。' : (store.error || '請稍後再試。') }}</p>
          <button class="primary" type="button" @click="store.closeCheckout()">完成</button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import MoneyAmount from '@/components/ui/MoneyAmount.vue';
import CurrencyNotice from '@/components/ui/CurrencyNotice.vue';
import { computed, watch } from 'vue';
import { useSubscriptionStore } from '@/stores/subscription';
import { useAuthStore } from '@/stores/auth';
import { CHECKOUT_KIND, PAYMENT_STATUS } from '@/contracts/commerce';
const store = useSubscriptionStore();
const auth = useAuthStore();
const openPlanCheckout = (plan) => store.openCheckout(CHECKOUT_KIND.SUBSCRIPTION, plan);
const openCreditCheckout = (pack) => store.openCheckout(CHECKOUT_KIND.CREDIT_PACK, pack);
const checkoutHeading = computed(() => store.checkout?.kind === CHECKOUT_KIND.SUBSCRIPTION ? '訂閱方案確認' : '點數購買確認');
const confirmLabel = computed(() => store.checkout?.kind === CHECKOUT_KIND.SUBSCRIPTION ? '確認方案' : '確認購買');
const labels = { BIRTHDAY_BONUS: '生日點數', SUBSCRIPTION_GRANT: '方案每月點數', CREDIT_PURCHASE: '點數補給', PROMOTIONAL_REWARD: '活動贈點', TRYON_USAGE: '虛擬試穿', AI_USAGE: 'AI 穿搭預覽', MANUAL_ADJUSTMENT: '初始點數' };
const labelFor = (entry) => labels[entry.type] || entry.type;
const formatDate = (value) => new Date(value).toLocaleDateString('zh-TW');
watch(() => auth.profileId, (profileId) => { if (profileId) store.refresh(); }, { immediate: true });
</script>

<style scoped>
.membership-page { max-width: 1180px; margin: 0 auto; padding-bottom: 72px; }
.membership-hero { display: flex; justify-content: space-between; gap: 32px; align-items: center; padding: clamp(26px, 4vw, 44px); border: 1px solid rgba(200,183,239,.48); border-radius: 28px; background: linear-gradient(125deg, var(--accent-lavender-soft), var(--accent-pink-soft) 54%, var(--accent-yellow-soft)); box-shadow: var(--shadow-soft); }
.membership-hero > div:first-child { max-width: 720px; }
.membership-hero h1 { font-family: "DM Sans", sans-serif; font-weight: 800; letter-spacing: -2px; }
.membership-hero .intro { margin-bottom: 0; line-height: 1.7; }
.points-balance-card { min-width: 220px; padding: 24px; border-radius: var(--radius-card); background: var(--ink); color: white; box-shadow: var(--shadow); transform: rotate(1.5deg); }
.points-balance-card span, .points-balance-card small { display: block; opacity: .82; }
.points-balance-card strong { display: block; margin: 8px 0; font: 800 54px/1.1 "DM Sans", sans-serif; }
.demo-notice { margin: 22px 0 34px; padding: 14px 18px; border: 1px solid rgba(169,216,242,.72); border-radius: 16px; background: var(--accent-blue-soft); color: #35546a; }
.membership-section { margin: 38px 0; }
.membership-section .section-heading { align-items: center; }
.membership-section .section-heading h2 { font-family: "DM Sans", sans-serif; font-weight: 800; }
.plan-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; }
.plan-card { position: relative; display: grid; gap: 12px; padding: 24px; border: 1px solid var(--line); border-radius: var(--radius-card); background: rgba(255,255,255,.9); box-shadow: var(--shadow-soft); transition: transform .18s ease, box-shadow .18s ease; }
.plan-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-hover); }
.plan-card.current { border-color: var(--ink); background: linear-gradient(145deg, #fff, var(--accent-lavender-soft)); }
.plan-card button { margin-top: 8px; }
.plan-badge { position: absolute; right: 16px; top: 16px; padding: 5px 9px; border-radius: 999px; background: var(--accent-yellow-soft); color: var(--ink); font-size: 11px; font-weight: 700; }
.plan-price { margin: 0; font-size: 24px; font-weight: 800; }
.plan-price small { color: var(--muted); font-size: 12px; font-weight: 400; }
.credit-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
.credit-card { padding: 18px; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--white); }
.credit-card:nth-child(2) { background: var(--accent-yellow-soft); }
.credit-card:nth-child(3) { background: var(--accent-blue-soft); }
.credit-card div { display: flex; justify-content: space-between; margin-bottom: 14px; }
.transaction-list { display: grid; gap: 8px; }
.transaction-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); }
.transaction-row small { display: block; margin-top: 3px; color: var(--muted); }
.transaction-row .credit { color: #367359; }
.transaction-row .debit { color: #9a4b58; }
.cancel-demo { margin-top: 14px; }
.checkout-backdrop { position:fixed; inset:0; z-index:1200; display:grid; place-items:center; padding:20px; background:rgba(28,26,31,.46); backdrop-filter:blur(8px); }
.checkout-sheet { position:relative; width:min(100%,480px); max-height:calc(100dvh - 32px); overflow:auto; padding:30px; border:1px solid rgba(200,183,239,.55); border-radius:28px; background:var(--surface-raised); box-shadow:0 28px 80px rgba(35,31,42,.24); }
.checkout-sheet h2 { margin:4px 0 22px; font-size:clamp(28px,5vw,38px); letter-spacing:-.04em; }
.checkout-close { position:absolute; top:16px; right:16px; width:44px; height:44px; border:0; border-radius:50%; background:var(--paper); color:var(--ink); font-size:26px; cursor:pointer; }
.order-summary { display:grid; gap:0; margin:0; border:1px solid var(--line); border-radius:18px; overflow:hidden; }
.order-summary div { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:15px 18px; border-bottom:1px solid var(--line); }
.order-summary div:last-child { border-bottom:0; }
.order-summary dt { color:var(--muted); }
.order-summary dd { margin:0; text-align:right; font-weight:750; }
.order-summary .order-total { background:var(--accent-yellow-soft); }
.order-summary .order-total dd { font-size:20px; }
.checkout-note { margin:16px 0 0; color:var(--muted); font-size:13px; line-height:1.65; }
.checkout-actions { display:grid; grid-template-columns:1fr 1.35fr; gap:10px; margin-top:22px; }
.checkout-result { display:grid; justify-items:center; gap:10px; padding:18px 0 2px; text-align:center; }
.checkout-result-mark { display:grid; place-items:center; width:58px; height:58px; border-radius:50%; background:var(--accent-mint-soft,#e5f4eb); color:#286244; font-size:30px; font-weight:800; }
.checkout-result.failed .checkout-result-mark { background:var(--accent-pink-soft); color:#925064; }
.checkout-result h3,.checkout-result p { margin:0; }
.checkout-result p { color:var(--muted); }
.checkout-result button { margin-top:12px; min-width:160px; }
@media(max-width:768px) {
  .membership-hero { display: block; padding: 24px 20px; border-radius: 22px; }
  .points-balance-card { min-width: 0; margin-top: 22px; transform: none; }
  .plan-grid, .credit-grid { grid-template-columns: 1fr; }
  .membership-page h1 { font-size: 40px; }
  .checkout-sheet { padding:26px 20px 20px; border-radius:22px; }
}
</style>
