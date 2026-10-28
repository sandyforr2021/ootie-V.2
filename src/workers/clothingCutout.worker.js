import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { removeUniformBackground } from '../services/simpleBackgroundRemoval';

// MIT-licensed 512px export. Public weights are downloaded; photos stay local.
const modelId = 'studioludens/birefnet-lite-512';
const revision = '962e67969ec6acec9c19fab76acee4f5e22e990c';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let model, processor;
self.onmessage = async ({ data }) => {
  const send = (payload) => self.postMessage({ id: data.id, ...payload });
  try {
    let image = await RawImage.fromBlob(data.blob);
    if (image.channels === 4) {
      let transparent = 0;
      for (let i = 3; i < image.data.length; i += 4) if (image.data[i] < 240) transparent++;
      if (transparent / (image.width * image.height) > 0.01) {
        send({ state: 'done', result: { displayBlob: data.blob, width: image.width, height: image.height } });
        return;
      }
    }
    if (!model) {
      send({ state: 'loading' });
      model = await AutoModel.from_pretrained(modelId, { revision, dtype: 'fp16', device: 'wasm' });
      processor = await AutoProcessor.from_pretrained(modelId, { revision });
    }
    send({ state: 'processing' });
    if (Math.max(image.width, image.height) > 1200) {
      const scale = 1200 / Math.max(image.width, image.height);
      image = await image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
    }
    const { pixel_values } = await processor(image);
    const outputs = await model({ input_image: pixel_values });
    const logits = outputs.logits || outputs.output_image || Object.values(outputs)[0];
    const mask = await RawImage.fromTensor(logits[0].sigmoid().mul(255).to('uint8')).resize(image.width, image.height);
    // Reject an empty/near-empty prediction instead of saving invisible clothes.
    const foreground = mask.data.reduce((count, alpha) => count + (alpha > 128 ? 1 : 0), 0);
    if (foreground / mask.data.length < 0.005) throw new Error('EMPTY_MASK');
    const result = image.clone().rgba();
    const bagBackground = /bag|包/i.test(data.category || '') ? removeUniformBackground({
      pixels: result.data, width: result.width, height: result.height, tolerance: 6, bag: true
    }) : null;
    result.putAlpha(mask);
    if (bagBackground) for (let i = 3; i < result.data.length; i += 4) {
      result.data[i] = Math.min(result.data[i], bagBackground[i]);
    }
    const displayBlob = await result.toBlob();
    if (displayBlob.size > 6 * 1024 * 1024) throw new Error('CUTOUT_TOO_LARGE');
    send({ state: 'done', result: { displayBlob, width: image.width, height: image.height } });
    pixel_values.dispose?.();
    for (const tensor of Object.values(outputs)) tensor.dispose?.();
  } catch (error) { send({ state: 'error', code: error?.message || 'CUTOUT_UNAVAILABLE' }); }
};
