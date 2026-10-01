import { describe, expect, it } from "bun:test";

import { formatAddress, parseAddress, type Address } from "./places";

const address = (patch: Partial<Address>): Address => ({
  line1: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  ...patch,
});

describe("parseAddress", () => {
  it("reads a full US mailing address", () => {
    expect(parseAddress("1450 Brickell Ave, Suite 1900, Miami, FL 33131, United States")).toEqual(
      address({
        line1: "1450 Brickell Ave, Suite 1900",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
        country: "United States",
      }),
    );
  });

  it("reads an address without a street", () => {
    expect(parseAddress("Miami, FL, United States")).toEqual(
      address({ city: "Miami", state: "FL", country: "United States" }),
    );
    expect(parseAddress("Seattle, WA 98101")).toEqual(
      address({ city: "Seattle", state: "WA", postalCode: "98101" }),
    );
  });

  it("turns a spelled-out state into its code", () => {
    expect(parseAddress("Austin, Texas, United States").state).toBe("TX");
  });

  it("reads addresses outside the US", () => {
    expect(parseAddress("1 Rue de Rivoli, Paris 75001, France")).toEqual(
      address({ line1: "1 Rue de Rivoli", city: "Paris", postalCode: "75001", country: "France" }),
    );
    expect(parseAddress("10 Downing St, London SW1A 2AA, United Kingdom")).toEqual(
      address({
        line1: "10 Downing St",
        city: "London",
        postalCode: "SW1A 2AA",
        country: "United Kingdom",
      }),
    );
    expect(parseAddress("Berlin, Germany")).toEqual(
      address({ city: "Berlin", country: "Germany" }),
    );
  });

  it("keeps a lone value as the street and reads blanks as empty", () => {
    expect(parseAddress("Somewhere")).toEqual(address({ line1: "Somewhere" }));
    expect(parseAddress("  ")).toEqual(address({}));
  });

  it("is the inverse of formatAddress", () => {
    const samples = [
      address({
        line1: "500 Pine St",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "United States",
      }),
      address({ city: "Miami", state: "FL", country: "United States" }),
      address({ line1: "Calle 1", city: "Madrid", postalCode: "28001", country: "Spain" }),
    ];
    for (const sample of samples) expect(parseAddress(formatAddress(sample))).toEqual(sample);
  });
});
