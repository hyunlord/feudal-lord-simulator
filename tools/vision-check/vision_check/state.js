() => {
 const {probe,store}=window.__vision;
 const state=store.getState(),camera=probe().camera(),viewport=probe().viewport();
 const draws=window.__visionSnapshot();
 const people=state.walkers.map(w=>{
   const foot={x:(w.position.tx-w.position.ty)*32*camera.zoom+camera.panX,y:((w.position.tx+w.position.ty)*16+5.76)*camera.zoom+camera.panY};
   return {id:w.id,kind:w.kind,foot,pathRemaining:w.path.length-w.pathIndex,cancelled:Boolean(w.cancellation),position:w.position};
 });
 const tiles=state.tiles.filter(t=>t.hasRoad||t.buildingId).map(t=>({tx:t.tx,ty:t.ty,road:t.hasRoad,building:t.buildingId}));
 return {tick:state.tick,speed:store.getSpeed(),camera,viewport,draws,people,tiles,url:location.href,proof:typeof window.__FEUDAL_PHASE10_PROOF__!=='undefined'};
}
