// Run in the game's DevTools console in a separate browser profile.
// Choose indexedDB-final.json. This overwrites the slots named in the file.
(async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  const file = await new Promise(resolve => {
    input.onchange = () => resolve(input.files?.[0]);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return;
  const dump = JSON.parse(await file.text());
  if (dump.name !== 'feudal-lord-simulator-saves' || !Array.isArray(dump.stores)) throw new Error('Not a playtest save dump');
  const stores = dump.stores.map(store => ({...store, records: store.records.map(record => {
    let value = record.value;
    if (value?.encoding === 'base64') {
      const bytes = Uint8Array.from(atob(value.data), c => c.charCodeAt(0));
      if (bytes.byteLength !== value.bytes) throw new Error('Save byte length mismatch');
      value = bytes.buffer;
    }
    return {key: record.key, value};
  })}));
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dump.name, dump.version);
    request.onupgradeneeded = () => {
      for (const store of stores) if (!request.result.objectStoreNames.contains(store.name)) {
        request.result.createObjectStore(store.name, {keyPath: store.keyPath, autoIncrement: store.autoIncrement});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other game tabs and retry'));
  });
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(stores.map(s => s.name), 'readwrite');
    for (const store of stores) for (const record of store.records) {
      const target = transaction.objectStore(store.name);
      if (store.keyPath === null) target.put(record.value, record.key);
      else target.put(record.value);
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
  location.reload();
})();
