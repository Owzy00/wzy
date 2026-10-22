// The accepted v30 Jiao cloud is kept intact; each of the other six has its own source.
export const QINGLONG_POSTERS=[
 {id:0,name:'角',title:'角木蛟',pinyin:'Jiao Mu Jiao',style:'jiao-poster',url:'./data/jiao-poster.json?v=32'},
 {id:1,name:'亢',title:'亢金龙',pinyin:'Kang Jin Long',style:'qinglong-poster',url:'./data/qinglong/01-kang.json?v=32'},
 {id:2,name:'氐',title:'氐土貉',pinyin:'Di Tu He',style:'qinglong-poster',url:'./data/qinglong/02-di.json?v=32'},
 {id:3,name:'房',title:'房日兔',pinyin:'Fang Ri Tu',style:'qinglong-poster',url:'./data/qinglong/03-fang.json?v=32'},
 {id:4,name:'心',title:'心月狐',pinyin:'Xin Yue Hu',style:'qinglong-poster',url:'./data/qinglong/04-xin.json?v=32'},
 {id:5,name:'尾',title:'尾火虎',pinyin:'Wei Huo Hu',style:'qinglong-poster',url:'./data/qinglong/05-wei.json?v=32'},
 {id:6,name:'箕',title:'箕水豹',pinyin:'Ji Shui Bao',style:'qinglong-poster',url:'./data/qinglong/06-ji.json?v=32'}
];
export const posterDefinition=id=>QINGLONG_POSTERS.find(p=>p.id===id);
export const isPosterStyle=style=>style==='jiao-poster'||style==='qinglong-poster';
// No network request on module import. Cache decoded source JSON for at most two posters.
export function createPosterLoader(fetcher=url=>fetch(url),limit=2){
 const loaded=new Map(),pending=new Map();
 return async function loadPoster(id){
  const definition=posterDefinition(id);if(!definition)throw new Error('当前星宿没有海报素材');
  if(loaded.has(id)){const item=loaded.get(id);loaded.delete(id);loaded.set(id,item);return item;}
  if(pending.has(id))return pending.get(id);
  const task=(async()=>{
   const response=await fetcher(definition.url);if(!response.ok)throw new Error(definition.title+'海报素材暂未加载，请重试');
   const item=await response.json();
   if(item.id!==id||item.name!==definition.name||item.title!==definition.title||item.style!==definition.style||item.count!==96000)throw new Error(definition.title+'素材映射错误');
   loaded.set(id,item);while(loaded.size>Math.max(1,limit))loaded.delete(loaded.keys().next().value);
   return item;
  })();pending.set(id,task);
  try{return await task;}finally{pending.delete(id);}
 };
}
