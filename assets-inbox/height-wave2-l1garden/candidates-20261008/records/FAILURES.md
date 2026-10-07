# Preserved attempts

body-attempt1: door leaf too short/narrow after footprint registration.
body-attempt2: wall raised but door still too narrow and short.
body-attempt3: width corrected, height below target.
body-attempt4: height increment insufficient.
body-attempt5: selected candidate; manual native measurements in measurements.json, uncertainty retained.

Snow first common transform was oversized: 234 alpha>16 pixels outside body. A whole-layer uniform90% registration plus translation was used; now62 outside pixels remain around roof snow boundary. No alpha clipping or pixel restoration. Neglected common registration had24outsidepixels; whole-layer native translation(-2,+1) brought marks onto facade/roof. Other layers use common whole-canvas registration. No raw was overwritten.

Root visual review rejected snow-v2 because the entire brown roof pigment is opaque between snow patches; alpha melt overwrites body roof. Original v2/raw preserved. snow03 one builtin regeneration removes roof pigment visually but alpha-weighted coverage57.397% is below60%; binary(alpha>16)69.884% is within60–80. Not promoted as PASS. No clipping/color key/mask correction.
