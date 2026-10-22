import {buildHandoff,webUrl} from './handoff.js';
import {messages} from './messages.js';
const $=id=>document.getElementById(id);
let lang='en';
try {lang=localStorage.getItem('ootie_language') || 'en';} catch {}
if(!messages[lang]) lang='en';
const copy=key=>messages[lang][key];
function render(){document.documentElement.lang=lang; $('language').value=lang;document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=copy(el.dataset.copy));}
render();
$('endpoint').value='http://127.0.0.1:5173';
try {const saved=localStorage.getItem('ootie_custom_endpoint');if(webUrl(saved)) $('endpoint').value=new URL(saved).origin;} catch {}
$('language').addEventListener('change',()=>{lang=$('language').value;try{localStorage.setItem('ootie_language',lang);}catch{}render();});
function preview(){const url=webUrl($('image').value);if(url)$('preview').src=url;else $('preview').removeAttribute('src');}
$('image').addEventListener('input',preview);$('preview').addEventListener('error',()=>$('preview').removeAttribute('src'));
async function readPage(){
 $('status').textContent=copy('reading');$('refresh').disabled=true;
 try {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id || !webUrl(tab.url)) throw new Error('unsupported');
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  const data=result?.result || {};
  $('title').value=String(data.title || tab.title || '').slice(0,160);$('url').value=webUrl(data.url) || webUrl(tab.url);$('image').value=webUrl(data.image);preview();$('status').textContent=copy('ready');
 } catch { $('status').textContent=copy('unavailable'); }
 finally {$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',readPage);
$('productForm').addEventListener('submit',async(event)=>{
 event.preventDefault();$('send').disabled=true;
 try {
  const target=buildHandoff($('endpoint').value,{title:$('title').value,url:$('url').value,image:$('image').value},lang);
  try{localStorage.setItem('ootie_custom_endpoint',new URL(target).origin);}catch{}
  await chrome.tabs.create({url:target});$('status').textContent=copy('opened');
 }catch(error){$('status').textContent=copy(error.message==='title'?'titleError':'endpointError');}
 finally{$('send').disabled=false;}
});
void readPage();
