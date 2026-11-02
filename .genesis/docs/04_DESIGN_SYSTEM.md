# One design system — tokens and components defined once, consumed everywhere

No graphical UI? Apply the same principle to output schemas, error formats, CLI messages, structured logs and public types, and skip the visual library entirely.

## 1. Layers (one owner each)

| Layer | Contains | Owner path (example) |
|---|---|---|
| Primitive tokens | raw palette, type scale, spacing scale, radii, shadows, durations — **the only place raw values exist** | `design-system/tokens/primitives.*` |
| Semantic tokens | meaning → primitive: `color.surface`, `color.text.muted`, `color.danger`, `space.inline.md`, `radius.control`, `motion.fast` | `design-system/tokens/semantic.*` |
| Themes | light/dark/high-contrast/brand = alternate semantic mappings | `design-system/tokens/themes/*` |
| Primitives (components) | Button, Input, Select, Checkbox, Dialog, Sheet, Toast, Table, Card, Tabs, Badge, Avatar, Icon, Skeleton, EmptyState, ErrorState | `design-system/components/*` |
| Patterns | form layout, list+detail, page shell, navigation, data table with pagination | `design-system/patterns/*` |
| Feature UI | composes patterns and primitives with semantic tokens only | `capabilities/<c>/ui/*` |

Generate platform outputs (CSS variables, Tailwind theme, iOS/Android/Flutter constants) from one token source when there are several platforms (e.g. Style Dictionary). Never hand-maintain two copies.

## 2. Rules

1. Feature code uses **semantic** tokens and design-system components only. No hex/rgb/hsl, px/rem literals, font names, z-index numbers or durations in features.
2. Need a new visual value? Add it to the token owner (with a semantic name) in its own change, then use it.
3. Need a component variant? Extend the primitive with a typed variant prop and a story/test; never fork or restyle it locally.
4. Every interactive component documents and tests its states: default, hover, focus-visible, active, disabled, loading, error, empty, success.
5. Accessibility is part of the component, not the feature: semantic elements, labels, keyboard path, visible focus, 44×44 touch targets, contrast ≥ WCAG AA, reduced motion.
6. Internationalization: logical properties (`margin-inline-start`, not `margin-left`), RTL mirroring tested, no text baked into images, strings from `platform/i18n`.
7. Icons from one set through one `Icon` component; illustrations and fonts registered in the token owner.
8. Responsive behavior uses the token breakpoints only.

## 3. Mechanical enforcement

**Built in, every stack:** set `"applies": {"design": true}` and declare the owners in `engineering.json`:

```json
"design_system": {
  "tokens": ["src/design-system/tokens/*"],
  "components": ["src/design-system/components/*"],
  "ui": ["src/*"]
}
```

`python3 .genesis/tools/genesis.py design` then runs before every gate. In every `ui` file outside `tokens` it rejects:
- raw colors: hex, `rgb()/hsl()/oklch()`, Flutter `Color(0xFF…)`, SwiftUI/UIKit `Color(red:)`;
- raw sizes and durations: `px/rem/em/pt/vh/vw/dp/sp/ms`;
- Tailwind arbitrary values (`p-[13px]`), raw `font-family`, numeric `z-index`;
- unitless spacing numbers in style objects, and Flutter/SwiftUI literal paddings and font sizes.

Outside `components` it also rejects native `<button|input|select|textarea|dialog>`. `*` crosses folders, and comments are ignored. It turns on as soon as `applies.design` is true; without `design_system` it fails and says what to add.

**Stack extras** (optional `checks.design` command, proven red/green like any gate):

| Violation | Extra gate |
|---|---|
| Raw values in CSS/SCSS | Stylelint `color-no-hex`, `color-named: never`, `declaration-strict-value` for color/spacing/font/z-index/radius (allow only `var(--…)`, `inherit`, `0`) |
| Tailwind palette escape | theme limited to tokens (`theme`, not `extend`); default palette classes disabled |
| Importing raw primitives in features | architecture gate: features may import `design-system/index` and semantic tokens only |
| Accessibility regressions | axe-core in component tests and Playwright journeys; keyboard-only E2E for the 3 critical journeys |
| Visual drift | component stories + screenshot comparison for primitives (a supplement, never the only check) |

## 4. Bootstrap output

Token owner path, component catalog path (Storybook/Ladle/gallery screen or a test fixture), the allowed-import map, one RTL story, and the planted-violation proofs (raw hex rejected, forked button rejected, missing label detected) recorded in the blueprint. A Figma file is optional; the code token source is the authority.
