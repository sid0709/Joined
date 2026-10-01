/** US places shared by the city, state, and address selectors. */

export type State = {
  name: string;
  abbreviation: string;
};

export type City = {
  name: string;
  state: string;
};

export type Address = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export const LOCATION_SEPARATOR = " · ";

export const US_STATES: State[] = [
  { name: "Alabama", abbreviation: "AL" },
  { name: "Alaska", abbreviation: "AK" },
  { name: "Arizona", abbreviation: "AZ" },
  { name: "Arkansas", abbreviation: "AR" },
  { name: "California", abbreviation: "CA" },
  { name: "Colorado", abbreviation: "CO" },
  { name: "Connecticut", abbreviation: "CT" },
  { name: "Delaware", abbreviation: "DE" },
  { name: "District of Columbia", abbreviation: "DC" },
  { name: "Florida", abbreviation: "FL" },
  { name: "Georgia", abbreviation: "GA" },
  { name: "Hawaii", abbreviation: "HI" },
  { name: "Idaho", abbreviation: "ID" },
  { name: "Illinois", abbreviation: "IL" },
  { name: "Indiana", abbreviation: "IN" },
  { name: "Iowa", abbreviation: "IA" },
  { name: "Kansas", abbreviation: "KS" },
  { name: "Kentucky", abbreviation: "KY" },
  { name: "Louisiana", abbreviation: "LA" },
  { name: "Maine", abbreviation: "ME" },
  { name: "Maryland", abbreviation: "MD" },
  { name: "Massachusetts", abbreviation: "MA" },
  { name: "Michigan", abbreviation: "MI" },
  { name: "Minnesota", abbreviation: "MN" },
  { name: "Mississippi", abbreviation: "MS" },
  { name: "Missouri", abbreviation: "MO" },
  { name: "Montana", abbreviation: "MT" },
  { name: "Nebraska", abbreviation: "NE" },
  { name: "Nevada", abbreviation: "NV" },
  { name: "New Hampshire", abbreviation: "NH" },
  { name: "New Jersey", abbreviation: "NJ" },
  { name: "New Mexico", abbreviation: "NM" },
  { name: "New York", abbreviation: "NY" },
  { name: "North Carolina", abbreviation: "NC" },
  { name: "North Dakota", abbreviation: "ND" },
  { name: "Ohio", abbreviation: "OH" },
  { name: "Oklahoma", abbreviation: "OK" },
  { name: "Oregon", abbreviation: "OR" },
  { name: "Pennsylvania", abbreviation: "PA" },
  { name: "Rhode Island", abbreviation: "RI" },
  { name: "South Carolina", abbreviation: "SC" },
  { name: "South Dakota", abbreviation: "SD" },
  { name: "Tennessee", abbreviation: "TN" },
  { name: "Texas", abbreviation: "TX" },
  { name: "Utah", abbreviation: "UT" },
  { name: "Vermont", abbreviation: "VT" },
  { name: "Virginia", abbreviation: "VA" },
  { name: "Washington", abbreviation: "WA" },
  { name: "West Virginia", abbreviation: "WV" },
  { name: "Wisconsin", abbreviation: "WI" },
  { name: "Wyoming", abbreviation: "WY" },
];

