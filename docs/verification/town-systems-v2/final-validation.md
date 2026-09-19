# Final verification — town-systems-v2

- Full suite: 1466/1466 passed before final route-placement adjustment (514895ms). Includes five long Phase9 tests.
- Final source: 1465/1465 non-Phase9 tests passed (92216ms), including new route and isolated-granary regressions. The five long Phase9 tests were not repeated after that adjustment; final fresh natural growth instead exercised the complete current advisor/engine trajectory from DEFAULT_GAME_STATE.
- Final build/typecheck passed; pre-existing >500kB main chunk warning remains. No configured lint script. git diff --check passed.
- World asset release verification passed, including accepted art. No art or dependency changes.
- Natural engine run:415877 ticks,8 homesL4/256people,water/market/church8/8. Every-tick stable interval403877–415877. No rejected actions or invalid stock.18source SHAchecks matched.
- Additional every-tick food observation415877–427877:all8homes minL4/min32residents,maxEmptyTicks0,declineTransitions0,positive-inventory-delta delivery estimate120bread each,960total,newactions0.
- Actual UI clicks delete/rebuild3roads: services disconnect/reconnect;zero pageerrors. Engine401tick interruption:living3/built4;23ticks afterrepair freshdelivery andliving4.
- Renderer240controlledcases:fivefootprinttypes,foursides,twomaterials,twoDPR,threezoom/pan;zero road/rearwall opaque-interior writes,hotcache/order/hover differences. SoftwareChrome used for exactmatrix; normalGPU screenshots also inspected. Foregroundwalls correctly occlude26cases.
- Independent code,security,goal/context and actualUI/visual reviews passed. See adjacent review files.

Screenshots use actualdevelopmentUI loaded with naturally evolved engine snapshots;they do not represent complete browser-driven growth. The sixpanel occlusion before/after uses controlled fixtures. Detailedstates/scripts and fulltestlog remain at the local art workspace output/town-systems-v2; portable summaries and requested images are versioned here. No deployment or main merge.
