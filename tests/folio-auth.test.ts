import assert from 'node:assert/strict';
import test from 'node:test';
import {environment,client,setupOwner,setupMember,OWNER_PASSWORD,MEMBER_PASSWORD} from './folio-auth-helpers.mjs';
import {requireMembership} from '../worker/auth.mjs';
import {sha256} from '../worker/auth-common.mjs';

const BASE='/api/folio-auth';

test('real credentials, owner bootstrap, recipient registration and member boundaries',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const anonymous=client(env),owner=client(env,env.FOLIO_OWNER_SITE_USER_ID);
  const initial=await (await owner.request(BASE+'/session')).json();
  assert.equal(initial.setupRequired,true);assert.equal(initial.canBootstrap,true);assert.equal(initial.authenticated,false);
  assert.equal((await (await anonymous.request(BASE+'/session')).json()).canBootstrap,false);
  const input={email:'owner@example.test',name:'Owner fixture',password:OWNER_PASSWORD};
  assert.equal((await anonymous.request(BASE+'/bootstrap','POST',input)).status,403);
  assert.equal((await owner.request(BASE+'/bootstrap','POST',input,{origin:'https://evil.test'})).status,403);
  assert.equal((await owner.request(BASE+'/sign-up/email','POST',input)).status,404);
  const response=await owner.request(BASE+'/bootstrap','POST',input);
  assert.equal(response.status,201,await response.clone().text());
  for(const attribute of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.match(response.headers.get('set-cookie')!,new RegExp(attribute));
  const ownerAccount=(await response.json()).account;
  const stored=await env.DB.prepare("SELECT password FROM account WHERE userId=? AND providerId='credential'").bind(ownerAccount.id).first();
  assert.match(stored.password,/^folio-scrypt-v1\$/);assert.notEqual(stored.password,OWNER_PASSWORD);
  assert.equal((await owner.request(BASE+'/bootstrap','POST',input)).status,409);
  const current=await (await owner.request(BASE+'/session')).json();
  assert.equal(current.account.role,'owner');assert.equal(current.setupRequired,false);
  assert.equal('token' in current,false);assert.equal('userId' in current,false);
  const invited=await owner.request(BASE+'/invitations','POST',{email:'MEMBER@example.test'});
  assert.equal(invited.status,201);
  const invite=await invited.json();
  const tokenRow=await env.DB.prepare('SELECT token_hash FROM folio_tokens WHERE email=?').bind('member@example.test').first();
  assert.equal(tokenRow.token_hash,await sha256(invite.token));assert.notEqual(tokenRow.token_hash,invite.token);
  assert.equal((await anonymous.request(BASE+'/register','POST',{email:'wrong@example.test',name:'Wrong',password:MEMBER_PASSWORD,token:invite.token})).status,400);
  const member=client(env,'member-site'),registration=await member.request(BASE+'/register','POST',{email:'member@example.test',name:'Member',password:MEMBER_PASSWORD,token:invite.token});
  assert.equal(registration.status,201,await registration.clone().text());
  const memberAccount=(await registration.json()).account;
  assert.equal(memberAccount.role,'member');assert.notEqual(memberAccount.id,ownerAccount.id);
  assert.equal((await anonymous.request(BASE+'/register','POST',{email:'member@example.test',name:'Replay',password:MEMBER_PASSWORD,token:invite.token})).status,400);
  assert.equal((await member.request(BASE+'/invitations','POST',{email:'outsider@example.test'})).status,403);
  assert.equal((await member.request(BASE+'/members')).status,403);
  assert.equal((await owner.request(BASE+'/members/'+ownerAccount.id,'PATCH',{status:'disabled'})).status,403);
  const updated=await member.request(BASE+'/profile','PATCH',{name:'Updated member',id:ownerAccount.id,role:'owner'});
  assert.equal(updated.status,200);assert.equal((await updated.json()).account.role,'member');
  assert.equal((await (await owner.request(BASE+'/session')).json()).account.name,'Owner fixture');
  assert.equal((await (await member.request(BASE+'/session')).json()).account.name,'Updated member');
  assert.equal((await member.request(BASE+'/profile','PATCH',{name:'Changed without origin'},{origin:''})).status,403);
  const forged=await requireMembership(new Request('https://folio.test/api/collection',{headers:{'oai-authenticated-user-id':env.FOLIO_OWNER_SITE_USER_ID,'authorization':'Bearer forged'}}),env);
  assert(forged instanceof Response);assert.equal(forged.status,401);
  const all=(await (await owner.request(BASE+'/members')).json()).members;
  assert.equal(all.length,2);assert.equal(all.filter((m:any)=>m.role==='owner').length,1);
});

