async () => {
 const {qaProbe}=await import('/src/ui/qa/qaProbe.ts');
 const {platformServices}=await import('/src/platform/platform.ts');
 const el=document.querySelector('canvas');
 let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
 let store=null;
 for(let f=fiber;f;f=f.return) {
   const value=f.memoizedProps?.value;
   if(value?.getState && value?.setSpeed) {store=value;break;}
 }
 if(!store) throw Error('React GameStore provider not found; fail closed');
 window.__vision={probe:qaProbe,store,input:platformServices().input};
 return {tick:store.getState().tick,camera:qaProbe()?.camera()};
}
