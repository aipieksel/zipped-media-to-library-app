import {useCallback, useEffect, useRef, useState} from 'react';
import {uniqueId} from './identity';
import {convertRaster} from './png-svg-browser';
import type {ConversionMode} from './png-svg';
import type {PngSvgFidelity} from './png-svg-browser';
import {emptyIconSnapshot, ICON_DB_NAME, ICON_HEARTBEAT_MS, isCurrentIconClaim, openIconCollection} from './icon-collection';
import type {IconCollectionStore} from './icon-collection';
import {captureIconDrop, iconEntriesFromFiles, readIconDrop} from './icon-drop';
import type {CapturedIconDrop} from './icon-drop';
import type {IconCollectionSnapshot, IconFolder, IconImportBatch, IconImportReport, IconJob, IconJobProgress, IconPreferences, SaveArtworkInput, SavedIconVerification} from './icon-types';

interface ActiveJob {
  claim: IconJob;
  controller: AbortController;
  store: IconCollectionStore;
}

const messageOf = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

/** Shared collection lifecycle; App supplies the existing tree and canvas presentation. */
export function useIconCollection(databaseName = ICON_DB_NAME) {
  const [snapshot, setSnapshot] = useState<IconCollectionSnapshot>(emptyIconSnapshot);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [preferencesError, setPreferencesError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Map<string, IconJobProgress>>(new Map());
  const storeRef = useRef<IconCollectionStore | null>(null);
  const snapshotRef = useRef(snapshot);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const refreshSequence = useRef(0);
  const owner = useRef(`icon-tab-${uniqueId()}`);
  const pumping = useRef(false);
  const activeJob = useRef<ActiveJob | null>(null);
  const importingRef = useRef(false);
  const dropAbort = useRef<AbortController | null>(null);
  const pumpRef = useRef<() => Promise<void>>(async () => undefined);

  const refresh = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const sequence = ++refreshSequence.current;
    try {
      const next = await store.snapshot();
      if (!mounted.current || storeRef.current !== store || sequence !== refreshSequence.current) return;
      snapshotRef.current = next; setSnapshot(next);
      const job = activeJob.current;
      if (job?.store === store && !isCurrentIconClaim(next.items.find(item => item.id === job.claim.id), job.claim, Date.now())) job.controller.abort();
      if (next.items.some(item => item.status === 'queued' || item.status === 'processing' && (!item.claim || item.claim.expiresAt <= Date.now()))) void pumpRef.current();
    } catch (failure) {
      if (mounted.current && storeRef.current === store) setError(messageOf(failure, 'The local Icons collection could not be read. Reload to retry.'));
    }
  }, []);

  const processQueue = useCallback(async () => {
    const store = storeRef.current;
    if (!store || pumping.current || !mounted.current) return;
    pumping.current = true;
    try {
      while (mounted.current && storeRef.current === store) {
        const claim = await store.claimNext(owner.current);
        if (!claim) break;
        if (!mounted.current || storeRef.current !== store) {await store.release(claim); break;}
        const job: ActiveJob = {claim, controller: new AbortController(), store};
        activeJob.current = job;
        setProgress(current => new Map(current).set(claim.id, {revision: claim.revision, stage: 'decoding', message: 'Reading saved image…', sourceValidated: false}));
        let renewing = false;
        const timer = setInterval(() => {
          if (renewing || job.controller.signal.aborted) return;
          renewing = true;
          void store.heartbeat(claim).then(held => {if (!held) job.controller.abort();}).catch(failure => {
            job.controller.abort();
            if (mounted.current && storeRef.current === store) setError(messageOf(failure, 'The local conversion lease could not be renewed.'));
          }).finally(() => {renewing = false;});
        }, ICON_HEARTBEAT_MS);
        try {
          const source = await store.getSource(claim.id);
          if (!source) throw new Error('The saved original image is unavailable. Remove this entry and import the original again.');
          if (job.controller.signal.aborted) {await store.release(claim); continue;}
          const file = new File([source], claim.item.sourceName, {type: source.type || claim.item.sourceMime || 'image/png', lastModified: claim.item.lastModified});
          const result = await convertRaster(file, {
            mode: claim.item.mode,
            signal: job.controller.signal,
            onProgress(update) {
              if (!mounted.current || activeJob.current !== job || job.controller.signal.aborted) return;
              setProgress(current => {
                const previous = current.get(claim.id);
                return new Map(current).set(claim.id, {...update, revision: claim.revision, sourceValidated: !!previous?.sourceValidated || update.stage === 'converting' || update.stage === 'verifying'});
              });
            },
          });
          if (!mounted.current || activeJob.current !== job || job.controller.signal.aborted) {await store.release(claim); continue;}
          await store.complete(claim, result);
        } catch (failure) {
          if (job.controller.signal.aborted || !mounted.current) await store.release(claim).catch(() => undefined);
          else {
            const message = messageOf(failure, 'This image could not be converted.');
            try {await store.fail(claim, message);} catch (saveFailure) {
              if (mounted.current && storeRef.current === store) setError(`The conversion result could not be saved: ${messageOf(saveFailure, message)}. The original remains in local storage.`);
              break;
            }
          }
        } finally {
          clearInterval(timer);
          if (activeJob.current === job) activeJob.current = null;
          if (mounted.current && storeRef.current === store) {
            setProgress(current => {const next = new Map(current); next.delete(claim.id); return next;});
            await refresh();
          }
        }
      }
    } catch (failure) {
      if (mounted.current && storeRef.current === store) setError(messageOf(failure, 'The local conversion queue could not be opened. Reload to retry.'));
    } finally {pumping.current = false;}
  }, [refresh]);
  pumpRef.current = processQueue;

  useEffect(() => {
    const generation = ++lifecycle.current;
    mounted.current = true;
    let store: IconCollectionStore | undefined;
    let unsubscribe: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const onFocus = () => {void refresh();};
    const onVisibility = () => {if (document.visibilityState === 'visible') void refresh();};
    setLoaded(false); setError(''); setPreferencesError('');
    void openIconCollection(databaseName).then(async opened => {
      if (!mounted.current || generation !== lifecycle.current) {opened.close(); return;}
      store = opened; storeRef.current = opened;
      unsubscribe = opened.subscribe(() => {void refresh();});
      await refresh();
      if (!mounted.current || generation !== lifecycle.current) return;
      setLoaded(true);
      // Poll metadata only while work exists, so an expired foreign lease can resume.
      poll = setInterval(() => {
        if (snapshotRef.current.items.some(item => item.status === 'queued' || item.status === 'processing')) void refresh();
      }, 4_000);
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
      void processQueue();
    }).catch(failure => {
      if (mounted.current && generation === lifecycle.current) {setError(messageOf(failure, 'Browser storage is unavailable for Icons. Enable it and reload.')); setLoaded(true);}
    });
    return () => {
      if (generation === lifecycle.current) {mounted.current = false; lifecycle.current++;}
      unsubscribe?.(); clearInterval(poll);
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility);
      dropAbort.current?.abort();
      const job = activeJob.current;
      if (storeRef.current === store) storeRef.current = null;
      if (store && job?.store === store) {
        job.controller.abort();
        void store.release(job.claim).catch(() => undefined).finally(() => store?.close());
      } else store?.close();
    };
  }, [databaseName, processQueue, refresh]);

  const requireStore = useCallback(() => {
    const store = storeRef.current;
    if (!store) throw new Error('The local Icons collection is not open. Enable browser storage and reload.');
    return store;
  }, []);

  const finishImport = useCallback(async (batch: IconImportBatch): Promise<IconImportReport | undefined> => {
    const store = requireStore();
    const report = await store.importEntries(batch, snapshotRef.current.preferences.defaultMode);
    if (!mounted.current || storeRef.current !== store) return report;
    setError(''); setPreferencesError('');
    const summary = `${report.added.length} icon${report.added.length === 1 ? '' : 's'} saved locally${report.folders.length ? ` · ${report.folders.length} folder${report.folders.length === 1 ? '' : 's'} added` : ''}${report.skipped ? ` · ${report.skipped} skipped` : ''}.`;
    setNotice([summary, ...report.notices.slice(0, 3)].join(' '));
    await refresh(); void processQueue();
    return report;
  }, [processQueue, refresh, requireStore]);

  const importEntries = useCallback(async (batch: IconImportBatch): Promise<IconImportReport | undefined> => {
    if (importingRef.current) {setNotice('An icon import is already running. Drop the next batch when it finishes.'); return;}
    importingRef.current = true; setImporting(true);
    try {return await finishImport(batch);} catch (failure) {
      if (mounted.current) setError(`Nothing from this import was saved. ${messageOf(failure, 'The local import failed.')}`);
      return undefined;
    } finally {importingRef.current = false; if (mounted.current) setImporting(false);}
  }, [finishImport]);

  const importFiles = useCallback(async (files: readonly File[]): Promise<IconImportReport | undefined> => {
    try {return await importEntries(iconEntriesFromFiles(files));} catch (failure) {
      if (mounted.current) setError(messageOf(failure, 'The selected files could not be read.'));
      return undefined;
    }
  }, [importEntries]);

  const importCapturedDrop = useCallback(async (captured: CapturedIconDrop): Promise<IconImportReport | undefined> => {
    if (importingRef.current) {setNotice('An icon import is already running. Drop the next batch when it finishes.'); return;}
    importingRef.current = true; setImporting(true);
    const controller = new AbortController(); dropAbort.current = controller;
    try {
      const batch = await readIconDrop(captured, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      return await finishImport(batch);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(`Nothing from this drop was saved. ${messageOf(failure, 'The folder could not be read.')}`);
      return undefined;
    } finally {
      if (dropAbort.current === controller) dropAbort.current = null;
      importingRef.current = false; if (mounted.current) setImporting(false);
    }
  }, [finishImport]);

  // Keep synchronous capture outside any await or promise callback.
  const importDrop = useCallback((dataTransfer: DataTransfer): Promise<IconImportReport | undefined> => importCapturedDrop(captureIconDrop(dataTransfer)), [importCapturedDrop]);

  const mutate = useCallback(async (action: (store: IconCollectionStore) => Promise<unknown>) => {
    try {await action(requireStore()); if (mounted.current) setError(''); await refresh();}
    catch (failure) {if (mounted.current) setError(messageOf(failure, 'The local Icons change could not be saved.'));}
  }, [refresh, requireStore]);

  const setPreferences = useCallback(async (patch: Partial<IconPreferences> & {mode?: ConversionMode}) => {
    // Selection/expansion saves also run automatically. Their success cannot
    // dismiss an unrelated failed import; their failure must not replace it.
    try {
      await requireStore().setPreferences(patch);
      if (mounted.current) setPreferencesError('');
      await refresh();
    } catch (failure) {
      if (mounted.current) setPreferencesError(messageOf(failure, 'The Icons view settings could not be saved.'));
    }
  }, [refresh, requireStore]);
  const abortItem = useCallback((id: string) => {if (activeJob.current?.claim.id === id) activeJob.current.controller.abort();}, []);
  const retry = useCallback((id: string, mode?: ConversionMode) => {abortItem(id); return mutate(store => store.retry(id, mode));}, [abortItem, mutate]);
  const cancel = useCallback((id: string) => {abortItem(id); return mutate(store => store.cancel(id));}, [abortItem, mutate]);
  const cancelAll = useCallback(() => {activeJob.current?.controller.abort(); return mutate(store => store.cancelAll());}, [mutate]);
  const removeItem = useCallback((id: string) => {abortItem(id); return mutate(store => store.remove(id));}, [abortItem, mutate]);
  const removeFolder = useCallback((id: string) => mutate(store => store.removeFolder(id)), [mutate]);
  const moveItem = useCallback((id: string, folderId: string) => mutate(store => store.move(id, folderId)), [mutate]);
  const toggleFavorite = useCallback((id: string) => mutate(store => store.setFavorite(id, !snapshotRef.current.items.find(item => item.id === id)?.favorite)), [mutate]);
  const toggleFolderFavorite = useCallback((id: string) => mutate(store => store.setFolderFavorite(id, !snapshotRef.current.folders.find(folder => folder.id === id)?.favorite)), [mutate]);

  const createFolder = useCallback(async (name: string, parentId: string | null = null): Promise<IconFolder> => {
    try {const folder = await requireStore().createFolder(name, parentId); if (mounted.current) setError(''); await refresh(); return folder;}
    catch (failure) {if (mounted.current) setError(messageOf(failure, 'The icon folder could not be saved.')); throw failure;}
  }, [refresh, requireStore]);

  const getSource = useCallback((id: string) => requireStore().getSource(id), [requireStore]);
  const getOutput = useCallback((id: string, revision?: number) => requireStore().getOutput(id, revision), [requireStore]);
  // Saving is an explicit user action: propagate failed commits so the UI cannot report false success.
  const changeSaved = useCallback(async <T,>(action: (store: IconCollectionStore) => Promise<T>): Promise<T> => {
    try {const value = await action(requireStore()); if (mounted.current) setError(''); await refresh(); return value;}
    catch (failure) {if (mounted.current) setError(messageOf(failure, 'The saved artwork change could not be committed.')); throw failure;}
  }, [refresh, requireStore]);
  const saveConverted = useCallback((id: string, expectedRevision: number) => changeSaved(store => store.saveConverted(id, expectedRevision)), [changeSaved]);
  const saveArtwork = useCallback((input: SaveArtworkInput) => changeSaved(store => store.saveArtwork(input)), [changeSaved]);
  const recolorSaved = useCallback((id: string, color: string | null, expectedRevision: number) => changeSaved(store => store.recolorSaved(id, color, expectedRevision)), [changeSaved]);
  const recordSavedVerification = useCallback((id: string, expectedRevision: number, fidelity: PngSvgFidelity, verification: SavedIconVerification) => changeSaved(store => store.recordSavedVerification(id, expectedRevision, fidelity, verification)), [changeSaved]);
  const removeSaved = useCallback((id: string) => changeSaved(store => store.removeSaved(id)), [changeSaved]);
  const moveSaved = useCallback((id: string, folderId: string) => changeSaved(store => store.moveSaved(id, folderId)), [changeSaved]);
  const setSavedFavorite = useCallback((id: string, favorite: boolean) => changeSaved(store => store.setSavedFavorite(id, favorite)), [changeSaved]);
  const getSavedOutput = useCallback((id: string, revision?: number) => requireStore().getSavedOutput(id, revision), [requireStore]);
  const getSavedSource = useCallback((id: string) => requireStore().getSavedSource(id), [requireStore]);
  const dismissNotice = useCallback(() => setNotice(''), []);

  return {
    snapshot, items: snapshot.items, saved: snapshot.saved, folders: snapshot.folders, preferences: snapshot.preferences,
    loaded, error: error || preferencesError, storageError: error || preferencesError, importing, busy: importing || snapshot.items.some(item => item.status === 'processing'), notice, progress,
    refresh, importEntries, importFiles, importDrop, importCapturedDrop, setPreferences,
    createFolder, moveItem, toggleFavorite, toggleFolderFavorite, retry, cancel, cancelAll, removeItem, removeFolder,
    getSource, getOutput, dismissNotice,
    saveConverted, saveArtwork, recolorSaved, recordSavedVerification, removeSaved, moveSaved, setSavedFavorite, getSavedOutput, getSavedSource,
  };
}

export type IconCollectionController = ReturnType<typeof useIconCollection>;
