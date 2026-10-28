// Inference happens in a disposable browser worker. The only remote requests
// download public model weights; the selected photo never leaves this device.
export function identifyClothing(blob,{signal,onState=()=>{}}={}) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../workers/clothingVision.worker.js',import.meta.url),{type:'module'});
    let settled=false;
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(timeout);worker.terminate();signal?.removeEventListener('abort',abort);
      if(error)reject(error);else resolve(result);
    };
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    const timeout=setTimeout(()=>finish(new Error('VISION_TIMEOUT')),240000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>finish(new Error('VISION_UNAVAILABLE'));
    worker.onmessage=({data})=>{
      if(data.state==='done')finish(null,data.suggestion);
      else if(data.state==='error')finish(new Error('VISION_UNAVAILABLE'));
      else onState(data.state);
    };
    if(signal?.aborted)return abort();
    worker.postMessage({blob});
  });
}
