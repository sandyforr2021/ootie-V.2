import { pipeline, env, RawImage } from '@huggingface/transformers';
import { clothingModel, clothingVisionLabels, garmentSuggestion } from '../services/clothingVisionLabels.js';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
self.onmessage=async ({data})=>{
  try {
    self.postMessage({state:'loading'});
    const classify=await pipeline('zero-shot-image-classification',clothingModel.id,{
      revision:clothingModel.revision,device:'wasm',dtype:'q8',
    });
    self.postMessage({state:'analyzing'});
    const image=await RawImage.fromBlob(data.blob);
    const predictions=await classify(image,clothingVisionLabels.map(([label])=>label));
    self.postMessage({state:'done',suggestion:garmentSuggestion(predictions)});
    await classify.dispose();
  } catch { self.postMessage({state:'error'}); }
};
