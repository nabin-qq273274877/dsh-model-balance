import { describe, it, expect, beforeEach } from "vitest"
import { clearCustomProvidersCache } from "../src/host/custom-providers.js"

describe("custom-providers", () => {
  beforeEach(() => {
    clearCustomProvidersCache()
  })

  it("loads bundled providers.json", async () => {
    // Skip if no bundled file exists
    const { loadCustomProviders } = await import("../src/host/custom-providers.js")
    const providers = loadCustomProviders()
    // Should have at least the bundled providers
    expect(Object.keys(providers).length).toBeGreaterThan(0)
  })
})
