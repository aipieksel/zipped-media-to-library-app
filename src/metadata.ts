import type {ArchiveMeta, FileDateInfo, HtmlPage, TreeNode, WorkspaceFolder} from './types';

export function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && Number.isFinite(new Date(value).getTime());
}

/** A fallback keeps its provenance: an import date is never presented as file creation. */
export function itemDateInfo(item: HtmlPage, archives?: ReadonlyMap<string, ArchiveMeta>): FileDateInfo | undefined {
  const sourceFallback = item.dateSource === 'library' || item.dateSource === 'imported';
  if (validTimestamp(item.modifiedAt) && !sourceFallback) return {timestamp:item.modifiedAt,kind:'modified',label:'Modified'};
  if (validTimestamp(item.createdAt)) return {timestamp:item.createdAt,kind:'created',label:'Created'};
  if (validTimestamp(item.modifiedAt)) return {timestamp:item.modifiedAt,kind:'source',label:item.dateSource === 'library' ? 'Source updated' : 'Source file updated'};
  const archive = archives?.get(item.archiveId);
  if (validTimestamp(archive?.modifiedAt)) return {timestamp:archive.modifiedAt, kind:'source', label:'Archive updated'};
  const added = validTimestamp(item.addedAt) ? item.addedAt : archive?.createdAt;
  if (validTimestamp(added)) return {timestamp:added, kind:'added', label:'Added'};
  return undefined;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export function dateDescription(info: FileDateInfo | undefined): string {
  return info ? `${info.label}: ${dateFormat.format(info.timestamp)} (UTC)` : 'Date unavailable';
}

/** One postorder pass supplies aggregate dates for folder sorting and visible metadata. */
export function treeDateMetadata(nodes: readonly TreeNode[], items: ReadonlyMap<string, HtmlPage>, archives?: ReadonlyMap<string, ArchiveMeta>, folders?: ReadonlyMap<string, WorkspaceFolder>): Map<string, FileDateInfo> {
  const dates = new Map<string, FileDateInfo>();
  const visit = (node: TreeNode): FileDateInfo | undefined => {
    if (node.kind === 'page') {
      const item = node.pageId ? items.get(node.pageId) : undefined;
      const info = item ? itemDateInfo(item, archives) : undefined;
      if (info) dates.set(node.id, info);
      return info;
    }
    let latest: FileDateInfo | undefined;
    for (const child of node.children) {
      const info = visit(child);
      if (info && (!latest || info.timestamp > latest.timestamp)) latest = info;
    }
    if (latest) latest = {...latest, label:latest.label.startsWith('Latest file · ') ? latest.label : `Latest file · ${latest.label}`};
    else {
      const archive = node.kind === 'archive' ? archives?.get(node.archiveId) : undefined;
      const folder = node.folderId ? folders?.get(node.folderId) : undefined;
      if (validTimestamp(archive?.modifiedAt)) latest = {timestamp:archive.modifiedAt,kind:'source',label:'Archive updated'};
      else if (validTimestamp(folder?.createdAt ?? archive?.createdAt)) latest = {timestamp:(folder?.createdAt ?? archive!.createdAt)!,kind:'added',label:'Added'};
    }
    if (latest) dates.set(node.id, latest);
    return latest;
  };
  for (const node of nodes) visit(node);
  return dates;
}