export const US_CITIES: City[] = [
  { name: "New York", state: "NY" },
  { name: "Los Angeles", state: "CA" },
  { name: "Chicago", state: "IL" },
  { name: "Houston", state: "TX" },
  { name: "Phoenix", state: "AZ" },
  { name: "Philadelphia", state: "PA" },
  { name: "San Antonio", state: "TX" },
  { name: "San Diego", state: "CA" },
  { name: "Dallas", state: "TX" },
  { name: "Austin", state: "TX" },
  { name: "San Jose", state: "CA" },
  { name: "Fort Worth", state: "TX" },
  { name: "Jacksonville", state: "FL" },
  { name: "Columbus", state: "OH" },
  { name: "Charlotte", state: "NC" },
  { name: "Indianapolis", state: "IN" },
  { name: "San Francisco", state: "CA" },
  { name: "Seattle", state: "WA" },
  { name: "Denver", state: "CO" },
  { name: "Washington", state: "DC" },
  { name: "Nashville", state: "TN" },
  { name: "Oklahoma City", state: "OK" },
  { name: "Boston", state: "MA" },
  { name: "Portland", state: "OR" },
  { name: "Las Vegas", state: "NV" },
  { name: "Detroit", state: "MI" },
  { name: "Memphis", state: "TN" },
  { name: "Louisville", state: "KY" },
  { name: "Baltimore", state: "MD" },
  { name: "Milwaukee", state: "WI" },
  { name: "Albuquerque", state: "NM" },
  { name: "Tucson", state: "AZ" },
  { name: "Fresno", state: "CA" },
  { name: "Sacramento", state: "CA" },
  { name: "Atlanta", state: "GA" },
  { name: "Miami", state: "FL" },
  { name: "Minneapolis", state: "MN" },
  { name: "Cleveland", state: "OH" },
  { name: "New Orleans", state: "LA" },
  { name: "Tampa", state: "FL" },
  { name: "Pittsburgh", state: "PA" },
  { name: "Cincinnati", state: "OH" },
  { name: "Orlando", state: "FL" },
  { name: "St. Louis", state: "MO" },
  { name: "Kansas City", state: "MO" },
  { name: "Raleigh", state: "NC" },
  { name: "Omaha", state: "NE" },
  { name: "Oakland", state: "CA" },
  { name: "Honolulu", state: "HI" },
  { name: "Anchorage", state: "AK" },
];

export function cityLabel(city: City) {
  return city.name;
}

export function joinLocations(cities: string[]) {
  return cities
    .map((city) => city.trim())
    .filter(Boolean)
    .join(LOCATION_SEPARATOR);
}

export function splitLocations(value: string) {
  return value
    .split("·")
    .map((city) => city.trim())
    .filter(Boolean);
}

export function formatAddress(address: Address) {
  const cityState = [address.city.trim(), address.state.trim()].filter(Boolean).join(", ");
  const place = [cityState, address.postalCode.trim()].filter(Boolean).join(" ");
  return [address.line1.trim(), place, address.country.trim()].filter(Boolean).join(", ");
}

const US_STATE_TOKEN = /^([A-Za-z .]+?)(?:\s+(\d{5}(?:-\d{4})?))?$/;
/** A trailing postal code has a digit and no lowercase: "75001", "SW1A 1AA", "M5V 2T6". */
const TRAILING_POSTAL = /^(.*?\S)\s+((?=[A-Z0-9 -]*\d)[A-Z0-9][A-Z0-9 -]{1,9})$/;

/** "FL", "fl", or "Florida" → "FL"; anything else → null. */
function usStateCode(value: string) {
  const text = value.trim().toLowerCase();
  const state = US_STATES.find(
    (item) => item.abbreviation.toLowerCase() === text || item.name.toLowerCase() === text,
  );
  return state?.abbreviation ?? null;
}

/**
 * Reads back what formatAddress wrote — "street, City, ST 12345, Country" — with any part
 * missing: "Miami, FL, United States", "Seattle, WA 98101", "1 Rue X, Paris 75001, France".
 */
export function parseAddress(value: string): Address {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const address = emptyAddress();
  if (parts.length === 0) return address;

  // A US state, with or without a ZIP, sits right after the city.
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const match = parts[index].match(US_STATE_TOKEN);
    const code = match ? usStateCode(match[1]) : null;
    if (!match || !code) continue;
    return {
      line1: parts.slice(0, index - 1).join(", "),
      city: parts[index - 1],
      state: code,
      postalCode: match[2] ?? "",
      country: parts.slice(index + 1).join(", "),
    };
  }

  // Elsewhere: street…, City [postal], Country.
  if (parts.length === 1) return { ...address, line1: parts[0] };
  const country = parts[parts.length - 1];
  const place = parts[parts.length - 2];
  const postal = place.match(TRAILING_POSTAL);
  return {
    line1: parts.slice(0, -2).join(", "),
    city: postal ? postal[1] : place,
    state: "",
    postalCode: postal ? postal[2] : "",
    country,
  };
}

export function emptyAddress(): Address {
  return { line1: "", city: "", state: "", postalCode: "", country: "" };
}
