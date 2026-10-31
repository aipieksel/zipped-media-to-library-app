/** Explicit local fixture check; not a production account or AI/provider test. */
import assert from 'node:assert/strict';
import {createQaWorkspaceFixture,QA_WORKSPACE_ACCOUNT} from '../scripts/qa-workspace-plugin';

const fixture=await createQaWorkspaceFixture(process.cwd());
try {
  const session=await fixture.login();assert.equal(session.status,200);
  const account=await session.json() as {account:{email:string;role:string}};
  assert.equal(account.account.email,QA_WORKSPACE_ACCOUNT.email);assert.equal(account.account.role,'owner');
  const cookie=session.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const collection=await fixture.dispatch('/api/collection','GET',new Headers({cookie}));assert.equal(collection.status,200);
  assert.deepEqual((await collection.json() as {archives:unknown[]}).archives,[]);
  await Promise.all(['library','icons','appearance'].map(async name=>{
    const document=await fixture.dispatch('/api/workspace/documents/'+name,'GET',new Headers({cookie}));
    const body=await document.json();
    assert.equal(document.status,200,JSON.stringify(body));
    assert.deepEqual(body,{name,revision:0,data:null,blobs:[],updatedAt:null});
  }));
  const loggedOut=await fixture.dispatch('/api/folio-auth/logout','POST',new Headers({cookie,origin:'http://folio-qa.test','content-type':'application/json'}),new TextEncoder().encode('{}'));assert.equal(loggedOut.status,200);
  assert.equal((await fixture.dispatch('/api/collection','GET',new Headers({cookie}))).status,401);
  console.log('Isolated development QA fixture: real login, empty catalogue, all three empty shared documents and logout verified.');
} finally {await fixture.close();}
