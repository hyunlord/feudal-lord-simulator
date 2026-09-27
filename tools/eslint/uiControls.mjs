// Forbidden native controls in the screens (REVIEW-1, shared with UI-KIT-1). The single source of the rule: the merge
// checks (tools/eslint/eslint.config.mjs) use it, and any other ESLint config should import it rather than copy it.
// In src/ui, native <select>, <input> and bare <button> elements are not written by screens; they use the parts of
// the UI kit (src/ui/kit/, UI-KIT-1), which is the only place allowed to render host controls.
export const UI_KIT_DIR = 'src/ui/kit/';

const nativeControl = (tag, part) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
  message: `No native <${tag}> in src/ui: use the UI kit's ${part} (${UI_KIT_DIR}). Only the kit renders host controls.`,
});

export const uiControlsConfig = {
  name: 'fls/ui-controls',
  files: ['src/ui/**/*.{ts,tsx,js,jsx}'],
  ignores: [`${UI_KIT_DIR}**`],
  rules: {
    'no-restricted-syntax': ['error',
      nativeControl('button', 'Button'),
      nativeControl('select', 'Select'),
      nativeControl('input', 'input parts'),
    ],
  },
};
