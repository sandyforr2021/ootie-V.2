<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';
import WardrobeShowcase from './WardrobeShowcase.vue';
import BrandStudioDemo from './BrandStudioDemo.vue';
defineProps({kind:{type:String,required:true},compact:Boolean});
const pieces=[{photo:'/demo/garments/01.webp',name:'純白棉質襯衫'},{photo:'/demo/garments/07.webp',name:'奶油白短版外套'}];
const community=[1,3,4,2].map(id=>`/assets/brand/community-${id}.webp`);
</script>
<template>
 <WardrobeShowcase v-if="kind==='closet'"/>
 <BrandStudioDemo v-else-if="kind==='studio'"/>
 <figure v-else :class="['brand-product-preview',`preview-${kind}`]" :aria-label="$t('功能展示')">
  <figcaption><AppIcon :name="kind==='community'?'Explore':'Wishlist'" :size="20"/><strong>{{ $t(kind==='community'?'穿搭社群':'想買清單') }}</strong></figcaption>
  <div v-if="kind==='community'" class="brand-community-window">
   <div class="brand-community-track"><div v-for="copy in 2" :key="copy" class="brand-community-group" :aria-hidden="copy===2?'true':undefined"><div v-for="src in community" :key="src" class="brand-community-look"><img :src="src" :alt="copy===1?$t('穿搭人物視覺'):''" width="720" height="1080" decoding="async"/><span>OOTD</span></div></div></div>
  </div>
  <div v-else class="preview-shopping-list"><div v-for="(piece,index) in pieces" :key="piece.photo" :class="['preview-shopping-row',`shopping-row-${index}`]"><img :src="piece.photo" :alt="$t(piece.name)" loading="lazy"/><div><h3>{{ $t(piece.name) }}</h3><span>{{ $t('商品資訊與購買連結') }}</span></div></div></div>
 </figure>
</template>
<style scoped>
.brand-product-preview{width:100%;min-width:0;margin:0;padding:22px;background:#fff;border-radius:16px;color:var(--ink);overflow:hidden;box-sizing:border-box}figcaption{display:flex;align-items:center;gap:10px;margin:0 0 20px;font-size:14px}figcaption svg{color:var(--accent)}figcaption strong{font-weight:600}
.brand-community-window{overflow:hidden;width:100%;mask-image:linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)}.brand-community-track{display:flex;width:max-content;animation:brand-community-drift 48s linear infinite}.brand-community-group{display:flex;gap:16px;padding-right:16px;flex-shrink:0}.brand-community-look{width:210px;flex:0 0 210px;margin:0}.brand-community-look img{display:block!important;width:210px!important;height:310px!important;max-width:none;object-fit:cover;object-position:center;border-radius:12px;filter:none;opacity:1}.brand-community-look>span{display:block;font-size:10px;color:var(--muted);padding:10px 2px}.brand-community-window:hover .brand-community-track{animation-play-state:paused}
.preview-shopping-list{display:grid;gap:16px}.preview-shopping-row{display:flex;align-items:center;gap:16px;border-radius:14px;padding:14px;background:linear-gradient(125deg,#f3ebff,#fff8fd);animation:shopping-save 8s ease-in-out infinite}.shopping-row-1{background:linear-gradient(125deg,#fff1e1,#fffbe8);animation-delay:2s}.preview-shopping-row>img{width:105px;height:140px;object-fit:contain;background:#fff;border-radius:10px}.preview-shopping-row>div{flex:1;min-width:0}.preview-shopping-row h3{font:500 14px/1.6 var(--font-body);margin:0 0 12px}.preview-shopping-row span{color:var(--muted);font-size:11px;line-height:1.7}
@keyframes brand-community-drift{to{transform:translateX(-50%)}}@keyframes shopping-save{0%,100%{transform:translateX(0)}20%,45%{transform:translateX(5px)}}
@media(prefers-reduced-motion:reduce){.brand-community-track,.preview-shopping-row{animation:none}.brand-community-window{overflow-x:auto}.brand-community-group[aria-hidden=true]{display:none}}
@media(max-width:600px){.brand-product-preview{padding:18px}.brand-community-look{width:180px;flex-basis:180px}.brand-community-look img{width:180px!important;height:265px!important}.preview-shopping-row>img{width:80px;height:110px}}
</style>
