import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createStaticSite} from '../src/staticSite.js';
test('serves SPA routes and assets but never secrets, traversal, or API paths',async()=>{
 const root=join(tmpdir(),'ootie-static-'+randomUUID());await mkdir(join(root,'assets'),{recursive:true});
 await writeFile(join(root,'index.html'),'<h1>OOTIE</h1>');await writeFile(join(root,'assets','app.js'),'export {};');
 await writeFile(join(root,'.env'),'PRIVATE');
 const serve=createStaticSite(root);
 assert.equal((await serve('/shop')).status,200);
 assert.match((await serve('/shop')).headers['Content-Type'],/html/);
 assert.match((await serve('/assets/app.js')).headers['Cache-Control'],/immutable/);
 assert.equal((await serve('/shop','HEAD')).rawBody.length,0);
 for(const path of ['/.env','/%2eenv','/%2e%2e/.env','/api/v1/shop/jobs','/v1/shop/jobs','/assets/missing.js','/unknown','/healthz'])assert.equal(await serve(path),null,path);
 assert.equal(await serve('/shop','POST'),null);
});
