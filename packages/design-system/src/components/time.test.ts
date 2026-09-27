import { describe, expect, it } from "bun:test";

import {
  displayTime,
  formatTime,
  from12,
  fromMinutes,
  meridiemOf,
  minutesOf,
  parseTime,
  range,
  to12,
} from "./time";

describe("time helpers", () => {
  it("parses empty, valid, and invalid time values", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("09:30")).toEqual({ h: 9, m: 30, s: 0 });
    expect(parseTime("21:30:45")).toEqual({ h: 21, m: 30, s: 45 });
    expect(parseTime("nope:30")).toBeNull();
  });

  it("formats wrapped time parts with optional seconds", () => {
    expect(formatTime({ h: 24, m: -1, s: 61 }, false)).toBe("00:59");
    expect(formatTime({ h: 23, m: 59, s: 59 }, true)).toBe("23:59:59");
  });

  it("converts hours between 12-hour and 24-hour clocks", () => {
    expect(to12(0)).toBe(12);
    expect(to12(12)).toBe(12);
    expect(to12(13)).toBe(1);
    expect(meridiemOf(0)).toBe("AM");
    expect(meridiemOf(12)).toBe("PM");
    expect(from12(12, "AM")).toBe(0);
    expect(from12(9, "PM")).toBe(21);
  });

  it("displays valid values for both clock cycles", () => {
    expect(displayTime("", "12h")).toBe("");
    expect(displayTime("bad", "24h")).toBe("");
    expect(displayTime("09:05", "12h")).toBe("9:05 AM");
    expect(displayTime("21:05:07", "12h", true)).toBe("9:05:07 PM");
    expect(displayTime("21:05:07", "24h")).toBe("21:05");
  });

  it("creates ranges and converts minute counts", () => {
    expect(range(1, 5, 2)).toEqual([1, 3, 5]);
    expect(minutesOf("01:30")).toBe(90);
    expect(minutesOf("bad")).toBe(0);
    expect(fromMinutes(90)).toBe("01:30");
    expect(fromMinutes(1440)).toBe("00:00");
  });
});
