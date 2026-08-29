# @steno/plugin-accent-color

Accent-color plugin for [Steno](https://github.com/steno/steno) that resolves a theme's accent-color
config (a named preset, a raw CSS color in `#hex`, `rgb()`/`rgba()`, or `hsl()`/`hsla()` form, or a
light/dark pair mixing any of those) once at build time, and writes the result as a static CSS
custom-properties file instead of re-resolving it on every template render.

This is for a theme that wants a single, typed `accentColor` setting a site author can override
(`themeConfig.accentColor: ["purple", "orange"]`) without the theme itself carrying any runtime color
logic in its templates. It's meant to be bundled by the theme, not installed by a site directly.

## Installation

```yaml
# content/.steno/config.yml
plugins:
  - jsr:@steno/plugin-accent-color
```

In practice this line belongs in a **theme's** `mod.ts`, not a site's `config.yml`.

## Options

```yaml
plugins:
  - package: jsr:@steno/plugin-accent-color
    options:
      accentColor: ["purple", "orange"]
      presets:
        brand: "hsl(310, 60%, 55%)"
      outputPath: accent-color.css
```

| Option        | Type                         | Default                                                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accentColor` | `string \| [string, string]` | `"blue"`                                                         | The **theme's own default**, normally passed by the bundling theme's `mod.ts` rather than set here directly. A site overrides it via `themeConfig.accentColor`. Single value applies to both light and dark mode; a 2-item array sets them independently — light and dark may each use a different format. Each item is a preset name, or a raw color in `#hex` (3/4/6/8-digit), `rgb()`/`rgba()`, or `hsl()`/`hsla()` form (including the modern space-separated syntax, e.g. `hsl(210 80% 55% / 50%)`). |
| `presets`     | `Record<string, string>`     | built-in table (`red`/`orange`/`yellow`/`green`/`blue`/`purple`) | Extra or overriding named presets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `outputPath`  | `string`                     | `"accent-color.css"`                                             | Output filename under `<output>/assets/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## How it works

The plugin hooks into Steno's `afterBuild` stage, after every page has already been rendered.

1. Reads `accentColor` from `config.themeConfig` (a single value or a `[light, dark]` pair, each a
   preset name or a raw color), falling back to the value passed at plugin construction when the
   site sets nothing.
2. Resolves each mode (light/dark) against the merged preset table, or passes a raw `#hex`,
   `rgb()`/`rgba()`, or `hsl()`/`hsla()` value straight through unchanged, rejecting anything that's
   neither a known preset nor a recognized color format.
3. Writes `<output>/assets/accent-color.css` with `:root { --accent: ...; }` for light mode and a
   `@media (prefers-color-scheme: dark)` block for dark mode, so the theme's own stylesheet just
   references `var(--accent)` — no runtime resolution logic left in the theme's templates.

### Bundling in a theme (no site-side `plugins:` entry)

A site importing "the theme" shouldn't also have to separately import and configure this plugin to
get accent colors working, that's two imports for one feature, and the plugin becomes a de-facto
part of the theme's public API without being declared as one. Instead, a module-based theme (`mod.ts`
exporting a `StenoTheme`) imports the plugin once, at its own default, and lists it under its own
`plugins:` field:

```ts
// theme/mod.ts
import type { StenoTheme } from "@steno/steno";
import accentColor from "@steno/plugin-accent-color";

const theme: StenoTheme = {
  name: "my-theme",
  version: "1.0.0",
  layouts: {
    layout: await fetch(new URL("./layouts/layout.tau", import.meta.url)).then((r) => r.text()),
  },
  configSchema: {
    accentColor: {
      type: "string", // becomes a union once core configSchema gets oneOf/anyOf support
      default: "blue",
      description: "Preset name or a #hex/rgb()/hsl() color — see plugin-accent-color's README.",
    },
  },
  defaultConfig: { accentColor: "blue" },
  plugins: [accentColor({ accentColor: "blue" })],
};

export default theme;
```

Per [theme-specification.md](https://github.com/stenopress/steno/blob/main/docs/theme-specification.md),
"a theme's own bundled plugins run before your site's configured ones", so this runs automatically on
every build that uses the theme, with zero action from the site author. Only if a site owner sets
`allowThemePlugins: false` (opting out of _all_ theme-bundled plugins) does it stop running, an
explicit, deliberate site-side choice this plugin doesn't need to account for.

A site using the theme then only ever writes:

```yaml
# content/.steno/config.yml
theme: jsr:@you/theme
themeConfig:
  accentColor: ["purple", "orange"]
```

No `plugins:` entry, no `pluginSourcePolicy`, no knowledge that a plugin is involved at all -- from the
site author's side this looks like a plain theme config field. The plugin reads
`config.themeConfig.accentColor` at build time and falls back to the value the theme's own `mod.ts`
passed at construction when the site sets nothing, so the default lives in exactly one place.

Directory-based (`theme.yaml`) themes can't do this today -- `theme.yaml` has no equivalent of a
`plugins:` key, only a module-based (`mod.ts`) `StenoTheme` object does (see `StenoTheme.plugins` in
[types.ts](https://github.com/stenopress/steno/blob/main/src/types.ts)). A theme wanting to bundle
this plugin should be authored as `mod.ts`, not `theme.yaml`, for that reason alone.

### Why this is a plugin and not a plain `configSchema` field

An accent color that accepts a single preset name, a single raw color in any of three formats, _or_ a
2-item array mixing presets and raw colors for light/dark mode independently doesn't fit Steno's `ThemeConfigField.type`
today -- it's one fixed type per field (`string`/`number`/`integer`/`boolean`/`array`/`object`, no
union), so this shape can't be fully validated as a single `configSchema` field (the example above
declares it `type: "string"` and accepts the array shape at runtime instead, unvalidated by schema).
Until `oneOf`/`anyOf` support lands in core, this plugin owns validation and normalization itself.

## Test

```sh
deno task test
```

## Learn more

- [Steno plugin development guide](https://github.com/stenopress/steno/blob/main/docs/plugins.md)
- [Theme specification](https://github.com/stenopress/steno/blob/main/docs/theme-specification.md) - `StenoTheme.plugins`, and why this can't yet be a plain schema field

## License

MIT
