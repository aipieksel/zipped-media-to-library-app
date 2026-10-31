import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { runCliProcess, safeCliEnvironment } from '../vendor/ai-cli-integration/src/node/process';
import { buildStructuredCliSpawnSpec } from '../vendor/ai-cli-integration/src/node/spawn-spec';
import { createCodexEventGuard, parseStructuredOutput, readBoundedAnswer } from '../vendor/ai-cli-integration/src/node/execute';
import { parseCodexModels } from '../vendor/ai-cli-integration/src/catalog';
import { aiSvgRequestSchema, type AiSvgRequest } from '../src/ai/contracts';
import { CodexDriver, parseCodexAuthStatus } from '../companion/codex';
import { fixedCodexOverrides, validateCodexConfiguration } from '../companion/isolation';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUZkAAAAASUVORK5CYII=';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="#123456"/></svg>';
function request(): AiSvgRequest { return aiSvgRequestSchema.parse({requestId: randomUUID(), provider: 'codex', model: 'fixture-model', reasoning: 'high', operation: 'recreate-svg', image: {name: 'shape.webp', mimeType: 'image/png', dataBase64: PNG, width: 1, height: 1}, instructions: 'Keep the shape.'}); }

test('provider credentials are excluded from the child environment; CLI-owned home remains', () => {
  const result = safeCliEnvironment({ PATH: '/usr/bin', HOME: '/home/test', CODEX_HOME: '/home/test/codex', OPENAI_API_KEY: 'secret', XAI_API_KEY: 'secret', AWS_SECRET_ACCESS_KEY: 'secret' });
  assert.deepEqual(result, { PATH: '/usr/bin', HOME: '/home/test', CODEX_HOME: '/home/test/codex' });
  assert.equal(parseCodexAuthStatus({stdout: '', stderr: 'Logged in using ChatGPT'}), 'chatgpt');
  assert.equal(parseCodexAuthStatus({stdout: 'Logged in using an API key', stderr: ''}), 'api-key');
  assert.equal(parseCodexAuthStatus({stdout: 'Not logged in. Use ChatGPT.', stderr: ''}), 'not-signed-in');
  assert.equal(parseCodexAuthStatus({stdout: 'ChatGPT service reachable', stderr: ''}), 'unknown');
});

test('Codex takes actual image paths and stdin; text cannot become CLI arguments', () => {
  const prompt = '--dangerously-bypass-approvals-and-sandbox\n$(not-a-command)';
  const args = buildStructuredCliSpawnSpec({ engine: 'codex', executable: '/usr/bin/codex', model: 'fixture-model', reasoning: 'high', cwd: '/tmp/folio', prompt,
    schema: {}, schemaPath: '/tmp/folio/schema.json', outputPath: '/tmp/folio/answer.json', imagePaths: ['/tmp/folio/source.png'], configOverrides: fixedCodexOverrides('/tmp/folio', ['a.server'], 'folio_test') });
  assert.equal(args.stdin, prompt); assert.equal(args.args.at(-1), '-'); assert.ok(!args.args.includes(prompt));
  assert.ok(args.args.includes('/tmp/folio/source.png')); assert.ok(args.args.includes('--ignore-user-config')); assert.ok(args.args.includes('--strict-config'));
  assert.ok(args.args.includes('forced_login_method="chatgpt"'));
  assert.ok(args.args.includes('features.view_image=false')); assert.ok(!args.args.some((value) => value.startsWith('tools.view_image=')));
  assert.ok(!args.args.includes('--sandbox')); assert.ok(args.args.includes('mcp_servers={"a.server"={enabled=false}}'));
  assert.throws(() => buildStructuredCliSpawnSpec({ ...args, engine: 'grok', model: 'fixture-model', reasoning: 'high', cwd: '/tmp/folio', prompt, schema: {}, schemaPath: '/tmp/folio/s', outputPath: '/tmp/folio/o', configOverrides: [] }), /unavailable/);
});

test('catalog parsing preserves real effort options, input capabilities and visibility', () => {
  const result = parseCodexModels(JSON.stringify({models: [
    {slug: 'a', display_name: 'A', default_reasoning_level: 'minimal', supported_reasoning_levels: [{effort: 'minimal'}, {effort: 'high'}, {effort: 'invented'}], input_modalities: ['text']},
    {slug: 'hidden', visibility: 'hide'}, {slug: 'legacy', default_reasoning_level: 'high'},
  ]}));
  assert.equal(result.length, 2); assert.equal(result[0].supportsImages, false); assert.deepEqual(result[0].reasoning.map((option) => option.id), ['minimal', 'high']);
  assert.equal(result[1].supportsImages, true);
});

