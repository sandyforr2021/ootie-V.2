<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { acquireMedia,releaseMedia,isDeferredMedia,mediaEpoch,fullMediaId } from '@/services/mediaMemory';
import { listThumbnail,fullImage } from '@/services/publicThumbnails';
const props=defineProps({src:{type:String,default:''},full:Boolean});
const el=ref(null),resolved=ref('');let observer,lease='',sequence=0,visible=false;
function release(){if(lease)releaseMedia(lease);lease='';}
async function resolve(){
 const version=++sequence;release();resolved.value='';
 if(!isDeferredMedia(props.src)){resolved.value=props.full?fullImage(props.src):listThumbnail(props.src);return;}
 if(!visible)return;
 const id=props.full?fullMediaId(props.src):props.src;
 try{const url=await acquireMedia(id);if(version!==sequence){releaseMedia(id);return;}lease=id;resolved.value=url;}catch{/* Keep an empty image rather than bypassing authorization. */}
}
watch([()=>props.src,()=>props.full,mediaEpoch],resolve,{immediate:true});
onMounted(()=>{
 if(typeof IntersectionObserver==='undefined'){visible=true;resolve();return;}
 observer=new IntersectionObserver(records=>{if(records.some(r=>r.isIntersecting)){visible=true;observer.disconnect();resolve();}},{rootMargin:'120px'});
 observer.observe(el.value);
});
onBeforeUnmount(()=>{sequence++;observer?.disconnect();release();});
</script>
<template><img ref="el" :src="resolved||undefined" loading="lazy" decoding="async" /></template>
