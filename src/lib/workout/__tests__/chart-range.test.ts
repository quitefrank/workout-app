import { describe, expect, it } from "vitest";
import { chartAxis, dayMs, inRange, isChartRange, openingRange, rangeLabel, rangeStart } from "../chart-range";

const at = (date: string) => ({ t: dayMs(date) });
const TODAY = "2026-11-13";

describe("rangeStart", () => {
  it("counts back calendar months from today", () => {
    expect(rangeStart("1M", TODAY)).toBe(dayMs("2026-10-13"));
    expect(rangeStart("6M", TODAY)).toBe(dayMs("2026-05-13"));
    expect(rangeStart("1Y", TODAY)).toBe(dayMs("2025-11-13"));
  });
  it("clamps to the end of a shorter month", () => {
    expect(rangeStart("1M", "2026-03-31")).toBe(dayMs("2026-02-28"));
    expect(rangeStart("3M", "2026-05-31")).toBe(dayMs("2026-02-28"));
  });
  it("has no start for All time", () => {
    expect(rangeStart("All", TODAY)).toBeNull();
  });
});

describe("inRange", () => {
  const points = [at("2025-01-28"), at("2026-05-13"), at("2026-05-19"), at("2026-11-01")];
  it("keeps points from the range's first day on", () => {
    expect(inRange(points, "6M", TODAY)).toHaveLength(3);
    expect(inRange(points, "1M", TODAY)).toHaveLength(1);
    expect(inRange(points, "All", TODAY)).toHaveLength(4);
  });
});

describe("openingRange", () => {
  it("keeps the saved range when it holds 2 points", () => {
    expect(openingRange([at("2026-10-20"), at("2026-11-01")], "6M", TODAY)).toBe("6M");
  });
  it("opens on the shortest range with 2 points otherwise", () => {
    // the bench in Frank's screenshot: one session in the last 6 months
    const bench = [at("2025-05-10"), at("2025-05-18"), at("2025-05-24"), at("2026-01-28"), at("2026-05-19")];
    expect(openingRange(bench, "6M", TODAY)).toBe("1Y");
    expect(openingRange([at("2024-01-01"), at("2024-02-01")], "6M", TODAY)).toBe("All");
  });
  it("picks a shorter range than the saved one only if the saved one is empty, which it never is then", () => {
    expect(openingRange([at("2026-11-01"), at("2026-11-10")], "1Y", TODAY)).toBe("1Y");
  });
  it("keeps the saved range when no range has a trend", () => {
    expect(openingRange([at("2026-11-01")], "3M", TODAY)).toBe("3M");
    expect(openingRange([], "6M", TODAY)).toBe("6M");
  });
});

describe("chartAxis", () => {
  it("runs from the range's start to the end of today", () => {
    const axis = chartAxis([at("2026-11-01")], "6M", TODAY);
    expect(axis.domain[0]).toBe(dayMs("2026-05-13"));
    expect(axis.domain[1]).toBe(dayMs("2026-11-14") - 1);
    expect(axis.ticks).toHaveLength(4);
  });
  it("keeps ticks off the ends, evenly spaced, so no label is clipped", () => {
    const { domain, ticks } = chartAxis([], "6M", TODAY);
    const step = (domain[1] - domain[0]) / 4;
    expect(ticks[0]).toBe(Math.round(domain[0] + step / 2));
    expect(ticks[3]).toBe(Math.round(domain[1] - step / 2));
  });
  it("starts All time at the first point", () => {
    expect(chartAxis([at("2025-05-10"), at("2026-05-19")], "All", TODAY).domain[0]).toBe(dayMs("2025-05-10"));
  });
  it("labels short spans with month and day, long ones with month and year", () => {
    expect(chartAxis([], "3M", TODAY).format(dayMs("2026-05-19"))).toBe("May 19");
    expect(chartAxis([], "1Y", TODAY).format(dayMs("2026-01-28"))).toBe("Jan ’26");
  });
});

describe("labels", () => {
  it("names each range and rejects unknown values", () => {
    expect(rangeLabel("6M")).toBe("Last 6 months");
    expect(isChartRange("All")).toBe(true);
    expect(isChartRange("2Y")).toBe(false);
    expect(isChartRange(null)).toBe(false);
  });
});
