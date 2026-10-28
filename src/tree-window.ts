import type {TreeNode} from './types';

export const TREE_ROW_HEIGHT = 28;
export const TREE_WINDOW_THRESHOLD = 250;
export interface TreeRow {node:TreeNode;level:number;parentId:string|null;position:number;setSize:number;open:boolean}
/** The visible branch projection, independent of which rows happen to be mounted. */
export function flattenVisibleTree(nodes:TreeNode[],expanded:ReadonlySet<string>,forceOpen=false):TreeRow[]{
  const result:TreeRow[]=[];
  const visit=(siblings:TreeNode[],level:number,parentId:string|null)=>{
    siblings.forEach((node,index)=>{
      const open=node.kind!=='page'&&(forceOpen||expanded.has(node.id));
      result.push({node,level,parentId,position:index+1,setSize:siblings.length,open});
      if(open)visit(node.children,level+1,node.id);
    });
  };
  visit(nodes,1,null);return result;
}
export function treeWindow(count:number,scrollTop:number,height:number,overscan=8):{start:number;end:number;height:number}{
  const shown=Math.max(1,Math.ceil(Math.max(0,height)/TREE_ROW_HEIGHT));
  const start=Math.min(Math.max(0,count-shown-overscan),Math.max(0,Math.floor(Math.max(0,scrollTop)/TREE_ROW_HEIGHT)-overscan));
  return {start,end:Math.min(count,start+shown+overscan*2),height:count*TREE_ROW_HEIGHT};
}
export function treeRowScroll(index:number,scrollTop:number,height:number):number{
  const top=index*TREE_ROW_HEIGHT,bottom=top+TREE_ROW_HEIGHT;
  return top<scrollTop?top:bottom>scrollTop+height?Math.max(0,bottom-height):scrollTop;
}
