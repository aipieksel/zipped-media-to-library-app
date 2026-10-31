import {useRef, useState} from 'react';
import {CheckCircle2, ExternalLink, LoaderCircle, Plug, ShieldCheck, Unplug} from 'lucide-react';
import type {AiPreferences} from '../ai/contracts';
import type {AiSettingsController} from '../ai/useAiSettings';
import {PopoverSelect} from './PopoverSelect';

export function AiSettings({ai}: {ai: AiSettingsController}) {
  const [token, setToken] = useState('');
  const [port, setPort] = useState(String(ai.preferences.port));
  const modelSelect = useRef<HTMLButtonElement>(null);
  const busy = ai.connecting || !!ai.activeRequestId;
  return <div className="modal-body ai-settings-panel">
    <section className="settings-section">
      <h3>AI connection</h3>
      <p className="form-note">Use your ChatGPT account through Codex on this computer. Connect the Folio companion once per session.</p>
      <div className="ai-connection-status" role="status"><span className={`connection-dot ${ai.connection ? 'connected' : ''}`}/>{ai.connecting ? 'Connecting to this computer…' : ai.connection ? 'Local companion connected' : 'Not connected'}{ai.provider?.auth === 'chatgpt' && <span className="settings-badge">ChatGPT sign-in confirmed</span>}</div>
      {!ai.connection ? <form className="ai-pair-form" onSubmit={event => {event.preventDefault(); void ai.connect(token, Number(port)).then(connected => {if (connected) {setToken(''); requestAnimationFrame(() => modelSelect.current?.focus());}});}}>
        <label className="form-field"><span>Pairing code</span><input type="password" aria-label="Companion pairing code" value={token} onChange={event => setToken(event.target.value)} placeholder="Paste the code from your companion" autoComplete="off" spellCheck={false} maxLength={256}/></label>
        <div className="ai-pair-actions"><label className="form-field port-field"><span>Port</span><input aria-label="Companion port" type="number" min={1024} max={65535} value={port} onChange={event => setPort(event.target.value)}/></label><button className="button primary" type="submit" disabled={busy || !token.trim()}>{ai.connecting ? <LoaderCircle size={14} className="spin"/> : <Plug size={14}/>}Connect</button>{ai.connecting && <button className="text-button" type="button" onClick={ai.disconnect}>Cancel</button>}</div>
      </form> : <div className="ai-connection-actions"><span className="form-note">Pairing stays in this tab. Your OpenAI credentials stay with Codex.</span><button className="button" onClick={ai.disconnect}><Unplug size={13}/>Disconnect</button></div>}
      {ai.error && <p className="inline-error" role="alert">{ai.error}</p>}
    </section>
    <section className="settings-section">
      <h3>Provider & model</h3>
      <label className="setting-row"><span>Provider</span><PopoverSelect aria-label="AI provider" value={ai.preferences.provider} disabled={busy || !ai.loaded} onValueChange={value => {
        const provider = ai.status?.providers.find(item => item.id === value); const model = provider?.models[0];
        void ai.setPreferences({provider: value as AiPreferences['provider'], model: model?.id ?? null, reasoning: model?.defaultReasoning ?? null});
      }} options={[{value:'codex',label:'OpenAI · ChatGPT / Codex'},{value:'grok',label:'Grok · capability check pending'},{value:'deepseek',label:'DeepSeek · not in this package',disabled:true}]}/></label>
      <label className="setting-row"><span>Model</span><PopoverSelect ref={modelSelect} aria-label="AI model" value={ai.model?.id ?? ''} disabled={busy || !ai.provider?.models.length} onValueChange={value => {const model = ai.provider?.models.find(item => item.id === value); void ai.setPreferences({model: model?.id ?? null, reasoning: model?.defaultReasoning ?? null});}} options={[{value:'',label:ai.connection ? 'No model available' : 'Connect to load models',disabled:true},...(ai.provider?.models.map(item=>({value:item.id,label:item.name}))??[])]}/></label>
      <label className="setting-row"><span>Reasoning</span><PopoverSelect aria-label="AI reasoning effort" value={ai.model ? ai.preferences.reasoning ?? '' : ''} disabled={busy || !ai.model} onValueChange={value => void ai.setPreferences({reasoning: value as AiPreferences['reasoning']})} options={[{value:'',label:'Choose a model',disabled:true},...(ai.model?.reasoning.map(item=>({value:item.id,label:item.id}))??[])]}/></label>
      {ai.provider?.reason && <p className="form-note ai-capability-note" role="status">{ai.provider.reason}</p>}
      {ai.preferences.provider === 'grok' && <p className="form-note">The supplied adapter includes Grok discovery. SVG generation is unavailable until its image input and execution restrictions are verified.</p>}
      {ai.model?.description && <p className="form-note">{ai.model.description}</p>}
      <div className="ai-test-row"><button className="button" disabled={!ai.selection || busy} onClick={() => void ai.test()}>{ai.activeRequestId === 'connection-test' ? <LoaderCircle size={13} className="spin"/> : <CheckCircle2 size={13}/>}Test AI connection</button>{ai.activeRequestId === 'connection-test' && <button className="text-button" onClick={ai.cancel}>Cancel</button>}</div>
      <p className="form-note">Runs a small text request using your selected account and model. Image-to-SVG is tested when you generate an icon.</p>
      {ai.testResult && <p className="ai-test-success" role="status"><CheckCircle2 size={14}/>Text request succeeded · {ai.testResult.model}</p>}
    </section>
    <details className="ai-setup" open={!ai.connection}><summary>Set up the local companion</summary><div>
      <p>Install Node.js 22 or newer and the official Codex CLI, then sign in using your ChatGPT account:</p>
      <pre><code>npm install -g @openai/codex@0.166.0{'\n'}codex login</code></pre>
      <p>From your Folio repository checkout, start the companion:</p>
      <pre><code>npm ci{'\n'}npm run companion:build{'\n'}npm run companion</code></pre>
      <p>Keep its terminal open. Paste its pairing code above, then allow this Site to connect to your local computer if your browser asks. Restarting the companion changes the code.</p>
      <a href="https://github.com/aipieksel/zipped-media-to-library-app/blob/main/companion/README.md" target="_blank" rel="noreferrer">Setup and troubleshooting <ExternalLink size={11}/></a>
    </div></details>
    <p className="ai-privacy-note"><ShieldCheck size={13}/>Ordinary conversion stays local. An AI action sends only the selected image, SVG and instructions through the CLI to your chosen provider. AI reconstruction needs your review.</p>
  </div>;
}
