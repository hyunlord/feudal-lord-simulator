// Forbidden native controls in the screens (REVIEW-1, shared with UI-KIT-1). The single source of the rule: the merge
// checks (tools/eslint/eslint.config.mjs) use it, and any other ESLint config should import it rather than copy it.
// In the screens (src/ui, src/App.tsx and the React views of src/render), native <select>, <input>, <textarea>, bare
// <button> and <details>/<summary> elements are not written; they use the parts of the UI kit (src/ui/kit/, UI-KIT-1,
// docs/design/ui-kit.md), which is the only place allowed to render host controls.
export const UI_KIT_DIR = 'src/ui/kit/';

const nativeControl = (tag, part) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
  message: `No native <${tag}> in the screens: use the UI kit's ${part} (${UI_KIT_DIR}). Only the kit renders host controls.`,
});

export const uiControlsConfig = {
  name: 'fls/ui-controls',
  files: ['src/ui/**/*.{ts,tsx,js,jsx}', 'src/App.tsx', 'src/render/**/*.tsx'],
  ignores: [`${UI_KIT_DIR}**`],
  rules: {
    'no-restricted-syntax': ['error',
      nativeControl('button', 'Button / IconButton / Toggle / Tabs'),
      nativeControl('select', 'Select'),
      nativeControl('input', 'Slider / Toggle / Checkbox'),
      nativeControl('textarea', 'parts'),
      nativeControl('details', 'Disclosure'),
      nativeControl('summary', 'Disclosure'),
    ],
  },
};
