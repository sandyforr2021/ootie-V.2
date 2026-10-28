<script setup>
import {computed,ref,watch} from 'vue';
import {useAuthStore} from '@/stores/auth';
import {useAppStore} from '@/stores/app';
import {useClosetStore} from '@/stores/closet';
import {t,tf} from '@/i18n';
import {categoryFamily} from '@/services/commerce';
const auth=useAuthStore(),app=useAppStore(),closet=useClosetStore();
const selected=ref([]),query=ref(''),family=ref('all'),status=ref(''),storageError=ref(false),dirty=ref(false);
const key=computed(()=>auth.profileId?`ootie-wardrobe-board-v1:${auth.profileId}`:null);
const owned=computed(()=>auth.isMember?app.items.filter(item=>item.owner_id===auth.profileId && !item.hidden):[]);
const looks=computed(()=>selected.value.map(id=>owned.value.find(item=>item.id===id)).filter(Boolean));
const filtered=computed(()=>owned.value.filter(item=>(family.value==='all'||categoryFamily(item.category)===family.value)&&`${item.name||''} ${item.name_zh||''}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const filters=computed(()=>[['all',t('全部')],['upper_body',t('上衣')],['lower_body',t('下身')],['full_body',t('連身服飾')],['outer',t('外套')],['shoes',t('鞋子')],['accessory',t('配件')]]);
function restore(){
 selected.value=[];status.value='';dirty.value=false;storageError.value=false;
 if(!key.value)return;
 try{const data=JSON.parse(localStorage.getItem(key.value)||'[]');if(Array.isArray(data))selected.value=[...new Set(data.filter(id=>typeof id==='string'))].slice(0,6);}
 catch{storageError.value=true;status.value=t('無法讀取此瀏覽器的搭配板，仍可重新搭配。');}
}
watch(key,restore,{immediate:true});
function toggle(id){
 if(!owned.value.some(item=>item.id===id))return;
 if(selected.value.includes(id))selected.value=selected.value.filter(value=>value!==id);
 else if(looks.value.length<6)selected.value=[...looks.value.map(item=>item.id),id];
 else{status.value=t('一組最多搭配六件單品。');return;}
 dirty.value=true;status.value='';
}
function save(){
 if(!key.value||!looks.value.length)return;
 try{localStorage.setItem(key.value,JSON.stringify(looks.value.map(item=>item.id)));dirty.value=false;storageError.value=false;status.value=t('已儲存。下次在這台裝置開啟「試穿工作室 → 衣櫥搭配」即可繼續。');}
 catch{storageError.value=true;status.value=t('瀏覽器無法儲存，請保留此頁繼續搭配。');}
}
function clear(){selected.value=[];dirty.value=true;status.value='';}
function saveEmpty(){try{localStorage.setItem(key.value,'[]');dirty.value=false;storageError.value=false;status.value=t('已儲存。下次在這台裝置開啟「試穿工作室 → 衣櫥搭配」即可繼續。');}catch{storageError.value=true;status.value=t('瀏覽器無法儲存，請保留此頁繼續搭配。');}}
</script>
<template>
 <section class="wardrobe-board" aria-labelledby="wardrobe-board-title">
  <header><h2 id="wardrobe-board-title">{{ t('用你的衣服，搭出下一套') }}</h2><p>{{ t('選上衣、褲子、鞋包並排搭配，最多六件。這是單品搭配板，不會將衣服合成到人物照片。') }}</p></header>
  <div v-if="closet.remoteState?.status==='error'" role="alert"><p>{{ t('衣櫥暫時無法載入，請重新整理。') }}</p><button @click="closet.loadRemoteItems(auth.profileId)">{{ t('重試') }}</button></div>
  <div class="board-workspace">
   <div class="board-selection">
    <div class="board-toolbar"><h3>{{ t('這次的搭配') }} <span>{{ looks.length }}/6</span></h3><button v-if="looks.length" @click="clear">{{ t('清空搭配') }}</button></div>
    <div v-if="looks.length" class="board-canvas"><figure v-for="item in looks" :key="item.id"><img v-if="item.photo" :src="item.photo" :alt="item.name_zh || item.name"><div v-else class="board-no-image">{{ t('尚未加入照片') }}</div><figcaption>{{ item.name_zh || item.name }}</figcaption><button :aria-label="tf('移除 {name}',{name:item.name_zh || item.name})" @click="toggle(item.id)">{{ t('移除') }}</button></figure></div>
    <div v-else class="board-empty"><p>{{ t('從衣櫥點選單品，開始組合你的穿搭。') }}</p></div>
    <div class="board-save"><button class="primary" :disabled="!dirty" @click="looks.length?save():saveEmpty()">{{ t('儲存搭配板') }}</button><p>{{ t('儲存在這台裝置的「試穿工作室 → 衣櫥搭配」，再次開啟會恢復選擇。尚未跨裝置同步，不使用試穿額度。') }}</p></div>
    <p v-if="status" :role="storageError?'alert':'status'">{{ status }}</p>
   </div>
   <div class="board-closet"><h3>{{ t('我的衣櫥') }}</h3><label for="board-search">{{ t('搜尋單品') }}</label><input id="board-search" v-model="query" type="search" autocomplete="off"><div class="board-filters"><button v-for="[value,label] in filters" :key="value" :aria-pressed="family===value" @click="family=value">{{ label }}</button></div>
    <p v-if="closet.remoteState?.status==='loading'" role="status">{{ t('正在載入衣櫥…') }}</p>
    <div v-else-if="filtered.length" class="board-items"><button v-for="item in filtered" :key="item.id" :aria-pressed="selected.includes(item.id)" @click="toggle(item.id)"><img v-if="item.photo" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy"><span>{{ item.name_zh || item.name }}</span></button></div>
    <p v-else>{{ owned.length?t('沒有符合搜尋的單品。'):t('先加入幾件自己的衣服，再來開始搭配。') }}</p><router-link to="/closet">{{ t('管理我的衣櫥') }} →</router-link>
   </div>
  </div>
  <aside class="board-ai-note"><h3>{{ t('想看穿在身上的樣子？') }}</h3><p>{{ t('商品試穿會為每件選取的商品各產生一張結果；同批三件不會合成一套。整套衣服與包包一起上身的功能尚未提供。') }}</p><router-link to="/shop?tab=wishlist">{{ t('前往商品試穿') }} →</router-link></aside>
 </section>
</template>
<style scoped>
.wardrobe-board button{font:inherit;min-height:40px;border:1px solid var(--line);background:var(--white);color:var(--ink);padding:9px 12px;border-radius:8px;cursor:pointer;transition:background .16s ease}.wardrobe-board button:hover:not(:disabled){background:var(--accent-pink-soft)}.wardrobe-board button:focus-visible,.wardrobe-board input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.wardrobe-board button:disabled{opacity:.5;cursor:not-allowed}.wardrobe-board button.primary{background:var(--accent);color:var(--white);border-color:var(--accent)}.wardrobe-board .board-items button{min-height:0}.wardrobe-board input{font:inherit;color:var(--ink);padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--white)}@media(prefers-reduced-motion:reduce){.wardrobe-board button{transition:none}}

.wardrobe-board{color:var(--ink)}.wardrobe-board header{margin-bottom:28px}.wardrobe-board h2{font-size:26px;margin:0 0 10px}.wardrobe-board p{color:var(--muted);max-width:70ch;font-size:14px;line-height:1.7}.board-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,1fr);gap:32px;align-items:start}.board-selection{background:var(--accent-yellow-soft);padding:24px;border-radius:12px;position:sticky;top:20px}.board-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px}.board-toolbar h3{margin:0;font-size:18px}.board-toolbar h3 span{font-size:13px;margin-left:10px}.board-canvas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0}.board-canvas figure{min-width:0;margin:0}.board-canvas img,.board-no-image{width:100%;height:190px;object-fit:contain;background:#fffdfb;border-radius:8px}.board-no-image{display:grid;place-items:center;font-size:13px}.board-canvas figcaption{font-size:13px;line-height:1.5;margin:8px 0;overflow-wrap:anywhere}.board-canvas button{font-size:12px;padding:6px 10px}.board-empty{min-height:240px;display:grid;place-items:center;text-align:center}.board-save{border-top:1px solid #d8c88c;padding-top:20px}.board-save p{font-size:12px;margin-bottom:0}.board-closet h3{margin-top:0}.board-closet input{width:100%;margin:8px 0 14px}.board-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}.board-filters button{font-size:12px;padding:7px 10px}.board-filters button[aria-pressed=true]{background:var(--ink);color:var(--white)}.board-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:20px}.board-items button{padding:6px;border:1px solid var(--line);text-align:left;overflow:hidden;min-width:0}.board-items button[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:var(--accent-pink-soft)}.board-items img{width:100%;height:110px;object-fit:contain;background:var(--white);border-radius:4px}.board-items span{display:block;font-size:11px;line-height:1.5;margin-top:6px;overflow-wrap:anywhere}.board-ai-note{margin-top:40px;padding-top:24px;border-top:1px solid var(--line)}.board-ai-note h3{font-size:18px}.board-ai-note a{font-size:14px}.board-closet>a{font-size:13px}@media(max-width:900px){.board-workspace{grid-template-columns:1fr}.board-selection{position:static}.board-items{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:480px){.board-selection{padding:18px}.board-canvas{gap:12px}.board-canvas img{height:160px}.board-items{grid-template-columns:repeat(3,minmax(0,1fr))}.wardrobe-board h2{font-size:22px}}
</style>
