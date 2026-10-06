import { AXIS_LABELS, GRID_SIZE, type City } from '../model/index.js';
const NS = 'http://www.w3.org/2000/svg';
function shape(tag: string, attrs: Readonly<Record<string, string | number>>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
export function cityMap(city: City, masked = false): SVGElement {
  const svg = shape('svg', { viewBox: `0 0 ${GRID_SIZE * 16} ${GRID_SIZE * 16}`, role: 'img', 'aria-label': masked ? '영지 배치 비교 지도' : `${city.tick}일 영지 지도`, class: 'city-map' });
  const title = shape('title', {});
  title.textContent = '같은 시작에서 주민이 고른 시설과 길';
  svg.append(title);
  for (const tile of city.tiles) {
    const x = tile.x * 16, y = tile.y * 16;
    const land = tile.water ? 'water' : tile.elevation > 2 ? 'mountain' : tile.wood >= 4 ? 'forest' : city.terrain === 'marsh' ? 'wetland' : 'land';
    svg.append(shape('rect', { x, y, width: 16, height: 16, class: `terrain ${land}` }));
    if (!tile.water && tile.wood >= 4) svg.append(shape('path', { d: `M${x+3} ${y+12} l5 -10 l5 10z`, class: 'tree' }));
  }
  for (const tile of city.tiles) {
    const x = tile.x * 16, y = tile.y * 16;
    if (tile.road) {
      svg.append(shape('rect', { x: x + 5, y: y + 5, width: 7, height: 7, class: 'road' }));
      for (const neighbor of city.tiles.filter(t => t.road && ((t.x === tile.x + 1 && t.y === tile.y) || (t.y === tile.y + 1 && t.x === tile.x)))) svg.append(shape('path', { d: `M${x+8} ${y+8}L${neighbor.x*16+8} ${neighbor.y*16+8}`, class: 'road-link' }));
    }
  }
  for (const h of city.households) {
    if (h.people <= 0) continue;
    svg.append(shape('rect', { x: h.x * 16 + 3, y: h.y * 16 + 8, width: 7, height: 6, class: 'home' }));
  }
  for (const f of city.facilities.filter(f => f.hp > 0)) {
    const x = f.x * 16, y = f.y * 16;
    const group = shape('g', { class: `facility ${f.axis}` });
    const hint = shape('title', {});
    hint.textContent = masked ? `시설, 일손 ${f.workers}` : `${AXIS_LABELS[f.axis]} 시설, 일손 ${f.workers}`;
    group.append(hint);
    switch (f.axis) {
      case 'agriculture':
        group.append(shape('rect', { x: x + 1, y: y + 1, width: 14, height: 14 }));
        for (const line of [4, 8, 12]) group.append(shape('path', { d: `M${x+2} ${y+line}h12`, class: 'detail' }));
        break;
      case 'military':
        group.append(shape('path', { d: `M${x+1} ${y+14}V${y+2}h3v3h3V${y+2}h3v3h3V${y+2}h2v12z` }));
        break;
      case 'maritime':
        group.append(shape('path', { d: `M${x+1} ${y+10}h14l-4 5H${x+5}z M${x+8} ${y+1}v9l5-3z` }));
        break;
      case 'faith':
        group.append(shape('path', { d: `M${x+2} ${y+14}V${y+7}l6-5 6 5v7z M${x+8} ${y}v6` }));
        break;
      case 'trade': case 'craft': case 'scholarship': case 'diplomacy':
        group.append(shape('rect', { x: x + 2, y: y + 5, width: 12, height: 9 }));
        group.append(shape('path', { d: `M${x} ${y+6}l8-6 8 6z`, class: 'roof' }));
        break;
      default: assertNever(f.axis);
    }
    svg.append(group);
  }
  return svg;
}
function assertNever(value: never): never { throw new RangeError(String(value)); }
