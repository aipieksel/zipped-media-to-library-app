import {betterAuth} from 'better-auth';
import {hashPassword,verifyPassword} from './auth-password.mjs';
import {HttpError,json,failure,assertOrigin,bodyJSON,sha256,randomToken,rateLimit,clientIdentity,method} from './auth-common.mjs';

const BASE = '/api/folio-auth';
const SIGN_IN = '/signin-with-chatgpt?return_to=%2F';
const SIGN_OUT = '/signout-with-chatgpt?return_to=%2F';
const DAY = 86_400_000;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

function configured(env) {
  if (!env.DB || typeof env.FOLIO_AUTH_SECRET !== 'string' || env.FOLIO_AUTH_SECRET.length < 32 || !env.FOLIO_OWNER_SITE_USER_ID) throw new HttpError(503,'not_configured','Account setup is not available yet.');
}
function trustedOwner(request,env) {
  return typeof env.FOLIO_OWNER_SITE_USER_ID === 'string' && env.FOLIO_OWNER_SITE_USER_ID.length > 0 && request.headers.get('oai-authenticated-user-id') === env.FOLIO_OWNER_SITE_USER_ID;
}
function email(value) {
  if (typeof value !== 'string' || value.length > 254 || CONTROL.test(value)) throw new HttpError(400,'email','Enter a valid email address.');
  const result = value.trim().toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(result)) throw new HttpError(400,'email','Enter a valid email address.');
  return result;
}
function name(value) {
  if (typeof value !== 'string' || CONTROL.test(value)) throw new HttpError(400,'name','Enter a name of 1–80 characters.');
  const result = value.normalize('NFC').trim();
  if (!result || result.length > 80) throw new HttpError(400,'name','Enter a name of 1–80 characters.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || new TextEncoder().encode(value).length > 512) throw new HttpError(400,'password','Use a password of 12–128 characters.');
  return value;
}
function capability(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new HttpError(400,'invalid_token','This link is invalid or has expired.');
  return value;
}
function publicAccount(user,role) { return {id:user.id,email:user.email,name:user.name,role}; }

/** No generic Better Auth handler is exposed. Only reviewed Folio wrappers below. */
export function createAuth(env,origin) {
  configured(env);
  return betterAuth({
    database:env.DB, secret:env.FOLIO_AUTH_SECRET, baseURL:origin, basePath:BASE,
    trustedOrigins:[origin], appName:'Folio',
    emailAndPassword:{enabled:true,autoSignIn:false,minPasswordLength:12,maxPasswordLength:128,password:{hash:hashPassword,verify:verifyPassword}},
    session:{expiresIn:7*86400,updateAge:86400,cookieCache:{enabled:false}},
    user:{changeEmail:{enabled:false}},
    advanced:{cookiePrefix:'folio',useSecureCookies:origin.startsWith('https:'),defaultCookieAttributes:{httpOnly:true,sameSite:'lax',path:'/'},database:{generateId:()=>crypto.randomUUID()}},
    // Every public wrapper has D1-backed limits. No ineffective per-instance map.
    rateLimit:{enabled:false}, logger:{disabled:true}, telemetry:{enabled:false},
  });
}

async function sessionMember(request,env) {
  configured(env);
  const auth = createAuth(env,new URL(request.url).origin);
  const session = await auth.api.getSession({headers:request.headers,query:{disableCookieCache:true}});
  if (!session?.user?.id) throw new HttpError(401,'signed_out','Please log in to Folio.');
  const member = await env.DB.prepare('SELECT role,status FROM folio_members WHERE user_id=?').bind(session.user.id).first();
  if (!member || member.status !== 'active') throw new HttpError(403,'membership','This account does not have active workspace access.');
  return {auth,session,account:publicAccount(session.user,member.role)};
}

/** Root uses this for legacy collection GET/HEAD. A Response means access denied. */
export async function requireMembership(request,env) {
  try { return (await sessionMember(request,env)).account; } catch (error) { return failure(error); }
}

async function ownerMember(request,env) {
  const value = await sessionMember(request,env);
  if (value.account.role !== 'owner') throw new HttpError(403,'owner_required','Only the workspace owner can perform this action.');
  return value;
}
async function ownerRecord(env) {
  return env.DB.prepare("SELECT u.id,u.email,u.name FROM user u JOIN folio_members m ON m.user_id=u.id WHERE m.role='owner'").first();
}
async function authResponse(action, code='credentials') {
  const response = await action();
  if (!response.ok) {
    if (response.status >= 500) throw new HttpError(503,'unavailable','The account service is unavailable. Please try again.');
    throw new HttpError(code==='registration'?400:401,code,code==='registration'?'This registration could not be completed. Check the link and details.':'The email or password could not be verified.');
  }
  return response;
}
async function login(auth,request,env,address,secret,status=200) {
  // Password verification is deliberately slow. Fence session creation against
  // a password replacement/recovery that revokes sessions during that await.
  const before=await env.DB.prepare("SELECT u.id,a.password FROM user u JOIN account a ON a.userId=u.id AND a.providerId='credential' WHERE u.email=?").bind(address).first();
  const response = await authResponse(()=>auth.api.signInEmail({headers:request.headers,body:{email:address,password:secret,rememberMe:true},asResponse:true}));
  const result = await response.json();
  const after=result.user?.id&&await env.DB.prepare("SELECT password FROM account WHERE userId=? AND providerId='credential'").bind(result.user.id).first();
  if(!before||before.id!==result.user?.id||before.password!==after?.password) {
    if(result.token&&result.user?.id) await env.DB.prepare('DELETE FROM session WHERE token=? AND userId=?').bind(result.token,result.user.id).run();
    throw new HttpError(401,'credentials','The credentials changed during login. Please log in again.');
  }
  const member = result.user?.id && await env.DB.prepare('SELECT role,status FROM folio_members WHERE user_id=?').bind(result.user.id).first();
  if (!member || member.status !== 'active') {
    if (result.user?.id) await env.DB.prepare('DELETE FROM session WHERE userId=?').bind(result.user.id).run();
    throw new HttpError(403,'membership','This account does not have active workspace access.');
  }
  return json({account:publicAccount(result.user,member.role)},status,response.headers);
}
async function createUser(auth,request,env,address,displayName,secret) {
  const response = await authResponse(()=>auth.api.signUpEmail({headers:request.headers,body:{email:address,name:displayName,password:secret},asResponse:true}),'registration');
  const result = await response.json();
  // autoSignIn:false intentionally returns a synthetic duplicate user. Never
  // convert that response into membership or resolve it by a caller's email.
  const actual = result.user?.id && await env.DB.prepare('SELECT id,email FROM user WHERE id=?').bind(result.user.id).first();
  if (actual?.email === address) return actual;
  // A storage interruption can leave a credential account before membership is
  // committed. Resume only after proving that password and a fresh authorized
  // bootstrap/invitation. Never attach an existing active account by email.
  const incomplete=await env.DB.prepare("SELECT u.id,u.email,a.password,a.id AS credential_id FROM user u LEFT JOIN account a ON a.userId=u.id AND a.providerId='credential' LEFT JOIN folio_members m ON m.user_id=u.id WHERE u.email=? AND m.user_id IS NULL").bind(address).first();
  if (incomplete?.password && await verifyPassword({hash:incomplete.password,password:secret})) return {id:incomplete.id,email:incomplete.email};
  if(incomplete&&!incomplete.credential_id) {
    // A crash between the SDK's user and credential INSERTs is recoverable only
    // inside an already authorized owner bootstrap or recipient invitation.
    const now=new Date().toISOString(),hash=await hashPassword(secret);
    const inserted=await env.DB.prepare("INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) SELECT ?,?,'credential',?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM account WHERE userId=? AND providerId='credential') AND NOT EXISTS (SELECT 1 FROM folio_members WHERE user_id=?)").bind(crypto.randomUUID(),incomplete.id,incomplete.id,hash,now,now,incomplete.id,incomplete.id).run();
    if(inserted.meta.changes===1)return {id:incomplete.id,email:incomplete.email};
  }
  throw new HttpError(400,'registration','This registration could not be completed. Check the link and details.');
}
async function freshCapability(env,kind,address,target,actor,ttl) {
  const token = randomToken(), id = crypto.randomUUID(), now = Date.now(), expiresAt = now+ttl;
  // Replace previous outstanding capabilities for this recipient/type. No mail.
  await env.DB.batch([
    env.DB.prepare('UPDATE folio_tokens SET consumed_at=? WHERE kind=? AND email=? AND consumed_at IS NULL').bind(now,kind,address),
    env.DB.prepare('INSERT INTO folio_tokens(id,token_hash,kind,email,user_id,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,await sha256(token),kind,address,target,actor,now,expiresAt),
  ]);
  return {token,email:address,expiresAt};
}
async function stepUp(env,account,currentPassword) {
  const secret = password(currentPassword);
  const row = await env.DB.prepare("SELECT password FROM account WHERE userId=? AND providerId='credential'").bind(account.id).first();
  if (!row?.password || !await verifyPassword({hash:row.password,password:secret})) throw new HttpError(401,'credentials','The current password could not be verified.');
}

export async function handleFolioAuth(request,env) {
  const path = new URL(request.url).pathname;
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return null;
  try {
    configured(env);
    const origin = new URL(request.url).origin;
    if (env.FOLIO_APP_ORIGIN && env.FOLIO_APP_ORIGIN !== origin) throw new HttpError(403,'origin','Use the configured Folio address.');
    if (!['GET','HEAD'].includes(request.method)) assertOrigin(request,env);
    const route = path.slice(BASE.length);
    if (route === '/session') {
      method(request,'GET');
      const owner = await ownerRecord(env);
      let account = null;
      try { account = (await sessionMember(request,env)).account; } catch (error) { if (!(error instanceof HttpError) || ![401,403].includes(error.status)) throw error; }
      const trusted = trustedOwner(request,env);
      return json({authenticated:!!account,account,setupRequired:!owner,canBootstrap:!owner&&trusted,canRecoverOwner:!!owner&&trusted,siteSignInPath:SIGN_IN,siteSignOutPath:SIGN_OUT});
    }
    if (route === '/bootstrap') {
      method(request,'POST');
      if (!trustedOwner(request,env)) throw new HttpError(403,'owner_required','Open Folio as its configured Site owner to initialize the account.');
      await rateLimit(env,'bootstrap',clientIdentity(request),5,60*60_000);
      if (await ownerRecord(env)) throw new HttpError(409,'initialized','The workspace owner account is already initialized.');
      const body = await bodyJSON(request), address=email(body.email),displayName=name(body.name),secret=password(body.password);
      const auth = createAuth(env,origin), user = await createUser(auth,request,env,address,displayName,secret);
      try {
        // The partial unique index makes this an atomic one-owner claim. A losing
        // concurrent request has no membership, no session and no private access.
        await env.DB.prepare("INSERT INTO folio_members(user_id,role,status,created_at) VALUES (?,'owner','active',?)").bind(user.id,Date.now()).run();
      } catch {
        throw new HttpError(409,'initialized','The workspace owner account is already initialized.');
      }
      return await login(auth,request,env,address,secret,201);
    }
    if (route === '/login') {
      method(request,'POST');
      const body = await bodyJSON(request), address=email(body.email),secret=password(body.password);
      await rateLimit(env,'login-client',clientIdentity(request),20);
      await rateLimit(env,'login-email',address,10);
      return await login(createAuth(env,origin),request,env,address,secret);
    }
    if (route === '/register') {
      method(request,'POST');
      await rateLimit(env,'register',clientIdentity(request),10,60*60_000);
      const body = await bodyJSON(request),address=email(body.email),displayName=name(body.name),secret=password(body.password),hash=await sha256(capability(body.token)),now=Date.now();
      const invite = await env.DB.prepare("SELECT id FROM folio_tokens WHERE token_hash=? AND kind='invite' AND email=? AND consumed_at IS NULL AND expires_at>?").bind(hash,address,now).first();
      if (!invite) throw new HttpError(400,'invalid_token','This invitation is invalid or has expired.');
      const auth = createAuth(env,origin),user=await createUser(auth,request,env,address,displayName,secret);
      const committedAt=Date.now();
      const result = await env.DB.batch([
        env.DB.prepare("INSERT INTO folio_members(user_id,role,status,created_at) SELECT ?,'member','active',? WHERE EXISTS (SELECT 1 FROM folio_tokens WHERE token_hash=? AND kind='invite' AND email=? AND consumed_at IS NULL AND expires_at>?)").bind(user.id,committedAt,hash,address,committedAt),
        env.DB.prepare("UPDATE folio_tokens SET consumed_at=? WHERE token_hash=? AND kind='invite' AND email=? AND consumed_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM folio_members WHERE user_id=?)").bind(committedAt,hash,address,committedAt,user.id),
      ]);
      if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1) throw new HttpError(400,'invalid_token','This invitation is invalid or has expired.');
      return await login(auth,request,env,address,secret,201);
    }
    if (route === '/logout') {
      method(request,'POST'); await bodyJSON(request);
      const response = await createAuth(env,origin).api.signOut({headers:request.headers,asResponse:true});
      return json({ok:true},200,response.headers);
    }
    if (route === '/profile') {
      method(request,'PATCH');
      const {account}=await sessionMember(request,env),body=await bodyJSON(request);
      await rateLimit(env,'profile',account.id,20);
      const displayName=name(body.name);
      await env.DB.prepare('UPDATE user SET name=?,updatedAt=? WHERE id=?').bind(displayName,new Date().toISOString(),account.id).run();
      return json({account:{...account,name:displayName}});
    }
    if (route === '/password') {
      method(request,'POST');
      const {auth,account}=await sessionMember(request,env),body=await bodyJSON(request);
      await rateLimit(env,'password',account.id,5);
      const currentPassword=password(body.currentPassword),newPassword=password(body.newPassword);
      const credential=await env.DB.prepare("SELECT id,password FROM account WHERE userId=? AND providerId='credential'").bind(account.id).first();
      if (!credential?.password || !await verifyPassword({hash:credential.password,password:currentPassword})) throw new HttpError(401,'credentials','The current password could not be verified.');
      const nextHash=await hashPassword(newPassword);
      // D1 has no interactive transaction. Explicit batch + hash CAS prevents a
      // concurrent password change from accepting an obsolete current password.
      const result=await env.DB.batch([
        env.DB.prepare('UPDATE account SET password=?,updatedAt=? WHERE id=? AND password=?').bind(nextHash,new Date().toISOString(),credential.id,credential.password),
        env.DB.prepare('DELETE FROM session WHERE userId=? AND EXISTS (SELECT 1 FROM account WHERE id=? AND password=?)').bind(account.id,credential.id,nextHash),
        env.DB.prepare("UPDATE folio_tokens SET consumed_at=? WHERE user_id=? AND kind='recovery' AND consumed_at IS NULL AND EXISTS (SELECT 1 FROM account WHERE id=? AND password=?)").bind(Date.now(),account.id,credential.id,nextHash),
      ]);
      if (result[0].meta.changes!==1) throw new HttpError(409,'conflict','The password changed in another session. Log in again before changing it.');
      const response=await login(auth,request,env,account.email,newPassword);
      return json({ok:true},200,response.headers);
    }
    if (route === '/invitations') {
      const {account}=await ownerMember(request,env);
      if (request.method==='GET') {
        const {results}=await env.DB.prepare("SELECT id,email,expires_at AS expiresAt,created_at AS createdAt FROM folio_tokens WHERE kind='invite' AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 100").bind(Date.now()).all();
        return json({invitations:results});
      }
      method(request,'POST');
      const body=await bodyJSON(request),address=email(body.email);
      await rateLimit(env,'invitations',account.id,30,60*60_000);
      if (await env.DB.prepare('SELECT 1 FROM user u JOIN folio_members m ON m.user_id=u.id WHERE u.email=?').bind(address).first()) throw new HttpError(409,'exists','This email already has a Folio account. Manage it under Accounts.');
      return json(await freshCapability(env,'invite',address,null,account.id,3*DAY),201);
    }
    const invitationPath=route.match(/^\/invitations\/([a-zA-Z0-9-]{1,64})$/);
    if (invitationPath) {
      method(request,'DELETE'); await ownerMember(request,env);
      await env.DB.prepare("UPDATE folio_tokens SET consumed_at=? WHERE id=? AND kind='invite'").bind(Date.now(),invitationPath[1]).run();
      return json({ok:true});
    }
    if (route === '/members') {
      method(request,'GET'); await ownerMember(request,env);
      const {results}=await env.DB.prepare('SELECT u.id,u.email,u.name,m.role,m.status,m.created_at AS createdAt FROM folio_members m JOIN user u ON u.id=m.user_id ORDER BY m.created_at LIMIT 1000').all();
      return json({members:results});
    }
    const memberPath=route.match(/^\/members\/([a-zA-Z0-9-]{1,64})(\/recovery)?$/);
    if (memberPath) {
      const {account}=await ownerMember(request,env);
      const target=await env.DB.prepare('SELECT u.id,u.email,m.role,m.status FROM user u JOIN folio_members m ON m.user_id=u.id WHERE u.id=?').bind(memberPath[1]).first();
      if (!target || target.role==='owner') throw new HttpError(403,'member_required','Choose a member account. The owner account cannot be disabled or reset here.');
      if (memberPath[2]) {
        method(request,'POST'); const body=await bodyJSON(request);
        await rateLimit(env,'member-recovery',account.id,5);
        await stepUp(env,account,body.currentPassword);
        if (target.status!=='active') throw new HttpError(400,'disabled','Reactivate this member before creating a recovery link.');
        return json(await freshCapability(env,'recovery',target.email,target.id,account.id,30*60_000),201);
      }
      method(request,'PATCH'); const body=await bodyJSON(request);
      if (!['active','disabled'].includes(body.status)) throw new HttpError(400,'status','Choose active or disabled.');
      const operations=[env.DB.prepare("UPDATE folio_members SET status=? WHERE user_id=? AND role='member'").bind(body.status,target.id)];
      if (body.status==='disabled') {
        operations.push(env.DB.prepare('DELETE FROM session WHERE userId=?').bind(target.id));
        operations.push(env.DB.prepare('UPDATE folio_tokens SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL').bind(Date.now(),target.id));
      }
      await env.DB.batch(operations);
      return json({ok:true});
    }
    if (route === '/owner-recovery') {
      method(request,'POST'); await bodyJSON(request);
      if (!trustedOwner(request,env)) throw new HttpError(403,'owner_required','Open Folio as its configured Site owner to recover the owner account.');
      await rateLimit(env,'owner-recovery',clientIdentity(request),3,60*60_000);
      const owner=await ownerRecord(env);
      if (!owner) throw new HttpError(400,'setup_required','Initialize the owner account first.');
      return json(await freshCapability(env,'recovery',owner.email,owner.id,owner.id,15*60_000),201);
    }
    if (route === '/recovery') {
      method(request,'POST');
      await rateLimit(env,'consume-recovery',clientIdentity(request),10);
      const body=await bodyJSON(request),address=email(body.email),tokenHash=await sha256(capability(body.token)),secret=password(body.newPassword),now=Date.now();
      const valid="SELECT t.user_id FROM folio_tokens t JOIN folio_members m ON m.user_id=t.user_id WHERE t.token_hash=? AND t.kind='recovery' AND t.email=? AND t.consumed_at IS NULL AND t.expires_at>? AND m.status='active'";
      const token=await env.DB.prepare(valid).bind(tokenHash,address,now).first();
      if (!token) throw new HttpError(400,'invalid_token','This recovery link is invalid or has expired.');
      const hashed=await hashPassword(secret);
      const committedAt=Date.now();
      const result=await env.DB.batch([
        env.DB.prepare(`UPDATE account SET password=?,updatedAt=? WHERE providerId='credential' AND userId IN (${valid})`).bind(hashed,new Date(committedAt).toISOString(),tokenHash,address,committedAt),
        env.DB.prepare(`DELETE FROM session WHERE userId IN (${valid})`).bind(tokenHash,address,committedAt),
        env.DB.prepare("UPDATE folio_tokens SET consumed_at=? WHERE token_hash=? AND kind='recovery' AND email=? AND consumed_at IS NULL AND expires_at>?").bind(committedAt,tokenHash,address,committedAt),
      ]);
      if (result[0].meta.changes!==1 || result[2].meta.changes!==1) throw new HttpError(400,'invalid_token','This recovery link is invalid or has expired.');
      return json({ok:true});
    }
    throw new HttpError(404,'not_found','This account action does not exist.');
  } catch (error) { return failure(error); }
}
