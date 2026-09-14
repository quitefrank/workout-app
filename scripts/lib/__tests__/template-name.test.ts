import { describe, expect, it } from "vitest";
import {
  TEMPLATE_NAMES,
  extractVariant,
  inferTemplateCategory,
} from "../template-name";

describe("TEMPLATE_NAMES", () => {
  it("lists the 18 canonical Notion page templates", () => {
    expect(TEMPLATE_NAMES).toHaveLength(18);
    expect(new Set(TEMPLATE_NAMES).size).toBe(18);
  });

  it("every canonical name resolves to a category", () => {
    for (const name of TEMPLATE_NAMES) {
      expect(inferTemplateCategory(name), name).not.toBeNull();
    }
  });
});

describe("inferTemplateCategory", () => {
  it("Run (indoor) -> cardio", () => {
    expect(inferTemplateCategory("Run (indoor)")).toBe("cardio");
  });

  it("Ab Circuit -> abs", () => {
    expect(inferTemplateCategory("Ab Circuit")).toBe("abs");
  });

  it("Full Body P2 -> full_body", () => {
    expect(inferTemplateCategory("Full Body P2")).toBe("full_body");
  });

  it("Push (7) -> push", () => {
    expect(inferTemplateCategory("Push (7)")).toBe("push");
  });

  it("Stretches -> null", () => {
    expect(inferTemplateCategory("Stretches")).toBeNull();
  });

  it("tolerates leading and trailing whitespace", () => {
    expect(inferTemplateCategory(" Legs P1 ")).toBe("legs");
  });
});

describe("extractVariant", () => {
  it("Run (indoor) -> (indoor)", () => {
    expect(extractVariant("Run (indoor)")).toBe("(indoor)");
  });

  it("Full Body P2 -> P2", () => {
    expect(extractVariant("Full Body P2")).toBe("P2");
  });

  it("Push P1 -> P1", () => {
    expect(extractVariant("Push P1")).toBe("P1");
  });

  it("single word -> null", () => {
    expect(extractVariant("Stretches")).toBeNull();
  });
});
