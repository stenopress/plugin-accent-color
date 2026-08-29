import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { SiteConfig } from "@steno/steno";
import accentColorPlugin, { resolveAccentColor } from "./mod.ts";

function siteConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Test site",
    description: "",
    author: "",
    output: "",
    ...overrides,
  };
}

Deno.test("accent-color: has a stable name", () => {
  const plugin = accentColorPlugin();
  assertEquals(plugin.name, "accent-color");
});

Deno.test("resolveAccentColor: resolves a built-in preset", () => {
  const result = resolveAccentColor("purple", { purple: "hsl(270, 50%, 60%)" });
  assertEquals(result, "hsl(270, 50%, 60%)");
});

Deno.test("resolveAccentColor: passes a raw hsl() value through unchanged", () => {
  const result = resolveAccentColor("hsl(12, 34%, 56%)", {});
  assertEquals(result, "hsl(12, 34%, 56%)");
});

Deno.test("resolveAccentColor: passes a raw hsla() value through unchanged", () => {
  assertEquals(resolveAccentColor("hsla(12, 34%, 56%, 0.5)", {}), "hsla(12, 34%, 56%, 0.5)");
});

Deno.test("resolveAccentColor: accepts space-separated modern hsl() syntax", () => {
  assertEquals(resolveAccentColor("hsl(12 34% 56% / 50%)", {}), "hsl(12 34% 56% / 50%)");
});

Deno.test("resolveAccentColor: accepts 3/4/6/8-digit hex", () => {
  assertEquals(resolveAccentColor("#f0a", {}), "#f0a");
  assertEquals(resolveAccentColor("#f0a8", {}), "#f0a8");
  assertEquals(resolveAccentColor("#ff00aa", {}), "#ff00aa");
  assertEquals(resolveAccentColor("#ff00aa88", {}), "#ff00aa88");
  assertEquals(resolveAccentColor("#FF00AA", {}), "#FF00AA");
});

Deno.test("resolveAccentColor: rejects a malformed hex", () => {
  assertThrows(() => resolveAccentColor("#ff00a", {}), Error);
  assertThrows(() => resolveAccentColor("#gg0000", {}), Error);
});

Deno.test("resolveAccentColor: accepts rgb()/rgba()", () => {
  assertEquals(resolveAccentColor("rgb(255, 0, 170)", {}), "rgb(255, 0, 170)");
  assertEquals(resolveAccentColor("rgba(255, 0, 170, 0.5)", {}), "rgba(255, 0, 170, 0.5)");
  assertEquals(resolveAccentColor("rgb(255 0 170 / 50%)", {}), "rgb(255 0 170 / 50%)");
});

Deno.test("resolveAccentColor: is case-insensitive on preset names", () => {
  const result = resolveAccentColor("Purple", { purple: "hsl(270, 50%, 60%)" });
  assertEquals(result, "hsl(270, 50%, 60%)");
});

Deno.test("resolveAccentColor: throws on an unknown value", () => {
  assertThrows(
    () => resolveAccentColor("not-a-color", { purple: "hsl(270, 50%, 60%)" }),
    Error,
    "not-a-color",
  );
});

Deno.test("accent-color: writes light+dark CSS from a theme default, no site override", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const plugin = accentColorPlugin({ accentColor: "blue" });
    await plugin.afterBuild?.(siteConfig({ output: dir }));

    const css = await Deno.readTextFile(`${dir}/assets/accent-color.css`);
    assertEquals(css.includes("--accent: hsl(210, 80%, 55%);"), true);
    assertEquals(css.includes("prefers-color-scheme: dark"), true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("accent-color: site's themeConfig.accentColor overrides the theme default", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const plugin = accentColorPlugin({ accentColor: "blue" });
    await plugin.afterBuild?.(
      siteConfig({ output: dir, themeConfig: { accentColor: ["purple", "orange"] } }),
    );

    const css = await Deno.readTextFile(`${dir}/assets/accent-color.css`);
    assertEquals(css.includes("hsl(270, 50%, 60%)"), true); // light: purple
    assertEquals(css.includes("hsl(27.57, 87%, 67%)"), true); // dark: orange
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("accent-color: theme default and site override can each use a different color format", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const plugin = accentColorPlugin({ accentColor: "#7760a9" });
    await plugin.afterBuild?.(
      siteConfig({ output: dir, themeConfig: { accentColor: ["rgb(20, 30, 40)", "purple"] } }),
    );

    const css = await Deno.readTextFile(`${dir}/assets/accent-color.css`);
    assertEquals(css.includes("--accent: rgb(20, 30, 40);"), true);
    assertEquals(css.includes("hsl(270, 50%, 60%)"), true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("accent-color: rejects when config.output is missing", () => {
  const plugin = accentColorPlugin();
  assertRejects(() => plugin.afterBuild?.(siteConfig({ output: undefined })) as Promise<void>);
});
