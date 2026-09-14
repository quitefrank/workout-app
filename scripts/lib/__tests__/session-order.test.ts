import { describe, expect, it } from "vitest";
import { orderSessions } from "../session-order";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("orderSessions", () => {
  it("reverses the relation, then appends rows the relation omits", () => {
    expect(orderSessions(["c", "b", "a"], rows)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ]);
  });

  it("returns rows unchanged when the relation is empty", () => {
    expect(orderSessions([], rows)).toEqual(rows);
  });

  it("ignores a relation id with no matching row", () => {
    expect(orderSessions(["zzz", "b"], rows)).toEqual([
      { id: "b" },
      { id: "a" },
      { id: "c" },
      { id: "d" },
    ]);
  });

  it("never emits a row twice", () => {
    expect(orderSessions(["b", "b", "a"], rows)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ]);
  });
});