test('structured SVG envelopes are supported and incomplete/tool runs fail closed', () => {
  assert.deepEqual(parseStructuredOutput(JSON.stringify({result: JSON.stringify({svg: SVG, summary: 'OK'})})), {svg: SVG, summary: 'OK'});
  const guard = createCodexEventGuard();
  guard.line('{"type":"thread.started"}'); guard.line('{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}');
  assert.throws(guard.assertComplete, /without a completed turn/);
  guard.line('{"type":"turn.completed","usage":{}}'); guard.assertComplete();
  for (const type of ['command_execution', 'mcp_tool_call', 'file_change', 'web_search', 'future_tool']) {
    assert.throws(() => createCodexEventGuard().line(JSON.stringify({type: 'item.started', item: {type}})), /unexpected tool/);
  }
  assert.throws(() => createCodexEventGuard().line('{"type":"turn.failed"}'), /did not complete/);
});

test('bounded answer file rejects oversized data and parses only the allowed bytes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'folio-answer-test-'));
  try {
    const path = join(folder, 'answer.json'); await writeFile(path, '123456');
    await assert.rejects(readBoundedAnswer(path, 5), /size limit/);
    assert.equal(await readBoundedAnswer(path, 6), '123456');
  } finally { await rm(folder, {recursive: true, force: true}); }
});

test('process cancellation hard-kills a child that ignores SIGTERM before settling', {timeout: 5000}, async () => {
  if (process.platform === 'win32') return;
  const controller = new AbortController(); let pid = 0;
  const running = runCliProcess(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});console.log("READY");setInterval(()=>{},1000)'], {
    signal: controller.signal, timeoutMs: 3000, killGraceMs: 30,
    onSpawn: (child) => { pid = child.pid!; child.stdin.end(); },
    onStdoutLine: (line) => { if (line === 'READY') controller.abort(); },
  });
  await assert.rejects(running, (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'cancelled'));
  assert.throws(() => process.kill(pid, 0));
});

test('output overflow terminates a subprocess rather than waiting for timeout', {timeout: 5000}, async () => {
  await assert.rejects(runCliProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(50000));setInterval(()=>{},1000)'], {maxOutputBytes: 128, timeoutMs: 3000, killGraceMs: 20}), /size limit/);
});

function snapshot(cwd = '/tmp/folio', profile = 'folio_test') {
  const settings = {model_provider:'openai', forced_login_method:'chatgpt', approval_policy:'never', web_search:'disabled', project_doc_max_bytes:0, agents:{enabled:false},
    features:{shell_tool:false,shell_snapshot:false,apps:false,plugins:false,remote_plugin:false,hooks:false,browser_use:false,browser_use_external:false,browser_use_full_cdp_access:false,computer_use:false,multi_agent:false,multi_agent_v2:false,multi_agent_v2_dynamic_tools:false,image_generation:false,view_image:false,code_mode_only:false,code_mode_tool_search:false,goals:false,memories:false,skill_mcp_dependency_install:false,skill_search:false,tool_suggest:false,code_mode:{enabled:false},code_mode_host:{enabled:false}},
    mcp_servers:{test:{enabled:false}}, default_permissions:profile,
    permissions:{[profile]:{filesystem:{':minimal':'read',[cwd]:'read'}, network:{enabled:false}}}};
  return {config:{config:{...settings}, layers:[{name:{type:'sessionFlags'},config:settings},{name:{type:'user'},config:{sandbox_mode:'workspace-write'}}]}, requirements:null};
}
test('configuration checks ignore only user layers and reject wider or managed tool access', () => {
  validateCodexConfiguration(snapshot(), '/tmp/folio', 'folio_test');
  const widened = snapshot(); widened.config.layers[0].config.permissions!.folio_test.filesystem[':minimal'] = 'write';
  assert.throws(() => validateCodexConfiguration(widened, '/tmp/folio', 'folio_test'), /filesystem profile/);
  const mcp = snapshot(); mcp.config.layers[0].config.mcp_servers!.test.enabled = true;
  assert.throws(() => validateCodexConfiguration(mcp, '/tmp/folio', 'folio_test'), /MCP server/);
  const system = snapshot(); system.config.layers[1].name.type = 'system';
  assert.throws(() => validateCodexConfiguration(system, '/tmp/folio', 'folio_test'), /conflicts/);
  assert.throws(() => validateCodexConfiguration({...snapshot(), requirements:{featureRequirements:{shell_tool:true}}}, '/tmp/folio', 'folio_test'), /managed Codex policy/);
});

