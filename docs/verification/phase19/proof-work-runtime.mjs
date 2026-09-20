const SAMPLE_CAPACITY = 240;

                                      
                            
                              
                             
                                          
                                         
  

                 
                                                
                                            
                               
                             
  

                               
                                                     
                                                    
                                                  
  

// One active canvas owns collection; tick callbacks resolve it when they execute.
export const proofFrameWork                                             = { current: null };

export function installProofFrameWork()                                                            {
  const frames = createWorkRing();
  const ticks = createWorkRing();
  const recorder                         = {
    recordFrame: frames.record,
    recordTick: ticks.record,
    snapshot: () => ({
      capacity: SAMPLE_CAPACITY,
      frameCount: frames.count(),
      tickCount: ticks.count(),
      frameWorkMs: frames.samples(),
      tickWorkMs: ticks.samples(),
    }),
  };
  proofFrameWork.current = recorder;
  return {
    ...recorder,
    dispose: () => {
      if (proofFrameWork.current === recorder) proofFrameWork.current = null;
      frames.clear();
      ticks.clear();
    },
  };
}

function createWorkRing()           {
  const values = new Float64Array(SAMPLE_CAPACITY);
  let count = 0;
  return {
    record: (durationMs) => { values[count % SAMPLE_CAPACITY] = durationMs; count += 1; },
    count: () => count,
    samples: () => {
      const length = Math.min(count, SAMPLE_CAPACITY);
      const start = count - length;
      return Array.from({ length }, (_, offset) => values[(start + offset) % SAMPLE_CAPACITY] ?? 0);
    },
    clear: () => { count = 0; values.fill(0); },
  };
}
