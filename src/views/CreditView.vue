<script setup>
import {ref,watch} from 'vue';
import {useAuthStore} from '@/stores/auth';
import {t,tf,formatDate} from '@/i18n';
import {loadPointAccount} from '@/services/pointAccount';
import {MEMBERSHIP_PLANS,POINT_TOPUP,POINTS_PER_GARMENT,formatPlanUsd} from '@/services/membershipPlans';
const auth=useAuthStore();
const points=ref(null),pointsError=ref(false),pointsLoading=ref(false);
let pointVersion=0;
const pointReasons={BIRTHDAY_BONUS:'生日點數',SUBSCRIPTION_GRANT:'方案點數',CREDIT_PURCHASE:'點數補給',PROMOTIONAL_REWARD:'活動贈點',TRYON_USAGE:'試穿使用',AI_USAGE:'AI 圖片處理',MANUAL_ADJUSTMENT:'點數調整',REFUND:'退還點數'};
async function loadPoints(){
 const version=++pointVersion,id=auth.profileId;points.value=null;pointsError.value=false;pointsLoading.value=false;
 if(!auth.isMember||!id)return;
 pointsLoading.value=true;
 try{const result=await loadPointAccount(id);if(version===pointVersion&&id===auth.profileId)points.value=result;}
 catch{if(version===pointVersion)pointsError.value=true;}
 finally{if(version===pointVersion)pointsLoading.value=false;}
}
watch(()=>[auth.profileId,auth.isMember],loadPoints,{immediate:true});
</script>
<template>
<section class="page active credits-page app-page">
 <header class="membership-hero">
  <h1>{{ t('方案與點數') }}</h1>
  <section class="balance-card" :aria-label="t('我的點數')">
   <span>{{ t('目前點數') }}</span>
   <p v-if="pointsLoading || !auth.initialized" role="status">{{ t('載入中…') }}</p>
   <template v-else-if="!auth.isMember"><strong class="personal-balance">—</strong><button class="secondary" @click="auth.openAuthModal('login',null,'/credits')">{{ t('登入／註冊') }}</button></template>
   <div v-else-if="pointsError" role="alert"><p>{{ t('點數紀錄暫時無法載入。') }}</p><button class="secondary" @click="loadPoints">{{ t('重試') }}</button></div>
   <div v-else-if="points" class="credit-balance-value"><strong class="personal-balance">{{ points.balance }}</strong><a class="point-history-link" href="#point-history">{{ t('查看點數紀錄') }}</a></div>
  </section>
 </header>
 <section class="membership-options" aria-labelledby="point-options-title">
  <div class="membership-section-heading"><h2 id="point-options-title">{{ t('月費會員') }}</h2><span>{{ t('價格以美金計算') }}</span></div>
  <div class="membership-grid">
   <article class="membership-card">
    <h3>OOTIE Free</h3><p class="point-price">US$ 0</p>
    <p>{{ t('整理衣櫥，分享日常穿搭。') }}</p>
    <ul><li>{{ t('每日免費生成 2 張') }}</li><li>{{ t('免費去背與品名辨識') }}</li><li>{{ t('穿搭紀錄與衣櫥統計') }}</li></ul>
    <router-link class="secondary" to="/closet">{{ t('前往我的衣櫥') }}</router-link>
   </article>
   <article v-for="plan in MEMBERSHIP_PLANS" :key="plan.id" class="membership-card" :class="{featured:plan.id==='pro'}">
    <h3>{{ plan.name }}</h3><p class="point-price">{{ formatPlanUsd(plan.priceUsd) }}<span>{{ t('／月') }}</span></p>
    <p class="included-points">{{ tf('每月 {points} 點',{points:plan.points}) }}</p>
    <ul><li>{{ tf('可用於 {count} 件 AI 處理',{count:plan.points/POINTS_PER_GARMENT}) }}</li><li>{{ t('AI 試穿與衣物整理共用點數') }}</li><li>{{ t('結果存入私人相簿') }}</li></ul>
    <span class="plan-unavailable">{{ t('尚未開放訂閱') }}</span>
   </article>
  </div>
  <p class="membership-availability">{{ t('方案預告，尚未開放付款。') }}</p>
  <p class="membership-availability">{{ t('每件 2 點；免費額度於美西午夜重置。') }}</p>
 </section>
 <section class="topup-section" aria-labelledby="topup-title">
  <div class="membership-section-heading"><h2 id="topup-title">{{ t('加購點數') }}</h2></div>
  <article class="topup-card">
   <div><h3>{{ tf('{points} 點補給包',{points:POINT_TOPUP.points}) }}</h3><p>{{ tf('可用於 {count} 件 AI 處理',{count:POINT_TOPUP.points/POINTS_PER_GARMENT}) }}</p></div>
   <strong class="topup-price">{{ formatPlanUsd(POINT_TOPUP.priceUsd) }}</strong><span class="plan-unavailable">{{ t('尚未開放加購') }}</span>
  </article>
 </section>
 <section v-if="auth.isMember" id="point-history" class="point-history" aria-labelledby="point-history-title">
  <div class="membership-section-heading"><h2 id="point-history-title">{{ t('點數紀錄') }}</h2><button type="button" class="text-button" :disabled="pointsLoading" @click="loadPoints">{{ t('重新整理') }}</button></div>
  <p v-if="pointsLoading" role="status">{{ t('載入中…') }}</p>
  <p v-else-if="pointsError" role="alert">{{ t('點數紀錄暫時無法載入。') }}</p>
  <ul v-else-if="points?.transactions.length"><li v-for="entry in points.transactions" :key="entry.id"><span>{{ t(pointReasons[entry.type] || '點數調整') }}<small>{{ formatDate(entry.created_at,{dateStyle:'medium'}) }}</small></span><strong :class="{credit:entry.amount>0}">{{ entry.amount>0?'+':'' }}{{ entry.amount }}</strong></li></ul>
  <p v-else>{{ t('尚無點數紀錄。') }}</p>
 </section>
