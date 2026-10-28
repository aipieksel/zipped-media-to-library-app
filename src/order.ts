import type {ArchiveMeta, HtmlPage, TreeNode, WorkspaceFolder} from './types';
import {itemDateInfo,treeDateMetadata} from './metadata';
import {imageDimensions} from './image-dimensions';

export type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'largest' | 'smallest';
export type GroupMode = 'folders' | 'month' | 'all';
export interface ViewOrder {sort: SortOrder; group: GroupMode}
export const DEFAULT_ORDER: ViewOrder = {sort: 'name-asc', group: 'folders'};
const natural = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});
const exact = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const textOrder = (a: string, b: string) => natural.compare(a, b) || exact(a, b);
export function normalizeOrder(value?: Partial<ViewOrder>): ViewOrder {
  return {sort: ['name-asc','name-desc','newest','oldest','largest','smallest'].includes(value?.sort ?? '') ? value!.sort! : DEFAULT_ORDER.sort,
    group: ['folders','month','all'].includes(value?.group ?? '') ? value!.group! : DEFAULT_ORDER.group};
}
export function itemDate(item: HtmlPage, archives?: ReadonlyMap<string, ArchiveMeta>): number | undefined {
  return itemDateInfo(item, archives)?.timestamp;
}
export function compareItems(a: HtmlPage, b: HtmlPage, sort: SortOrder, archives?: ReadonlyMap<string, ArchiveMeta>): number {
  const tie = () => textOrder(a.label,b.label) || textOrder(a.path,b.path) || exact(a.id,b.id);
  if (sort === 'name-asc' || sort === 'name-desc') return (sort === 'name-desc' ? -1 : 1) * textOrder(a.label,b.label) || textOrder(a.path,b.path) || exact(a.id,b.id);
  const area=(item:HtmlPage)=>{const dimensions=imageDimensions(item);return dimensions?dimensions.width*dimensions.height:undefined;};
  const bySize=sort==='largest'||sort==='smallest';
  const ad = bySize?area(a):itemDate(a, archives), bd = bySize?area(b):itemDate(b, archives);
  if (ad === undefined || bd === undefined) return ad === bd ? tie() : ad === undefined ? 1 : -1;
  return (sort === 'newest' || sort === 'largest' ? bd - ad : ad - bd) || tie();
}
export function monthKey(item: HtmlPage, archives?: ReadonlyMap<string, ArchiveMeta>): string {
  const date = itemDate(item, archives);
  return date === undefined ? 'undated' : new Date(date).toISOString().slice(0,7);
}
export function monthLabel(key: string): string {
  return key === 'undated' ? 'Undated' : new Intl.DateTimeFormat('en', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${key}-01T00:00:00Z`));
}
/** Preserve the shared projection's month and leaf order; missing dates always come last. */
export function groupItemsByMonth(items: HtmlPage[], archives?: ReadonlyMap<string, ArchiveMeta>): {key:string; label:string; items:HtmlPage[]}[] {
  const groups = new Map<string, HtmlPage[]>();
  for (const item of items) {const key = monthKey(item, archives); const group = groups.get(key) ?? []; group.push(item); groups.set(key,group);}
  const result = [...groups].filter(([key])=>key !== 'undated');
  if (groups.has('undated')) result.push(['undated',groups.get('undated')!]);
  return result.map(([key,items])=>({key,label:monthLabel(key),items}));
}

/** Pure display projection: leaves retain canonical IDs, paths and folder assignments. */
export function projectTree(nodes: TreeNode[], items: ReadonlyMap<string,HtmlPage>, order: ViewOrder, archives?: ReadonlyMap<string,ArchiveMeta>, folders?: ReadonlyMap<string,WorkspaceFolder>): TreeNode[] {
  const leaves: TreeNode[] = [];
  const visit = (branches: TreeNode[]) => {for(const node of branches) {if(node.kind==='page') leaves.push(node); else visit(node.children);}};
  visit(nodes);
  const compareLeaves = (a: TreeNode,b: TreeNode) => compareItems(items.get(a.pageId!)!,items.get(b.pageId!)!,order.sort,archives);
  if(order.group==='all') return [...leaves].sort(compareLeaves);
  if(order.group==='month') {
    const sorted = [...leaves].sort(compareLeaves);
    const byId = new Map(leaves.map(node=>[node.pageId!,node]));
    const groups = groupItemsByMonth(sorted.map(node=>items.get(node.pageId!)!),archives);
    groups.sort((a,b)=> a.key==='undated' ? b.key==='undated'?0:1 : b.key==='undated' ? -1 : (order.sort==='oldest'?1:-1)*exact(a.key,b.key));
    return groups.map(group=>({id:`month:${group.key}`,archiveId:'',label:group.label,kind:'collection',pageCount:group.items.length,children:group.items.map(item=>byId.get(item.id)!)}));
  }
  const dates = treeDateMetadata(nodes,items,archives,folders);
  const areas=new Map<string,number>();
  const fillAreas=(node:TreeNode):number|undefined=>{
    if(node.kind==='page'){const item=node.pageId?items.get(node.pageId):undefined;const dims=item?imageDimensions(item):undefined;const area=dims?dims.width*dims.height:undefined;if(area!==undefined)areas.set(node.id,area);return area;}
    let largest:number|undefined;for(const child of node.children){const area=fillAreas(child);if(area!==undefined&&(largest===undefined||area>largest))largest=area;}
    if(largest!==undefined)areas.set(node.id,largest);return largest;
  };
  const bySize=order.sort==='largest'||order.sort==='smallest';
  if(bySize)for(const node of nodes)fillAreas(node);
  const sorted = (branches: TreeNode[]): TreeNode[] => branches.map(node=>node.kind==='page'?node:{...node,children:sorted(node.children)}).sort((a,b)=>{
    if(a.kind==='page' && b.kind==='page') return compareLeaves(a,b);
    if(order.sort==='name-asc'||order.sort==='name-desc') return (order.sort==='name-desc'?-1:1)*textOrder(a.label,b.label)||exact(a.id,b.id);
    const ad=bySize?areas.get(a.id):dates.get(a.id)?.timestamp,bd=bySize?areas.get(b.id):dates.get(b.id)?.timestamp;
    if(ad===undefined||bd===undefined)return ad===bd?textOrder(a.label,b.label)||exact(a.id,b.id):ad===undefined?1:-1;
    return (order.sort==='newest'||order.sort==='largest'?bd-ad:ad-bd)||textOrder(a.label,b.label)||exact(a.id,b.id);
  });
  return sorted(nodes);
}
