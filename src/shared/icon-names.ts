import {allocateSvgFilename} from '../png-svg';
import type {DataRecord, DatasetData} from './codec';

const nameKey = (name: string) => name.normalize('NFC').toLowerCase();

/** The same sibling allocator is used by local operations and explicit shared recovery. */
export function allocateIconName(source: string, used: Set<string>, file = false): string {
  let clean = source.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, '_').trim().replace(/[. ]+$/g, '');
  if (!clean || /^\.+$/.test(clean)) clean = file ? 'icon.png' : 'Folder';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)) clean = '_' + clean;
  clean = Array.from(clean).slice(0, 150).join('');
  const extension = file ? /\.[^.]+$/.exec(clean)?.[0] ?? '' : '';
  const stem = extension ? clean.slice(0, -extension.length) : clean;
  const keys = new Set([...used].map(nameKey));
  let name = clean, suffix = 2;
  while (keys.has(nameKey(name))) name = `${stem} (${suffix++})${extension}`;
  used.add(nameKey(name)); return name;
}

export function withoutManagedIconNames(row: DataRecord): DataRecord {const value = {...row}; delete value.name; delete value.filename; return value;}

/** Preserve current published names; safely allocate names only for changed or incoming entries. */
export function resolveIconNameCollisions(input: DatasetData, latest: DatasetData): DatasetData {
  if (input.kind !== 'icons') return input;
  const stores = {...input.stores};
  for (const name of ['folders', 'icons', 'savedIcons']) stores[name] = input.stores[name].map(row => ({...row}));
  const previous = Object.fromEntries(['folders', 'icons', 'savedIcons'].map(name => [name, new Map(latest.stores[name].map(row => [String(row.id), row]))]));
  const parent = (store: string, row: DataRecord) => String(store === 'folders' ? row.parentId ?? '' : row.folderId);
  const unchanged = (store: string, row: DataRecord) => {const old = previous[store].get(String(row.id)); return !!old && old.name === row.name && parent(store, old) === parent(store, row);};
  const folders = new Map<string, Set<string>>(), knownFiles = new Map<string, Set<string>>();
  const namesAt = (map: Map<string, Set<string>>, key: string) => {let names = map.get(key); if (!names) {names = new Set(); map.set(key, names);} return names;};
  for (const row of stores.folders) if (unchanged('folders', row)) namesAt(folders, parent('folders', row)).add(String(row.name));
  for (const store of ['icons', 'savedIcons']) for (const row of stores[store]) if (unchanged(store, row)) namesAt(knownFiles, parent(store, row)).add(String(row.name));
  for (const row of stores.folders) if (!unchanged('folders', row)) {
    const key = parent('folders', row), names = new Set([...namesAt(folders, key), ...namesAt(knownFiles, key)]);
    row.name = allocateIconName(String(row.name), names); namesAt(folders, key).add(String(row.name));
  }
  for (const store of ['icons', 'savedIcons']) {
    const siblings = new Map([...folders].map(([key, names]) => [key, new Set(names)]));
    for (const row of stores[store]) if (unchanged(store, row)) namesAt(siblings, parent(store, row)).add(String(row.name));
    for (const row of stores[store]) if (!unchanged(store, row)) row.name = allocateIconName(String(row.name), namesAt(siblings, parent(store, row)), true);
    const filenames = new Set<string>();
    for (const row of stores[store]) if (previous[store].get(String(row.id))?.filename === row.filename) filenames.add(String(row.filename));
    for (const row of stores[store]) if (previous[store].get(String(row.id))?.filename !== row.filename) row.filename = allocateSvgFilename(String(row.filename).replace(/\.svg$/i, ''), filenames);
  }
  return {...input, stores};
}
