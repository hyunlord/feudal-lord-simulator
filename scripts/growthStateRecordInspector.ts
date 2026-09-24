/** Read-only debugger sampling; resumes immediately. The watchdog never waits for it. */
export async function sampleGrowthDecisionStack(url: string): Promise<readonly string[]> {
  return new Promise(resolve => {
    const socket = new WebSocket(url);
    let settled = false;
    const scriptUrls = new Map<string, string>();
    const finish = (frames: readonly string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: 3, method: 'Debugger.resume' }));
      socket.close();
      resolve(frames);
    };
    const timeout = setTimeout(() => finish(['Inspector sample timed out; entry: src/engine/autoplay.ts:decideNextAction']), 2_000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ id: 1, method: 'Debugger.enable' })));
    socket.addEventListener('error', () => finish(['Inspector unavailable; entry: src/engine/autoplay.ts:decideNextAction']));
    socket.addEventListener('message', event => {
      const value: unknown = JSON.parse(String(event.data));
      if (typeof value !== 'object' || value === null) return;
      if ('method' in value && value.method === 'Debugger.scriptParsed' && 'params' in value && typeof value.params === 'object' && value.params !== null && 'scriptId' in value.params && 'url' in value.params && typeof value.params.scriptId === 'string' && typeof value.params.url === 'string') scriptUrls.set(value.params.scriptId, value.params.url);
      if ('id' in value && value.id === 1) socket.send(JSON.stringify({ id: 2, method: 'Debugger.pause' }));
      if (!('method' in value) || value.method !== 'Debugger.paused' || !('params' in value)) return;
      const params = value.params;
      if (typeof params !== 'object' || params === null || !('callFrames' in params) || !Array.isArray(params.callFrames)) return;
      const frames: string[] = [];
      for (const frame of params.callFrames) {
        if (typeof frame !== 'object' || frame === null) continue;
        const location: unknown = 'location' in frame ? frame.location : null;
        if (typeof location !== 'object' || location === null) continue;
        const scriptId = 'scriptId' in location && typeof location.scriptId === 'string' ? location.scriptId : '';
        const line = 'lineNumber' in location && typeof location.lineNumber === 'number' ? location.lineNumber + 1 : null;
        const column = 'columnNumber' in location && typeof location.columnNumber === 'number' ? location.columnNumber + 1 : null;
        const name = 'functionName' in frame && typeof frame.functionName === 'string' ? frame.functionName : '';
        frames.push(JSON.stringify({ function: name, url: scriptUrls.get(scriptId) ?? '', line, column }));
      }
      finish(frames);
    });
  });
}
