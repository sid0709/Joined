import { describe, expect, it } from "bun:test";
import { DEFAULT_FILTERS } from "./search";
import { searchQuery } from "./search-request";

describe("searchQuery", () => {
  it("asks for one page instead of the catalog", () => {
    const params = searchQuery(DEFAULT_FILTERS, 1);
    expect(params.get("limit")).toBe("25");
    expect(params.get("sort")).toBe("relevance");
    expect(params.get("page")).toBeNull();
  });

  it("maps filters onto the search API", () => {
    const params = searchQuery(
      {
        ...DEFAULT_FILTERS,
        q: "designer",
        where: "Chicago",
        workplace: ["remote"],
        source: ["scouted"],
        minPay: 150000,
        posted: "7d",
        visa: true,
        sort: "pay",
      },
      2,
    );
    expect(params.get("q")).toBe("designer");
    expect(params.get("location")).toBe("Chicago");
    expect(params.get("remote")).toBe("true");
    expect(params.get("source")).toBe("hidden");
    expect(params.get("salaryMin")).toBe("150000");
    expect(params.get("postedDays")).toBe("7");
    expect(params.get("visa")).toBe("1");
    expect(params.get("sort")).toBe("pay");
    expect(params.get("page")).toBe("2");
  });

  it("sends several workplaces as one list", () => {
    const params = searchQuery({ ...DEFAULT_FILTERS, workplace: ["remote", "hybrid"] }, 1);
    expect(params.get("workplace")).toBe("remote,hybrid");
    expect(params.get("remote")).toBeNull();
  });
});
