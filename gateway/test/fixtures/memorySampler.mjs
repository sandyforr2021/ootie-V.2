// Local-only fixture; never imported by the application server.
import sharp from 'sharp';
import {normalizeGarmentImageForAi} from '../../src/image.js';
setInterval(()=>console.log(JSON.stringify({event:'stress_memory',rssMiB:process.memoryUsage().rss/1048576})),100).unref();
process.on('message',async message=>{if(message!=='convert')return;try{const image=await sharp({create:{width:4096,height:4096,channels:3,background:'#a784c3'}}).webp().toBuffer();await Promise.all(Array.from({length:8},()=>normalizeGarmentImageForAi(image,'image/webp')));process.send?.({converted:8});}catch(e){process.send?.({error:e.code||e.message});}});
