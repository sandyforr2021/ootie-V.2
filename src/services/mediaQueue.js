export function createMediaQueue(concurrency=2){
 let active=0;const waiting=[];
 const drain=()=>{while(active<concurrency && waiting.length){const {action,resolve,reject}=waiting.shift();active++;Promise.resolve().then(action).then(resolve,reject).finally(()=>{active--;drain();});}};
 return {run:action=>new Promise((resolve,reject)=>{waiting.push({action,resolve,reject});drain();})};
}
export const privateMediaQueue=createMediaQueue(2);
