<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import TranslatedText from './TranslatedText.vue';
import {t,formatDate} from '@/i18n';
defineProps({post:{type:Object,required:true},own:Boolean,following:Boolean,canFollow:Boolean,followPending:Boolean,likePending:Boolean,savePending:Boolean});
defineEmits(['open','comments','profile','follow','like','save','share','edit','delete']);
</script>
<template>
 <article class="ootd-card" :data-post-id="post.id">
  <header class="ootd-user-row">
   <button type="button" class="ootd-user" :aria-label="t('個人檔案')+' '+post.username" @click="$emit('profile')"><span class="ootd-avatar" aria-hidden="true"><MediaImage v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="lazy"/><span v-else>{{ post.initials }}</span></span><span class="ootd-user-copy"><strong class="user-link-text">{{ post.display_name||post.username }}</strong><span v-if="post.created_at||post.createdAt">{{ formatDate(post.created_at||post.createdAt,{month:'short',day:'numeric'}) }}</span></span></button>
   <details v-if="own" class="post-card-menu"><summary :aria-label="t('貼文選單')"><AppIcon name="more"/></summary><div><button type="button" @click="$emit('edit')"><AppIcon name="edit" :size="17"/>{{ t('編輯') }}</button><button type="button" @click="$emit('delete')"><AppIcon name="delete" :size="17"/>{{ t('刪除') }}</button></div></details>
   <button v-else-if="!post.editorial" type="button" :class="['follow-button',{following}]" :aria-pressed="following" :disabled="!canFollow||followPending" @click="$emit('follow')">{{ t(following?'已追蹤':'追蹤') }}</button>
  </header>
  <button type="button" class="ootd-photo-button" :aria-label="t('查看貼文')" @click="$emit('open')"><MediaImage class="ootd-photo" :src="post.image" :alt="post.caption||post.username" loading="lazy" decoding="async"/></button>
  <div class="ootd-body">
   <div class="ootd-actions" :aria-label="t('貼文互動')"><button type="button" :class="['ootd-action',{liked:post.liked}]" :aria-pressed="!!post.liked" :aria-label="t('喜歡')" :disabled="likePending" @click="$emit('like')"><AppIcon name="heart" :fill="post.liked?'currentColor':'none'"/><span>{{ post.likes||0 }}</span></button><button type="button" class="ootd-action" :aria-label="t('留言')" @click="$emit('comments')"><AppIcon name="comment"/><span>{{ post.comments||0 }}</span></button><button type="button" :class="['ootd-action',{saved:post.saved}]" :aria-pressed="!!post.saved" :aria-label="t('收藏')" :disabled="savePending" @click="$emit('save')"><AppIcon name="bookmark" :fill="post.saved?'currentColor':'none'"/><span>{{ post.saves||0 }}</span></button><button type="button" class="ootd-action" :aria-label="t('分享')" @click="$emit('share')"><AppIcon name="share"/></button></div>
   <TranslatedText :content-id="post.id" :text="post.caption" :source-language="post.caption_language" reveal-source-on-translate understated/>
   <div v-if="post.hashtags?.length" class="ootd-tags">{{ post.hashtags.join('　') }}</div>
   <div v-if="post.tagged_items?.length" class="explore-tagged-items" :aria-label="t('本套使用單品')"><button v-for="item in post.tagged_items" :key="item.id||item.key" type="button" class="explore-tagged-piece" @click="$emit('open')"><MediaImage v-if="item.photo" class="product-image" :src="item.photo" :alt="item.name_zh||item.name" loading="lazy"/><span>{{ item.name_zh||item.name }}</span></button></div>
  </div>
 </article>
</template>
<style scoped>
.ootd-photo-button{position:relative;isolation:isolate;overflow:hidden}
.ootd-photo-button>.ootd-photo{position:relative;z-index:1;object-fit:contain;background:transparent}

.post-card-menu{position:relative;flex:none}.post-card-menu summary{display:grid;place-items:center;min-width:44px;min-height:44px;list-style:none;cursor:pointer;border-radius:8px}.post-card-menu summary::-webkit-details-marker{display:none}.post-card-menu[open] summary{background:var(--accent-lavender-soft)}.post-card-menu>div{position:absolute;right:0;top:100%;z-index:10;min-width:130px;border:1px solid var(--line);border-radius:10px;background:var(--white);padding:6px;box-shadow:0 10px 22px -14px #30223655}.post-card-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px;border:0;background:none;text-align:left;font-size:13px;color:var(--ink);cursor:pointer}.post-card-menu button:hover{background:var(--accent-pink-soft)}
</style>
