// ESM shim for leaflet-draw — a side-effect-only UMD that attaches L.Draw
// to the Leaflet global. react-leaflet-draw does `import Draw from 'leaflet-draw'`
// which fails in Rolldown because the original has no ESM default export.
import 'leaflet-draw/dist/leaflet.draw-src.js';
import L from 'leaflet';

export default L.Draw;