test('password change, disabled members and logout revoke real server sessions',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const {owner,response}=await setupOwner(env);assert.equal(response.status,201);
  const {member,response:registered}=await setupMember(env,owner);assert.equal(registered.status,201);
  const memberId=(await registered.json()).account.id;
  const second=client(env,'another-device');
  assert.equal((await second.request(BASE+'/login','POST',{email:'member@example.test',password:MEMBER_PASSWORD})).status,200);
  const stale=second.cookie;
  assert.equal((await member.request(BASE+'/password','POST',{currentPassword:'Wrong password 12345',newPassword:'New member password 443!'})).status,401);
  const changed=await member.request(BASE+'/password','POST',{currentPassword:MEMBER_PASSWORD,newPassword:'New member password 443!'});
  assert.equal(changed.status,200,await changed.clone().text());
  assert.equal((await (await second.request(BASE+'/session')).json()).authenticated,false);
  assert.equal((await (await member.request(BASE+'/session')).json()).authenticated,true);
  assert.equal((await second.request(BASE+'/login','POST',{email:'member@example.test',password:MEMBER_PASSWORD})).status,401);
  assert.equal((await second.request(BASE+'/login','POST',{email:'member@example.test',password:'New member password 443!'})).status,200);
  const beforeDisable=second.cookie;
  assert.equal((await owner.request(BASE+'/members/'+memberId,'PATCH',{status:'disabled'})).status,200);
  assert.equal((await (await second.request(BASE+'/session')).json()).authenticated,false);
  assert.equal((await second.request(BASE+'/login','POST',{email:'member@example.test',password:'New member password 443!'})).status,403);
  assert.equal((await owner.request(BASE+'/members/'+memberId,'PATCH',{status:'active'})).status,200);
  second.cookie=beforeDisable;
  assert.equal((await (await second.request(BASE+'/session')).json()).authenticated,false);
  assert.equal((await second.request(BASE+'/login','POST',{email:'member@example.test',password:'New member password 443!'})).status,200);
  const beforeLogout=second.cookie;
  assert.equal((await second.request(BASE+'/logout','POST',{})).status,200);
  assert.equal(second.cookie,'');second.cookie=beforeLogout;
  assert.equal((await (await second.request(BASE+'/session')).json()).authenticated,false);
  second.cookie=stale;assert.equal((await (await second.request(BASE+'/session')).json()).authenticated,false);
});

