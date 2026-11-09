import { useMemo } from "react";

function multiply(a:number,b:number):number {
  let result=0;
  for(let i=7;i>=0;i--){result=(result<<1)^((result>>>7)*0x11d);result^=((b>>>i)&1)*a;}
  return result;
}
function reedSolomon(data:number[],degree:number):number[] {
  let generator=[1],root=1;
  for(let i=0;i<degree;i++){const next=new Array(generator.length+1).fill(0);for(let j=0;j<generator.length;j++){next[j]^=generator[j];next[j+1]^=multiply(generator[j],root);}generator=next;root=multiply(root,2);}
  const work=[...data,...new Array(degree).fill(0)];
  for(let i=0;i<data.length;i++){const factor=work[i];if(factor)for(let j=0;j<generator.length;j++)work[i+j]^=multiply(generator[j],factor);}
  return work.slice(data.length);
}
function encodeVersion2L(value:string):boolean[][] {
  const bytes=Array.from(new TextEncoder().encode(value));if(bytes.length>53)throw new Error("RESA QR payload is too long.");
  const bits:number[]=[];const append=(v:number,n:number)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
  append(4,4);append(bytes.length,8);bytes.forEach(b=>append(b,8));const capacity=55*8;
  for(let i=0;i<Math.min(4,capacity-bits.length);i++)bits.push(0);while(bits.length%8)bits.push(0);
  const data:number[]=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
  for(let pad=0;data.length<55;pad++)data.push(pad%2===0?0xec:0x11);
  const codewords=[...data,...reedSolomon(data,15)],size=29;
  const matrix:(boolean|null)[][]=Array.from({length:size},()=>Array(size).fill(null));
  const set=(x:number,y:number,dark:boolean)=>{if(x>=0&&x<size&&y>=0&&y<size)matrix[y][x]=dark;};
  const finder=(cx:number,cy:number)=>{for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const inside=dx>=0&&dx<=6&&dy>=0&&dy<=6;set(cx+dx,cy+dy,inside&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4)));}};
  finder(0,0);finder(size-7,0);finder(0,size-7);
  for(let i=8;i<size-8;i++){set(i,6,i%2===0);set(6,i,i%2===0);}
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(22+dx,22+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  for(let i=0;i<6;i++)set(8,i,false);set(8,7,false);set(8,8,false);set(7,8,false);
  for(let i=9;i<15;i++)set(14-i,8,false);for(let i=0;i<8;i++)set(size-1-i,8,false);for(let i=8;i<15;i++)set(8,size-15+i,false);set(8,size-8,true);
  let bitIndex=0,upward=true;
  for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++){const y=upward?size-1-vert:vert;for(let j=0;j<2;j++){const x=right-j;if(matrix[y][x]!==null)continue;const bit=bitIndex<codewords.length*8?((codewords[bitIndex>>>3]>>>(7-(bitIndex&7)))&1):0;bitIndex++;set(x,y,(bit===1)!==((x+y)%2===0));}}upward=!upward;}
  const formatData=8;let rem=formatData;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);const format=((formatData<<10)|rem)^0x5412;
  for(let i=0;i<6;i++)set(8,i,((format>>>i)&1)!==0);set(8,7,((format>>>6)&1)!==0);set(8,8,((format>>>7)&1)!==0);set(7,8,((format>>>8)&1)!==0);
  for(let i=9;i<15;i++)set(14-i,8,((format>>>i)&1)!==0);for(let i=0;i<8;i++)set(size-1-i,8,((format>>>i)&1)!==0);for(let i=8;i<15;i++)set(8,size-15+i,((format>>>i)&1)!==0);set(8,size-8,true);
  return matrix.map(row=>row.map(v=>v===true));
}
export default function QrCodeDisplay({value,size=220}:{value:string;size?:number}){
  const matrix=useMemo(()=>encodeVersion2L(value),[value]);
  const path=matrix.flatMap((row,y)=>row.flatMap((dark,x)=>dark?['M'+x+' '+y+'h1v1h-1z']:[])).join("");
  // Version 3 QR symbols are 29 x 29 modules. Add the required four-module quiet zone so phone cameras can locate the symbol reliably.
  return <svg role="img" aria-label="RESA secure QR credential" viewBox="0 0 37 37" width={size} height={size} shapeRendering="crispEdges" className="rounded-lg border bg-white p-2"><rect width="37" height="37" fill="#fff"/><path d={path} fill="#000" transform="translate(4 4)"/></svg>;
}
