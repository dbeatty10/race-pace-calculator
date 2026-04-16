import { describe, it, expect } from "vitest";
import { getModel, listModels } from "@engine/models/registry";

describe("model registry", () => {
  it("lists all registered models", () => {
    const models = listModels();
    expect(models.length).toBe(5);
    const ids = models.map((m) => m.id);
    expect(ids).toContain("minetti");
    expect(ids).toContain("strava_inferred");
    expect(ids).toContain("re3");
    expect(ids).toContain("ultrapacer_default");
    expect(ids).toContain("the_pacing_project_reconstructed");
  });

  it("retrieves a model by id", () => {
    const m = getModel("minetti");
    expect(m.id).toBe("minetti");
    expect(m.label).toBe("Minetti");
  });

  it("throws for unknown model id", () => {
    expect(() => getModel("nonexistent")).toThrow("Unknown model: nonexistent");
  });

  it("returns strava_inferred as default (first in list)", () => {
    const models = listModels();
    expect(models[0]!.id).toBe("strava_inferred");
  });
});
