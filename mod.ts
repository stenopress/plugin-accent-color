import type { SiteConfig, StenoPlugin } from "@steno/steno";

/**
 * A single accent-color value: a preset name, or a raw CSS color in any of
 * `#hex` (3/4/6/8 digit), `rgb()`/`rgba()`, or `hsl()`/`hsla()` form.
 */
export type AccentColorValue = string;

/** Options accepted by this plugin. */
export interface AccentColorOptions {
  /**
   * The theme's default accent color. A single value applies to both light
   * and dark mode; a `[light, dark]` pair sets them independently. A site
   * author overrides this per-site via `themeConfig.accentColor` in their
   * own `config.yml` - they never touch this plugin's own options, since
   * the theme bundles it (see README "Bundling this plugin in a theme").
   */
  accentColor?: AccentColorValue | [AccentColorValue, AccentColorValue];
  /** Extra or overriding named presets, merged over the built-in table. */
  presets?: Record<string, string>;
  /** Output filename under the theme's `assets/` output directory. */
  outputPath?: string;
}

const DEFAULT_PRESETS: Record<string, string> = {
  red: "hsl(0, 70%, 60%)",
  orange: "hsl(27.57, 87%, 67%)",
  yellow: "hsl(45, 90%, 55%)",
  green: "hsl(140, 45%, 45%)",
  blue: "hsl(210, 80%, 55%)",
  purple: "hsl(270, 50%, 60%)",
};

// A percentage or a plain number, optionally with decimals - covers both
// `hsl(210, 80%, 55%)` and the newer space-separated `hsl(210 80% 55%)`, and
// lets rgb()/hsl() alpha channels be either `0.5` or `50%`.
const NUM = "-?[\\d.]+%?";
const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_PATTERN = new RegExp(
  `^rgba?\\(\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*(?:[,/]\\s*${NUM}\\s*)?\\)$`,
  "i",
);
const HSL_PATTERN = new RegExp(
  `^hsla?\\(\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*(?:[,/]\\s*${NUM}\\s*)?\\)$`,
  "i",
);

/**
 * Resolves a single accent-color value (a preset name, or a raw CSS color
 * in `#hex`, `rgb()`/`rgba()`, or `hsl()`/`hsla()` form) to a concrete CSS
 * color. The value is returned as-is once recognized; no format conversion
 * happens, so the emitted CSS keeps whichever notation was configured.
 *
 * @throws {Error} if `value` is neither a known preset nor a recognized
 *   color format.
 */
export function resolveAccentColor(value: string, presets: Record<string, string>): string {
  const trimmed = value.trim();
  if (HEX_PATTERN.test(trimmed)) return trimmed;
  if (RGB_PATTERN.test(trimmed)) return trimmed;
  if (HSL_PATTERN.test(trimmed)) return trimmed;

  const preset = presets[trimmed.toLowerCase()];
  if (preset) return preset;

  throw new Error(
    `accent-color: "${value}" is neither a known preset (${Object.keys(presets).join(
      ", ",
    )}) nor a valid #hex, rgb()/rgba(), or hsl()/hsla() color.`,
  );
}

function readAccentColorConfig(
  config: SiteConfig,
  fallback: AccentColorValue | [AccentColorValue, AccentColorValue],
): [AccentColorValue, AccentColorValue] {
  const fromSite = config.themeConfig?.accentColor as
    | AccentColorValue
    | [AccentColorValue, AccentColorValue]
    | undefined;
  const raw = fromSite ?? fallback;
  return Array.isArray(raw) ? raw : [raw, raw];
}

/**
 * Creates the accent-color plugin.
 *
 * This plugin is meant to be **bundled by a theme**, not added to a site's
 * own `plugins:` list - see the README for the full rationale and a
 * `mod.ts` example. A theme constructs it once with its own default:
 *
 * ```ts
 * import accentColor from "@steno/plugin-accent-color";
 *
 * const theme: StenoTheme = {
 *   name: "ametrine",
 *   version: "1.0.0",
 *   layouts: { ... },
 *   configSchema: {
 *     accentColor: { type: "string", default: "blue" },
 *   },
 *   plugins: [accentColor({ accentColor: "blue" })],
 * };
 * ```
 *
 * A site using that theme then only ever writes `themeConfig.accentColor`
 * in its own `config.yml` - it never imports or configures this plugin
 * directly.
 */
export default function accentColorPlugin(options: AccentColorOptions = {}): StenoPlugin {
  const presets = { ...DEFAULT_PRESETS, ...options.presets };
  const outputPath = options.outputPath ?? "accent-color.css";
  const fallback = options.accentColor ?? "blue";

  return {
    name: "accent-color",

    async afterBuild(config) {
      const [light, dark] = readAccentColorConfig(config, fallback);
      const lightColor = resolveAccentColor(light, presets);
      const darkColor = resolveAccentColor(dark, presets);

      const css = `:root {\n  --accent: ${lightColor};\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --accent: ${darkColor};\n  }\n}\n`;

      if (!config.output) {
        throw new Error("accent-color: config.output is missing, cannot write accent-color.css.");
      }
      const assetsDir = `${config.output}/assets`;
      await Deno.mkdir(assetsDir, { recursive: true });
      await Deno.writeTextFile(`${assetsDir}/${outputPath}`, css);
    },
  };
}
