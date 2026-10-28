<script setup>
import {computed,ref,watch} from 'vue';
import {useAuthStore} from '@/stores/auth';
import {commerceClient} from '@/services/commerce';
import {t,formatDate} from '@/i18n';
const auth=useAuthStore(), data=ref(null), error=ref(''), loading=ref(false);
const token=computed(()=>auth.session?.access_token || '');
let requestVersion=0;
async function load(){
 const version=++requestVersion;
 if(!auth.isMember || !token.value)return;
 loading.value=true;error.value='';
 try { const result=await commerceClient.request('capabilities',token.value);if(version===requestVersion)data.value=result; }
 catch {if(version===requestVersion)error.value=t('額度資訊暫時無法載入。');} finally {if(version===requestVersion)loading.value=false;}
}
watch(()=>[auth.isMember,auth.session?.user?.id],()=>{requestVersion++;data.value=null;error.value='';loading.value=false;if(auth.isMember)void load();},{immediate:true});
</script>
<template>
<section class="page active credits-page">
 <h1>{{ t('試穿額度') }}</h1>
 <div v-if="!auth.initialized || loading" role="status">{{ t('載入中…') }}</div>
 <div v-else-if="!auth.isMember"><p>{{ t('登入後查看試穿額度。') }}</p><button class="primary" @click="auth.openAuthModal('login',null,'/credits')">{{ t('登入／註冊') }}</button></div>
 <div v-else-if="error" role="alert"><p>{{ error }}</p><button class="secondary" @click="load">{{ t('重試') }}</button></div>
 <template v-else-if="data">
  <section class="credits-balance"><span>{{ t('目前可用額度') }}</span><strong>{{ data.remainingUnits }}</strong><p>{{ t('可用額度已考量今日使用量、處理中的工作及網站剩餘額度。') }}</p></section>
  <section class="credits-details"><h2>{{ t('使用方式') }}</h2><p>{{ $tf('每件試穿預留 {count} 額度。', {count:data.costs.try_on}) }}</p><p v-if="data.expiresAt">{{ t('有效期限') }}：{{ formatDate(data.expiresAt,{dateStyle:'medium'}) }}</p><p>{{ t('目前沒有付款或自動加值。') }}</p><router-link class="secondary" to="/shop">{{ t('返回試穿工作室') }}</router-link></section>
 </template>
</section>
</template>
<style scoped>
.credits-page{max-width:880px}.credits-page>p,.credits-balance p,.credits-details p{color:var(--muted);line-height:1.7}.credits-balance{margin:28px 0;padding:28px;border-radius:18px;background:var(--accent-lavender-soft)}.credits-balance span,.credits-balance strong{display:block}.credits-balance strong{font-size:48px;margin:8px 0}.credits-details{padding:8px 0 24px}.credits-details a{display:inline-block;margin-top:12px}
</style>
