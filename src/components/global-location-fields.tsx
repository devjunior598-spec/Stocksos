"use client";

import { useMemo, useState } from "react";

const REGION_OPTIONS: Record<string, string[]> = {
  US: ["Alabama", "California", "Florida", "New York", "Texas", "Washington"],
  CA: ["Alberta", "British Columbia", "Ontario", "Quebec"],
  GB: ["England", "Northern Ireland", "Scotland", "Wales"],
  AU: ["New South Wales", "Queensland", "Victoria", "Western Australia"],
  IN: ["Delhi", "Gujarat", "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana"],
  NG: ["Abuja Federal Capital Territory", "Lagos", "Ogun", "Oyo", "Rivers", "Kano"],
  AE: ["Abu Dhabi", "Dubai", "Sharjah"],
  ZA: ["Gauteng", "KwaZulu-Natal", "Western Cape"],
};
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function GlobalLocationFields() {
  const [country, setCountry] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const countries = useMemo(() => {
    return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const regionOptions = REGION_OPTIONS[country] ?? [];
  const regionLabel = country === "US" || country === "AU" || country === "NG" ? "State" : country === "GB" ? "Country / region" : "State / province / region";

  return <div className="location-fields">
    <div className="form-section-heading"><span>Location</span><small>Where should suppliers fulfil this request?</small></div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="country-search">Country</label><input id="country-search" list="country-options" required value={countryQuery} onChange={(event) => { const next = event.target.value; const match = countries.find(({ code, name }) => next === code || next === name || next === `${name} (${code})`); setCountryQuery(next); setCountry(match?.code ?? ""); }} placeholder="Search for a country" autoComplete="country-name" /><input type="hidden" name="country" value={country} /><datalist id="country-options">{countries.map(({ code, name }) => <option value={`${name} (${code})`} key={code} />)}</datalist></div>
      <div className="form-field"><label htmlFor="region">{regionLabel}</label><input id="region" name="region" list="region-options" required maxLength={100} placeholder="Start typing a region" /><datalist id="region-options">{regionOptions.map((region) => <option value={region} key={region} />)}</datalist></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" required minLength={2} maxLength={100} placeholder="Enter city" /></div>
      <div className="form-field"><label htmlFor="postal_code">Postal / ZIP code <span className="muted">(if applicable)</span></label><input id="postal_code" name="postal_code" maxLength={20} autoComplete="postal-code" placeholder="Postal code" /></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="area">Area / neighbourhood <span className="muted">(optional)</span></label><input id="area" name="area" maxLength={100} placeholder="Neighbourhood or district" autoComplete="address-level3" /></div>
      <div className="form-field"><label htmlFor="address">Pickup or delivery address <span className="muted">(optional)</span></label><input id="address" name="address" maxLength={240} placeholder="Street, building or landmark" autoComplete="street-address" /></div>
    </div>
  </div>;
}
