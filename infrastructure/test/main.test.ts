import { describe, it, expect } from "vitest"

describe("main.ts", () => {
  it("should import and execute without errors", async () => {
    // main.ts is the entry point that executes app.synth()
    // Use dynamic import to verify since direct import would execute synth
    const mainModule = await import("../src/main")
    expect(mainModule).toBeDefined()
  })
})

