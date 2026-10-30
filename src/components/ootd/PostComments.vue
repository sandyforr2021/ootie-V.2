<template>
  <section :id="`post-comments-${post.id}`" ref="section" class="inline-comments" :aria-labelledby="`comments-heading-${post.id}`">
    <h3 :id="`comments-heading-${post.id}`" tabindex="-1">{{ $t('留言') }} <span>{{ post.comments || 0 }}</span></h3>
    <p v-if="loading" role="status">{{ $t('正在載入留言…') }}</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" class="text-link" @click="refresh">{{ $t('重試') }}</button></p>
    <ol v-else-if="comments.length" class="inline-comment-list">
      <li v-for="comment in comments" :key="comment.id">
        <div class="inline-comment-header">
          <router-link :to="{path:'/profile',query:{user:comment.user}}" class="inline-comment-author">
            <MediaImage v-if="comment.avatar_url" :src="comment.avatar_url" alt="" loading="lazy" /><span v-else class="inline-comment-initials" aria-hidden="true">{{ (comment.display_name || comment.user || '').replace('@','').slice(0,2).toUpperCase() }}</span>
            <strong>{{ comment.display_name || comment.user }}</strong>
          </router-link>
          <time v-if="comment.created_at" :datetime="comment.created_at">{{ commentTime(comment.created_at) }}</time>
          <details class="comment-menu"><summary :aria-label="$t('留言選項')">⋯</summary><div>
            <button v-if="auth.profileId === comment.profile_id" type="button" class="comment-delete" :disabled="!!deleting" @click="pendingDelete=comment">{{ $t('刪除') }}</button>
            <button type="button" @click="app.showToast($t('檢舉功能準備中。'), {type:'info'})">{{ $t('檢舉') }}</button>
          </div></details>
        </div>
        <TranslatedText :content-id="comment.id" kind="comment" :text="comment.text" :source-language="comment.body_language" />
      </li>
    </ol>
    <p v-else>{{ $t('還沒有留言，成為第一個留言的人吧。') }}</p>
    <form v-if="auth.isMember" class="inline-comment-form" @submit.prevent="submit">
      <label :for="`comment-draft-${post.id}`">{{ $t('寫下你的想法') }}</label>
      <textarea :id="`comment-draft-${post.id}`" ref="composer" v-model="draft" rows="3" maxlength="2000" required :disabled="sending" />
      <button class="primary" type="submit" :disabled="sending || !draft.trim()">{{ $t(sending?'傳送中…':'送出') }}</button>
    </form>
    <button v-else type="button" class="secondary" @click="app.openLoginGate('SOCIAL_AUTH_REQUIRED',`/ootd/${post.id}?comment=1`)">{{ $t('登入後留言') }}</button>
    <BaseConfirmDialog :open="!!pendingDelete" :title="$t('刪除留言？')" :message="$t('刪除後無法復原。')" confirm-label="刪除" destructive :busy="!!deleting" @cancel="pendingDelete=null" @confirm="remove(pendingDelete)"/>
  </section>
</template>
<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import TranslatedText from '@/components/ootd/TranslatedText.vue';
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue';
import {ref,computed,watch} from 'vue';
import {deletePostComment} from '@/services/postComments';
import {t,formatDate} from '@/i18n';
import {useAppStore} from '@/stores/app';
import {useAuthStore} from '@/stores/auth';
import {useOotdStore} from '@/stores/ootd';
const props=defineProps({post:{type:Object,required:true}});
const app=useAppStore(), auth=useAuthStore(), store=useOotdStore();
const section=ref(null),composer=ref(null),draft=ref(''),loading=ref(false),error=ref(''),sending=ref(false);
const deleting=ref(null);
const pendingDelete=ref(null);
async function remove(comment){
 if(deleting.value || comment.profile_id!==auth.profileId)return;
 deleting.value=comment.id;
 try {await deletePostComment({id:comment.id,profileId:auth.profileId,postId:props.post.id});pendingDelete.value=null;await refresh();}
 catch {error.value=t('留言未刪除，請重試。','Could not delete this comment. Please retry.');}
 finally {deleting.value=null;}
}
let draftId=crypto.randomUUID(), version=0;
const comments=computed(()=>props.post.commentList || []);
function commentTime(value){
  const d=new Date(value); if(Number.isNaN(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
watch(draft,()=>{if(!sending.value)draftId=crypto.randomUUID();});
async function refresh(){
  const sequence=++version;loading.value=true;error.value='';
  const success=await store.loadComments(props.post.id);
  if(sequence!==version)return;
  if(!success)error.value=store.commentsError;
  loading.value=false;
}
async function submit(){
  if(sending.value || !draft.value.trim())return;
  sending.value=true;
  try{if(await store.addComment(props.post.id,draft.value,draftId)){draft.value='';draftId=crypto.randomUUID();}}
  finally{sending.value=false;}
}
watch(()=>props.post.id,()=>{draft.value='';void refresh();},{immediate:true});
function focusComposer(){
  section.value?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  (composer.value || section.value?.querySelector('h3'))?.focus({preventScroll:true});
}
defineExpose({focusComposer});
</script>
<style scoped>
.inline-comments{margin-top:32px;padding-top:26px;border-top:1px solid var(--line);scroll-margin-top:28px}.inline-comments h3{font-size:20px;display:flex;gap:10px;align-items:center}.inline-comments h3 span{font-size:13px;color:var(--muted)}.inline-comments>p{color:var(--muted);font-size:14px}.inline-comment-list{list-style:none;margin:20px 0 28px;padding:0;display:grid;gap:22px}.inline-comment-author{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-size:14px}.inline-comment-author img,.inline-comment-initials{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0}.inline-comment-initials{display:grid;place-items:center;background:var(--accent-lavender-soft);font-size:11px}.inline-comment-list p{margin:8px 0 6px 44px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:14px}.inline-comment-list time{display:block;margin-left:44px;font-size:11px;color:var(--muted)}.inline-comment-form{display:grid;gap:10px}.inline-comment-form label{font-size:13px;font-weight:600}.inline-comment-form textarea{resize:vertical;min-height:96px;max-height:320px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:var(--paper);padding:14px;font:inherit;line-height:1.6;color:var(--ink)}.inline-comment-form button{justify-self:end;min-width:96px}.inline-comment-form textarea:focus-visible{outline:2px solid var(--accent-violet-ink);outline-offset:3px}
.inline-comment-header{display:flex;align-items:center;gap:8px}.inline-comment-header .inline-comment-author{min-width:0;flex:1}.inline-comment-header time{margin:0;font-size:11px;white-space:nowrap}.comment-menu{position:relative}.comment-menu summary{list-style:none;display:grid;place-items:center;width:36px;height:36px;cursor:pointer}.comment-menu summary::-webkit-details-marker{display:none}.comment-menu>div{position:absolute;z-index:2;right:0;min-width:110px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--surface-raised);box-shadow:var(--shadow)}.comment-menu button{display:block;width:100%;border:0;background:transparent;padding:10px;text-align:left;cursor:pointer}@media(max-width:480px){.inline-comment-header{flex-wrap:wrap}.inline-comment-header time{font-size:10px}}
</style>