test('recovery has step-up, trusted owner authority, expiry, recipient binding and replay protection',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const {owner}=await setupOwner(env),{member,response}=await setupMember(env,owner);
  const memberId=(await response.json()).account.id;
  const outsider=client(env,'outsider');
  assert.equal((await outsider.request(BASE+'/owner-recovery','POST',{})).status,403);
  assert.equal((await member.request(BASE+'/members/'+memberId+'/recovery','POST',{currentPassword:MEMBER_PASSWORD})).status,403);
  assert.equal((await owner.request(BASE+'/members/'+memberId+'/recovery','POST',{currentPassword:'Incorrect password 782'})).status,401);
  const recovery=await owner.request(BASE+'/members/'+memberId+'/recovery','POST',{currentPassword:OWNER_PASSWORD});
  assert.equal(recovery.status,201);const first=await recovery.json();
  await env.DB.prepare('UPDATE folio_tokens SET expires_at=0 WHERE token_hash=?').bind(await sha256(first.token)).run();
  assert.equal((await outsider.request(BASE+'/recovery','POST',{email:first.email,token:first.token,newPassword:'Reset password one 88!'})).status,400);
  const fresh=await (await owner.request(BASE+'/members/'+memberId+'/recovery','POST',{currentPassword:OWNER_PASSWORD})).json();
  assert.equal((await outsider.request(BASE+'/recovery','POST',{email:'wrong@example.test',token:fresh.token,newPassword:'Reset password one 88!'})).status,400);
  assert.equal((await outsider.request(BASE+'/recovery','POST',{email:fresh.email,token:fresh.token,newPassword:'short'})).status,400);
  const oldSession=member.cookie;
  assert.equal((await outsider.request(BASE+'/recovery','POST',{email:fresh.email,token:fresh.token,newPassword:'Reset password one 88!'})).status,200);
  assert.equal((await outsider.request(BASE+'/recovery','POST',{email:fresh.email,token:fresh.token,newPassword:'Reset password two 99!'})).status,400);
  member.cookie=oldSession;assert.equal((await (await member.request(BASE+'/session')).json()).authenticated,false);
  assert.equal((await member.request(BASE+'/login','POST',{email:fresh.email,password:MEMBER_PASSWORD})).status,401);
  assert.equal((await member.request(BASE+'/login','POST',{email:fresh.email,password:'Reset password one 88!'})).status,200);
  const trustedWithoutAppSession=client(env,env.FOLIO_OWNER_SITE_USER_ID);
  const ownerReset=await trustedWithoutAppSession.request(BASE+'/owner-recovery','POST',{});
  assert.equal(ownerReset.status,201);const capability=await ownerReset.json();
  assert.equal((await trustedWithoutAppSession.request(BASE+'/recovery','POST',{email:capability.email,token:capability.token,newPassword:'Recovered owner password 93!'})).status,200);
  assert.equal((await (await owner.request(BASE+'/session')).json()).authenticated,false);
  assert.equal((await trustedWithoutAppSession.request(BASE+'/login','POST',{email:capability.email,password:'Recovered owner password 93!'})).status,200);
});

test('concurrent bootstrap makes one owner and persistent limits survive separate clients',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const first=client(env,env.FOLIO_OWNER_SITE_USER_ID),second=client(env,env.FOLIO_OWNER_SITE_USER_ID);
  const results=await Promise.all([
    first.request(BASE+'/bootstrap','POST',{email:'first@example.test',name:'First fixture',password:OWNER_PASSWORD}),
    second.request(BASE+'/bootstrap','POST',{email:'second@example.test',name:'Second fixture',password:OWNER_PASSWORD}),
  ]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS count FROM folio_members WHERE role='owner'").first()).count,1);
  for(let index=0;index<11;index++) {
    const caller=client({...env},'independent-attempt-'+index);
    const response=await caller.request(BASE+'/login','POST',{email:'nonexistent@example.test',password:'Incorrect long password 28!'});
    assert.equal(response.status,index<10?401:429);
  }
  const tooLarge=await first.request(BASE+'/login','POST',{email:'large@example.test',password:'x'.repeat(20_000)});
  assert.equal(tooLarge.status,413);
});

