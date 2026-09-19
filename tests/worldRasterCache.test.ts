import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasterCacheKey } from '../src/render/worldRasterCache';
test('raster key invalidates for device transform, size and content', () => {
  const base = { a:1,b:0,c:0,d:1,e:0,f:0 };
  const key = rasterCacheKey('wall:a', base, 100, 100);
  assert.notEqual(key, rasterCacheKey('wall:b', base, 100, 100));
  for (const name of ['a','b','c','d','e','f'] as const) {
    assert.notEqual(key, rasterCacheKey('wall:a', {...base,[name]:base[name]+.1},100,100));
  }
  assert.notEqual(key, rasterCacheKey('wall:a',base,200,100));
  assert.notEqual(key, rasterCacheKey('wall:a',base,100,200));
});