test('C1 builtin browser/computer/agent/image gates cannot be enabled or missing before inference', () => {
  for (const name of ['browser_use','computer_use','multi_agent','image_generation','view_image','code_mode_only']) {
    const enabled = snapshot();
    (enabled.config.layers[0].config.features as Record<string, unknown>)[name] = true;
    assert.throws(() => validateCodexConfiguration(enabled, '/tmp/folio', 'folio_test'), /tool restrictions/);
    const missing = snapshot(); delete (missing.config.layers[0].config.features as Record<string, unknown>)[name];
    assert.throws(() => validateCodexConfiguration(missing, '/tmp/folio', 'folio_test'), /tool restrictions/);
    assert.throws(() => validateCodexConfiguration({...snapshot(),requirements:{featureRequirements:{[name]:true}}}, '/tmp/folio', 'folio_test'), /managed Codex policy/);
  }
});

test('C2 invocation requires ChatGPT-only authentication even after a positive auth-status probe', () => {
  for (const method of ['api', undefined]) {
    const input = snapshot();
    (input.config.layers[0].config as Record<string, unknown>).forced_login_method = method;
    assert.throws(() => validateCodexConfiguration(input, '/tmp/folio', 'folio_test'), /ChatGPT-only authentication/);
  }
});

test('C4 highest-first RPC layers preserve both session overrides and higher managed restrictions', () => {
  const safe = snapshot();
  safe.config.layers.push({name:{type:'system'}, config:{features:{browser_use:true}}} as typeof safe.config.layers[number]);
  validateCodexConfiguration(safe, '/tmp/folio', 'folio_test');
  const unsafe = snapshot();
  unsafe.config.layers.unshift({name:{type:'legacyManagedConfigTomlFromFile'}, config:{features:{browser_use:true}}} as typeof unsafe.config.layers[number]);
  assert.throws(() => validateCodexConfiguration(unsafe, '/tmp/folio', 'folio_test'), /tool restrictions/);
  const contradictory = snapshot();
  contradictory.config.config.features = {...contradictory.config.config.features, browser_use:true};
  assert.throws(() => validateCodexConfiguration(contradictory, '/tmp/folio', 'folio_test'), /reported enabled tools/);
});

