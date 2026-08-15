/**
 * dsh-model-balance build script.
 *
 * Uses esbuild to:
 *  - Compile host entry to ESM (lib/index.js)
 *  - Compile client entry and wrap in the DSH factory pattern (lib/client.js)
 *
 * CSS is inlined as a JavaScript string injection (following DSH convention).
 *
 * Usage:  npx tsx scripts/build.ts
 */

import { build, type Plugin } from "esbuild-wasm"
import { rmSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const OUT = resolve(ROOT, "lib")

// ---------------------------------------------------------------------------
// CSS inlining plugin
// ---------------------------------------------------------------------------

const cssInlinePlugin: Plugin = {
  name: "css-inline",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const fs = await import("node:fs/promises")
      const css = await fs.readFile(args.path, "utf8")
      const escaped = css
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$")
      return {
        contents: `export default ${JSON.stringify(css)}`,
        loader: "js",
      }
    })
  },
}

// ---------------------------------------------------------------------------
// DSH client factory wrapper
// ---------------------------------------------------------------------------

function wrapClientFactory(code: string): string {
  return `window.__ModuleLoader__.load({
\tid: "dsh-model-balance",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${indent(code, 2)}
\t\treturn module.exports;
\t}
});
`
}

function indent(code: string, tabs: number): string {
  const prefix = "\t".repeat(tabs)
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : prefix + line))
    .join("\n")
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

async function main() {
  console.log("Cleaning lib/ …")
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  // 1) Host entry — standard ESM
  console.log("Building host entry …")
  await build({
    entryPoints: [resolve(ROOT, "src/host/index.ts")],
    outfile: resolve(OUT, "index.js"),
    bundle: false,
    platform: "node",
    target: "es2022",
    format: "esm",
    sourcemap: true,
    external: [],
  })

  // 2) Client entry — bundled + factory-wrapped
  console.log("Building client entry …")
  const clientResult = await build({
    entryPoints: [resolve(ROOT, "src/client/index.ts")],
    write: false,
    bundle: true,
    platform: "browser",
    target: "es2022",
    format: "cjs",
    sourcemap: false,
    minify: false,
    plugins: [cssInlinePlugin],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    jsx: "transform",
    jsxFactory: "h",
    jsxFragment: "null",
    loader: {
      ".ts": "ts",
      ".tsx": "ts",
    },
    // Externalise react — the DSH loader's require("react") resolves it
    external: ["react", "react/jsx-runtime"],
  })

  const clientCode = clientResult.outputFiles[0].text
  const wrappedCode = wrapClientFactory(clientCode)
  const { writeFileSync } = await import("node:fs")
  writeFileSync(resolve(OUT, "client.js"), wrappedCode, "utf8")

  console.log("Build complete ✓")
  console.log(`  Host:   lib/index.js`)
  console.log(`  Client: lib/client.js`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