test('an old-password login cannot create a usable session after a concurrent recovery',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const {owner}=await setupOwner(env),{response}=await setupMember(env,owner);
  const memberId=(await response.json()).account.id;
  const recovery=await (await owner.request(BASE+'/members/'+memberId+'/recovery','POST',{currentPassword:OWNER_PASSWORD})).json();
  let reached!:()=>void,release!:()=>void;
  const paused=new Promise<void>(resolve=>{reached=resolve;}),resume=new Promise<void>(resolve=>{release=resolve;});
  const prepare=env.DB.prepare.bind(env.DB);let armed=true;
  env.DB.prepare=(sql:string)=>{
    const wrap=(statement:any):any=>({...statement,bind:(...params:any[])=>wrap(statement.bind(...params)),all:async()=>{
      if(armed&&/^insert into "session"/i.test(sql)){armed=false;reached();await resume;}
      return statement.all();
    }});
    return wrap(prepare(sql));
  };
  const pendingClient=client(env,'racing-login'),pending=pendingClient.request(BASE+'/login','POST',{email:'member@example.test',password:MEMBER_PASSWORD});
  try {
    await Promise.race([paused,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Session insertion was not reached')),5000);timer.unref();})]);
    const resetter=client(env,'reset-consumer');
    assert.equal((await resetter.request(BASE+'/recovery','POST',{email:recovery.email,token:recovery.token,newPassword:'Concurrent reset password 922!'})).status,200);
  } finally {release();}
  assert.equal((await pending).status,401);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM session WHERE userId=?').bind(memberId).first()).count,0);
  assert.equal((await (await pendingClient.request(BASE+'/session')).json()).authenticated,false);
});

test('changing a password revokes previously issued recovery capabilities',async t=>{
  const env=await environment();t.after(()=>env.DB.close());const {owner}=await setupOwner(env);
  const prior=await (await owner.request(BASE+'/owner-recovery','POST',{})).json();
  assert.equal((await owner.request(BASE+'/password','POST',{currentPassword:OWNER_PASSWORD,newPassword:'Changed owner password 772!'})).status,200);
  const resetter=client(env,'link-consumer');
  assert.equal((await resetter.request(BASE+'/recovery','POST',{email:prior.email,token:prior.token,newPassword:'Obsolete link password 337!'})).status,400);
  const fresh=await (await owner.request(BASE+'/owner-recovery','POST',{})).json();
  assert.equal((await resetter.request(BASE+'/recovery','POST',{email:fresh.email,token:fresh.token,newPassword:'Fresh recovery password 338!'})).status,200);
  assert.equal((await resetter.request(BASE+'/login','POST',{email:fresh.email,password:'Fresh recovery password 338!'})).status,200);
});

test('interrupted registration can be reinvited and resumed without granting unproved membership',async t=>{
  const env=await environment();t.after(()=>env.DB.close());const {owner}=await setupOwner(env);
  const address='interrupted@example.test',recipient=client(env,'interrupted-recipient');
  const first=await (await owner.request(BASE+'/invitations','POST',{email:address})).json();
  const prepare=env.DB.prepare.bind(env.DB);let fail=true;
  env.DB.prepare=(sql:string)=>{
    if(fail&&sql.startsWith('INSERT INTO folio_members')){fail=false;throw new Error('synthetic membership interruption');}
    return prepare(sql);
  };
  const body={email:address,name:'Interrupted member',password:MEMBER_PASSWORD,token:first.token};
  assert.equal((await recipient.request(BASE+'/register','POST',body)).status,503);
  const incomplete=await env.DB.prepare('SELECT id FROM user WHERE email=?').bind(address).first();assert(incomplete);
  assert.equal((await (await recipient.request(BASE+'/session')).json()).authenticated,false);
  const replacement=await owner.request(BASE+'/invitations','POST',{email:address});assert.equal(replacement.status,201);
  const second=await replacement.json();
  assert.equal((await recipient.request(BASE+'/register','POST',{...body,token:second.token,password:'Wrong replacement password 66!'})).status,400);
  const resumed=await recipient.request(BASE+'/register','POST',{...body,token:second.token});assert.equal(resumed.status,201,await resumed.clone().text());
  assert.equal((await resumed.json()).account.id,incomplete.id);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM user WHERE email=?').bind(address).first()).count,1);
  assert.equal((await owner.request(BASE+'/invitations','POST',{email:address})).status,409);
  // Separate SDK failure point: user INSERT committed, credential INSERT did not.
  const id=crypto.randomUUID(),now=new Date().toISOString(),partialEmail='user-only@example.test';
  await env.DB.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,?,?)').bind(id,'Partial fixture',partialEmail,now,now).run();
  const partial=await (await owner.request(BASE+'/invitations','POST',{email:partialEmail})).json();
  const fixed=await client(env,'partial-recipient').request(BASE+'/register','POST',{email:partialEmail,name:'Recovered member',password:MEMBER_PASSWORD,token:partial.token});
  assert.equal(fixed.status,201,await fixed.clone().text());assert.equal((await fixed.json()).account.id,id);
});