async function fixture(mode = 'normal') {
  const folder = await mkdtemp(join(tmpdir(), 'folio-cli-fixture-'));
  const executable = join(folder, 'codex'), log = join(folder, 'calls.jsonl');
  const source = `#!${process.execPath}
const fs=require('node:fs');const readline=require('node:readline');
const args=process.argv.slice(2);const mode=${JSON.stringify(mode)};const log=${JSON.stringify(log)};
const record=(value)=>fs.appendFileSync(log,JSON.stringify(value)+'\\n');
if(args.includes('--version')){console.log('codex-cli 0.163.0');process.exit(0)}
if(args.includes('--help')){console.log('--ignore-user-config --strict-config --ephemeral --image --output-schema --output-last-message --json --listen');process.exit(0)}
if(args.includes('login')){console.error(mode==='api'?'Logged in using an API key':'Logged in using ChatGPT');process.exit(0)}
if(args.includes('mcp')){console.log(JSON.stringify([{name:'test.mcp',enabled:true}]));process.exit(0)}
if(args.includes('debug')){console.log(JSON.stringify({models:[{slug:'fixture-model',display_name:'Fixture',default_reasoning_level:'high',supported_reasoning_levels:[{effort:'high',description:'Fixture'}],input_modalities:['text','image']}]}));process.exit(0)}
if(args.includes('app-server')){
 const profile=JSON.parse(args.find(v=>v.startsWith('default_permissions=')).slice('default_permissions='.length));const cwd=process.cwd();
 const settings={model_provider:'openai',forced_login_method:mode==='api-fallback'?'api':'chatgpt',approval_policy:'never',web_search:'disabled',project_doc_max_bytes:0,agents:{enabled:false},features:{shell_tool:mode==='unsafe',shell_snapshot:false,apps:false,plugins:false,remote_plugin:false,hooks:false,browser_use:mode==='browser',browser_use_external:false,browser_use_full_cdp_access:false,computer_use:false,multi_agent:false,multi_agent_v2:false,multi_agent_v2_dynamic_tools:false,image_generation:false,view_image:false,code_mode_only:false,code_mode_tool_search:false,goals:false,memories:false,skill_mcp_dependency_install:false,skill_search:false,tool_suggest:false,code_mode:{enabled:false},code_mode_host:{enabled:false}},mcp_servers:{'test.mcp':{enabled:false}},default_permissions:profile,permissions:{[profile]:{filesystem:{':minimal':'read',[cwd]:'read'},network:{enabled:false}}}};
 const rl=readline.createInterface({input:process.stdin});rl.on('line',line=>{const msg=JSON.parse(line);if(msg.id===1)console.log(JSON.stringify({id:1,result:{}}));if(msg.id===2)console.log(JSON.stringify({id:2,result:{config:{...settings,tools:{}},layers:[{name:{type:'sessionFlags'},config:settings},{name:{type:'user'},config:{sandbox_mode:'workspace-write'}}]}}));if(msg.id===3)console.log(JSON.stringify({id:3,result:{requirements:null}}));});rl.on('close',()=>process.exit(0));
}else if(args.includes('exec')){
 let prompt='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>prompt+=d);process.stdin.on('end',()=>{
 const at=args.indexOf('--image');const image=at<0?null:fs.readFileSync(args[at+1]);record({exec:true,hasPng:!!image&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),promptHasDirections:prompt.includes('Keep the shape.'),hasStdin:args.at(-1)==='-',hasMcpDisable:args.some(v=>v==='mcp_servers={"test.mcp"={enabled=false}}'),cwd:process.cwd()});
 console.log(JSON.stringify({type:'thread.started'}));
 if(mode==='tool'){console.log(JSON.stringify({type:'item.started',item:{type:'command_execution'}}));setInterval(()=>{},1000);return;}
 const svg=mode==='unsafe-svg'?'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><script>alert(1)</script></svg>':${JSON.stringify(SVG)};
 const answer=at<0?{ok:true}:{svg,summary:'Fixture result'};
 fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify(answer));
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'done'}}));
 if(mode!=='incomplete')console.log(JSON.stringify({type:'turn.completed',usage:{}}));
 });
}else process.exit(2);
`;
  await writeFile(executable, source); await chmod(executable, 0o700);
  return {folder,log,driver:new CodexDriver({executables:{codex:executable,grok:join(folder,'missing')},env:{...safeCliEnvironment(),PATH:process.env.PATH}})};
}

test('full companion driver uses a PNG attachment, real stdin/schema and validates SVG before returning', {timeout: 15000}, async () => {
  const item = await fixture();
  try {
    const status = await item.driver.status(); assert.equal(status.providers[0].ready, true); assert.equal(status.providers[1].ready, false);
    const input = request(); const result = await item.driver.generate(input, new AbortController().signal);
    assert.equal(result.requestId,input.requestId); assert.match(result.svg, /#123456/);
    const calls = (await readFile(item.log,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(calls.length,1); assert.equal(calls[0].hasPng,true); assert.equal(calls[0].promptHasDirections,true); assert.equal(calls[0].hasStdin,true); assert.equal(calls[0].hasMcpDisable,true);
    await assert.rejects(readFile(join(calls[0].cwd,'source.png')));
    const tested = await item.driver.test({...input,requestId:randomUUID()},new AbortController().signal); assert.equal(tested.ok,true); assert.match(tested.message,/text connection/);
  } finally {await rm(item.folder,{recursive:true,force:true});}
});

test('unsafe config and API-key auth are rejected before any fixture inference', {timeout:15000}, async () => {
  for (const mode of ['unsafe','api','browser','api-fallback']) {
    const item=await fixture(mode);
    try {
      await assert.rejects(item.driver.generate(request(),new AbortController().signal), /tool restrictions|API key|ChatGPT-only authentication/);
      await assert.rejects(readFile(item.log));
    } finally {await rm(item.folder,{recursive:true,force:true});}
  }
});

test('unsafe SVG, tool calls and incomplete runs cannot become successful candidates', {timeout:20000}, async () => {
  for (const mode of ['unsafe-svg','tool','incomplete']) {
    const item=await fixture(mode);
    try {await assert.rejects(item.driver.generate(request(),new AbortController().signal), /validated safely|unexpected tool|without a completed turn/);}
    finally {await rm(item.folder,{recursive:true,force:true});}
  }
});
