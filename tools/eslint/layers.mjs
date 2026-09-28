// Layer rule (CODE-1b): the simulation layers never import the presentation layers. The single source of the rule:
// tools/eslint/eslint.config.mjs uses it (npm run lint, npm run check:merge); other configs import it, not copy it.
// Files in src/{engine,population,economy,zones,world,save,ledger,state}/** may not import src/ui/** or src/render/**
// (relative "../ui/…", "../../render/…", or a "src/ui/…" path). Presentation reads the simulation, never the reverse:
// wording the simulation needs belongs to its own *.ko.ts or comes back as a code the UI words.
// Violations that existed when the rule came in are in eslint-suppressions.json (CODE-1a removes them).
export const SIMULATION_LAYERS = ['engine', 'population', 'economy', 'zones', 'world', 'save', 'ledger', 'state'];
export const PRESENTATION_LAYERS = ['ui', 'render'];

const presentation = PRESENTATION_LAYERS.join('|');

export const layersConfig = {
  name: 'fls/layers',
  files: [`src/{${SIMULATION_LAYERS.join(',')}}/**/*.{ts,tsx,js,jsx,mjs,cjs}`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        regex: `^((\\.\\./)+|(\\./)?(\\.\\./)*src/)(${presentation})(/|$)`,
        message: 'Simulation layers (src/engine, population, economy, zones, world, save, ledger, state) do not import src/ui or src/render (tools/eslint/layers.mjs, AGENTS.md rule 19).',
      }],
    }],
  },
};