</section>
</template>
<style scoped>
.credits-page{max-width:1240px;margin-inline:auto}
.membership-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.48fr);align-items:center;gap:40px;padding:clamp(24px,4vw,48px);border:1px solid #e2d6ec;border-radius:24px;background:var(--gradient-celebration);min-height:260px}
.membership-hero h1{font-family:'DM Sans','Noto Sans TC','Yu Gothic',sans-serif;font-size:clamp(32px,3.8vw,54px);font-weight:750;line-height:1.2;letter-spacing:-.025em;margin:0 0 18px;text-align:left}
:lang(zh-TW) .membership-hero h1,:lang(ja) .membership-hero h1{font-family:'DM Sans','Noto Sans TC','Yu Gothic',sans-serif;font-weight:750;line-height:1.35;letter-spacing:.01em}
.membership-intro p{font-size:14px;margin:0;max-width:40ch}
.balance-card{display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding:28px;border-radius:16px;background:linear-gradient(135deg,#302236,#211c2b);color:#fff;box-shadow:0 16px 30px #3a25451a;min-width:0;text-align:right}
.balance-card>span{font-size:14px;color:#eee3f4}.balance-card p{color:#eee3f4}.personal-balance{display:block;font-size:clamp(42px,4.3vw,64px);line-height:1.15;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:10px 0 18px;overflow-wrap:anywhere}
.balance-card a{font-size:12px;color:#eee3f4;text-decoration:underline;text-underline-offset:4px}.balance-card .secondary{color:white;border-color:#cdbcd6}
.credit-balance-value{display:grid;justify-items:end;gap:8px;text-align:right}.credit-balance-value .point-history-link{display:block}
.membership-options,.point-history{margin-top:40px}.membership-section-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.membership-section-heading h2{font-size:24px;margin:0;font-weight:700}.membership-section-heading>span{font-size:12px;color:var(--muted)}
.membership-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.membership-card{display:flex;flex-direction:column;min-width:0;padding:26px;border-radius:16px;border:1px solid var(--line);background:#fff}.membership-card.featured{background:linear-gradient(145deg,#fff 8%,#f3ebff);border-color:#a891bd}.membership-card h3{font-size:20px;margin:0 0 22px}.membership-card p{font-size:14px;line-height:1.7;margin:0 0 20px}.membership-card .point-price{display:flex;align-items:baseline;gap:8px;color:var(--ink);min-height:48px;font-size:30px;font-weight:650;margin:0 0 16px}.point-price strong{font-size:40px;line-height:1.1;font-variant-numeric:tabular-nums}.point-price span{font-size:13px;font-weight:400;color:var(--muted)}
.membership-card ul{padding-left:18px;font-size:13px;line-height:1.8;margin:0 0 28px}.membership-card li+li{margin-top:6px}.membership-card>a{margin-top:auto;width:100%;text-decoration:none;min-height:46px;font-size:14px}.membership-availability{font-size:12px;margin:16px 0 0}.point-history{scroll-margin-top:30px}.point-history ul{list-style:none;padding:0;margin:0}.point-history li{display:flex;justify-content:space-between;align-items:center;gap:16px;border-top:1px solid var(--line);padding:16px 0;font-size:14px}.point-history li strong{font-variant-numeric:tabular-nums;font-size:20px}.point-history .credit{color:var(--sage-dark)}.point-history small{display:block;color:var(--muted);font-size:12px;margin-top:4px}
@media(max-width:980px){.membership-hero{gap:24px;grid-template-columns:minmax(0,1fr) 240px}.membership-grid{gap:12px}.membership-card{padding:20px}}
@media(max-width:760px){.membership-hero{grid-template-columns:1fr;gap:26px}.balance-card{max-width:none}.membership-grid{grid-template-columns:1fr}.membership-card{padding:24px}.membership-section-heading{align-items:flex-start;flex-wrap:wrap}.membership-hero h1{font-size:34px}.membership-options,.point-history{margin-top:30px}}
</style>
<style scoped>
.text-button{border:0;background:transparent;color:var(--ink);font:inherit;font-size:13px;padding:8px 4px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}.text-button:disabled{opacity:.5;cursor:wait}
.membership-card .included-points{font-weight:700;color:var(--ink);font-size:18px}.plan-unavailable{margin-top:auto;display:block;color:var(--muted);font-size:13px;padding:14px 0;border-top:1px solid var(--line)}
.topup-section{margin-top:36px}.topup-card{display:flex;align-items:center;gap:32px;background:linear-gradient(115deg,#fff,#fcf2ff 65%,#fff8e9);border:1px solid var(--line);border-radius:16px;padding:26px}.topup-card>div{flex:1}.topup-card h3{font-size:20px;margin:0 0 8px}.topup-card p{margin:0;font-size:14px}.topup-price{font-size:28px;white-space:nowrap}.topup-card .plan-unavailable{margin:0;border:0;padding:0}.usage-note{margin-top:20px;font-size:13px}.usage-note p{margin:4px 0}.point-price{flex-wrap:wrap}
@media(max-width:760px){.topup-card{flex-wrap:wrap;gap:20px}.topup-card>div{flex-basis:100%}.topup-card .plan-unavailable{margin-left:auto}}
</style>

<style scoped>
.membership-card:nth-child(1){background:linear-gradient(145deg,#fff9fc 0%,#fce8f2 100%);border-color:#eed4e2}
.membership-card:nth-child(2){background:linear-gradient(145deg,#f9fdff 0%,#e3f2fb 100%);border-color:#c9e0ee}
.membership-card:nth-child(3){background:linear-gradient(145deg,#fcfaff 0%,#ece0ff 100%);border-color:#c8b0e6}
</style>
