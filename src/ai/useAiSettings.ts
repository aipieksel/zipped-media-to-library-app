import {useCallback, useEffect, useRef, useState} from 'react';
import {getPreference, setPreference} from '../db';
import {defaultAiPreferences, normalizeAiPreferences} from './contracts';
import type {AiCompanionStatus, AiConnection, AiPreferences, AiSelection, AiSvgRequest, AiTestResult} from './contracts';
import {getAiStatus, requestAiSvg, testAiConnection} from './client';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'The AI connection could not be used.';

/** App-level connection owner. Opening the app never contacts a local CLI or AI provider. */
export function useAiSettings() {
  const [preferences, setPreferencesState] = useState<AiPreferences>(defaultAiPreferences);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<AiConnection | null>(null);
  const [status, setStatus] = useState<AiCompanionStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [error, setError] = useState('');
  const currentPreferences = useRef(preferences);
  const saveChain = useRef(Promise.resolve());
  const mounted = useRef(true);
  const connectAttempt = useRef<AbortController | null>(null);
  const active = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const start = revision.current;
    void getPreference('ai-settings').then(value => {
      if (!mounted.current || start !== revision.current) return;
      const next = normalizeAiPreferences(value); currentPreferences.current = next; setPreferencesState(next);
    }).catch(() => {if (mounted.current) setError('AI settings could not be loaded from this browser.');}).finally(() => {if (mounted.current) setLoaded(true);});
    return () => {mounted.current = false; connectAttempt.current?.abort(); active.current?.abort();};
  }, []);
  const setPreferences = useCallback(async (patch: Partial<AiPreferences>) => {
    const next = normalizeAiPreferences({...currentPreferences.current, ...patch});
    revision.current++; currentPreferences.current = next; setPreferencesState(next); setTestResult(null);
    const operation = saveChain.current.catch(() => undefined).then(() => setPreference('ai-settings', next));
    saveChain.current = operation;
    try {await operation;} catch {if (mounted.current) setError('AI settings could not be saved. Check browser storage.');}
  }, []);
  const connect = useCallback(async (token: string, port = currentPreferences.current.port) => {
    connectAttempt.current?.abort(); active.current?.abort();
    const controller = new AbortController(); connectAttempt.current = controller;
    setConnecting(true); setError(''); setStatus(null); setConnection(null); setTestResult(null);
    try {
      const next = {port, token: token.trim()};
      const discovered = await getAiStatus(next, controller.signal);
      if (controller.signal.aborted || !mounted.current) return false;
      setConnection(next); setStatus(discovered);
      const provider = discovered.providers.find(item => item.id === currentPreferences.current.provider);
      const model = provider?.models.find(item => item.id === currentPreferences.current.model) ?? provider?.models[0];
      const selectedEffort = currentPreferences.current.reasoning;
      const reasoning = model?.reasoning.some(item => item.id === selectedEffort) ? selectedEffort : model?.defaultReasoning ?? null;
      await setPreferences({port, model: model?.id ?? null, reasoning});
      return true;
    } catch (failure) {if (!controller.signal.aborted && mounted.current) setError(messageOf(failure)); return false;}
    finally {if (connectAttempt.current === controller) {connectAttempt.current = null; if (mounted.current) setConnecting(false);}}
  }, [setPreferences]);
  const disconnect = useCallback(() => {
    connectAttempt.current?.abort(); active.current?.abort();
    connectAttempt.current = null; setConnecting(false); setConnection(null); setStatus(null); setTestResult(null); setError('');
  }, []);
  const provider = status?.providers.find(item => item.id === preferences.provider);
  const model = provider?.models.find(item => item.id === preferences.model);
  const selection: AiSelection | null = provider?.ready && model && preferences.reasoning && model.reasoning.some(item => item.id === preferences.reasoning)
    ? {provider: provider.id, model: model.id, reasoning: preferences.reasoning} : null;
  const generate = useCallback(async (request: AiSvgRequest, signal: AbortSignal) => {
    if (!connection) throw new Error('Open AI settings and connect your local companion first.');
    if (active.current) throw new Error('Another AI request is still running. Wait or cancel it first.');
    const controller = new AbortController(); active.current = controller;
    const abort = () => controller.abort(); signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) controller.abort();
    setActiveRequestId(request.requestId); setError('');
    try {return await requestAiSvg(connection, request, controller.signal);}
    finally {signal.removeEventListener('abort', abort); if (active.current === controller) {active.current = null; if (mounted.current) setActiveRequestId(null);}}
  }, [connection]);
  const test = useCallback(async () => {
    if (!connection || !selection || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setActiveRequestId('connection-test'); setError(''); setTestResult(null);
    try {const result = await testAiConnection(connection, selection, controller.signal); if (!controller.signal.aborted && mounted.current) setTestResult(result);}
    catch (failure) {if (!controller.signal.aborted && mounted.current) setError(messageOf(failure));}
    finally {if (active.current === controller) {active.current = null; if (mounted.current) setActiveRequestId(null);}}
  }, [connection, selection?.provider, selection?.model, selection?.reasoning]);
  return {preferences, loaded, connection, status, provider, model, selection, connecting, activeRequestId, testResult, error, setPreferences, connect, disconnect, generate, test, cancel: () => active.current?.abort()};
}
export type AiSettingsController = ReturnType<typeof useAiSettings>;
