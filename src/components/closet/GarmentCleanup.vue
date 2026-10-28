<script setup>
import {ref,onBeforeUnmount} from 'vue';
import {useAuthStore} from '@/stores/auth';
import {commerceClient} from '@/services/commerce';
import {aiGateway} from '@/services/aiGateway';
import {blobToDataUrl} from '@/services/clothingMedia';
import {t} from '@/i18n';
const props=defineProps({blob:Blob});const emit=defineEmits(['result']);const auth=useAuthStore();
const consent=ref(false),busy=ref(false),message=ref(''),result=ref(''),jobId=ref(''),batchId=ref('');
let alive=true,timer;onBeforeUnmount(()=>{alive=false;clearTimeout(timer);if(result.value)URL.revokeObjectURL(result.value);});
async function check(){
 try{
  const data=await commerceClient.request('jobs',auth.session?.access_token);
  const job=data.jobs.find(j=>j.id===jobId.value);if(!alive)return;
  if(job?.status==='succeeded' && job.result_path){result.value=await aiGateway.loadPrivateImage(auth.session.access_token,job.result_path);busy.value=false;message.value='';}
  else if(['failed','cancelled'].includes(job?.status)){busy.value=false;message.value=t('未完成，點數已退回。');}
  else if(job?.status==='needs_review'){busy.value=false;message.value=t('結果核對中，請勿重新送出。');}
  else {message.value=t('處理中，可稍後到私人相簿查看。');timer=setTimeout(check,10000);}
 }catch{if(alive){busy.value=false;message.value=t('連線中斷，請查詢原工作。');}}
}
async function submit(){
 if(busy.value||!props.blob||!consent.value)return;
 busy.value=true;message.value='';batchId.value ||= crypto.randomUUID();
 try{
  const data=await commerceClient.request('cleanup',auth.session?.access_token,{batchId:batchId.value,imageData:await blobToDataUrl(props.blob),consent:true});
  if(!alive)return;jobId.value=data.jobs[0].id;await check();
 }catch(error){if(alive){busy.value=false;message.value=t(error.code==='DAILY_GENERATION_LIMIT'?'已達每日 2 次生成上限。':error.code==='INSUFFICIENT_POINTS'?'平台點數不足。':'連線中斷，請查詢原工作。');}}
}
async function apply(){const blob=await (await fetch(result.value)).blob();const image=await createImageBitmap(blob);emit('result',{displayBlob:blob,width:image.width,height:image.height});image.close();}
</script>
<template><details class="cleanup-panel"><summary>{{ t('AI 整理 · 2 點') }}</summary>
 <label><input v-model="consent" type="checkbox" :disabled="busy || !!jobId" />{{ t('同意將這張照片交由影像服務處理，可能改變衣物細節。') }}</label>
 <button v-if="!jobId" type="button" class="secondary" :disabled="!consent || busy" @click="submit">{{ t('整理這件衣物 · 2 點') }}</button>
 <button v-else-if="!busy && !result" type="button" class="secondary" @click="check">{{ t('查詢原工作') }}</button>
 <p v-if="message" role="status">{{ message }}</p>
 <template v-if="result"><img :src="result" :alt="t('整理結果')" /><button type="button" class="secondary" @click="apply">{{ t('使用這張圖片') }}</button></template>
 </details></template>
<style scoped>.cleanup-panel{margin-top:12px;text-align:left;font-size:13px}.cleanup-panel summary{cursor:pointer;padding:10px 0}.cleanup-panel label{display:flex;align-items:flex-start;gap:8px;line-height:1.6;margin:10px 0}.cleanup-panel input{flex:none}.cleanup-panel img{display:block;width:180px;height:180px;object-fit:contain;background:white;margin:12px 0}.cleanup-panel p{line-height:1.6}</style>
