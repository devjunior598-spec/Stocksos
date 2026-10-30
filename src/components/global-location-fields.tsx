"use client";

import { useMemo, useState } from "react";
import { City, Country, State } from "country-state-city";

type LocationDefaults = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  postalCode?: string | null;
  area?: string | null;
  address?: string | null;
};

export function GlobalLocationFields({ defaults = {}, includeAddress = true, description = "Where should suppliers fulfil this request?" }: {
  defaults?: LocationDefaults;
  includeAddress?: boolean;
  description?: string;
}) {
  const countries = useMemo(() => Country.getAllCountries().map(({ isoCode, name }) => ({ code: isoCode, name })).sort((a, b) => a.name.localeCompare(b.name)), []);
  const initialCountry = defaults.country && countries.some(({ code }) => code === defaults.country) ? defaults.country : "";
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(defaults.region ?? "");
  const [regionCode, setRegionCode] = useState(() => State.getStatesOfCountry(initialCountry).find(({ name }) => name === defaults.region)?.isoCode ?? "");
  const [city, setCity] = useState(defaults.city ?? "");
  const regionOptions = useMemo(() => State.getStatesOfCountry(country).map(({ isoCode, name }) => ({ code: isoCode, name })).sort((a, b) => a.name.localeCompare(b.name)), [country]);
  const cityOptions = useMemo(() => {
    if (!country || !regionCode) return [];
    return Array.from(new Map(City.getCitiesOfState(country, regionCode).map(({ name }) => [name, name])).values()).sort((a, b) => a.localeCompare(b));
  }, [country, regionCode]);
  const regionLabel = country === "US" || country === "AU" ? "State" : country === "GB" ? "Country / region" : "State / province / region";

  return <div className="location-fields">
    <div className="form-section-heading"><span>Location</span><small>{description}</small></div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="country">Country</label><select id="country" name="country" required value={country} onChange={(event) => { setCountry(event.target.value); setRegion(""); setRegionCode(""); setCity(""); }} autoComplete="country-name"><option value="" disabled>Select a country</option>{countries.map(({ code, name }) => <option value={code} key={code}>{name} ({code})</option>)}</select><span className="form-hint">Select from all available countries.</span></div>
      <div className="form-field"><label htmlFor="region">{regionLabel}</label>{regionOptions.length ? <select id="region" name="region" required value={region} onChange={(event) => { const selected = regionOptions.find((item) => item.name === event.target.value); setRegion(event.target.value); setRegionCode(selected?.code ?? ""); setCity(""); }} autoComplete="address-level1"><option value="">Select a state or region</option>{regionOptions.map((item) => <option value={item.name} key={item.code}>{item.name}</option>)}</select> : <input id="region" name="region" required maxLength={100} value={region} onChange={(event) => { setRegion(event.target.value); setRegionCode(""); setCity(""); }} placeholder="Enter state, province or region" autoComplete="address-level1" />}<span className="form-hint">{regionOptions.length ? `${regionOptions.length} regions available for this country.` : "Enter the region manually if no official subdivision list is available."}</span></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="city">City</label>{cityOptions.length ? <select id="city" name="city" required value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2"><option value="">Select a city</option>{cityOptions.map((item) => <option value={item} key={item}>{item}</option>)}{city && !cityOptions.includes(city) ? <option value={city}>{city}</option> : null}</select> : <input id="city" name="city" required minLength={2} maxLength={100} value={city} onChange={(event) => setCity(event.target.value)} placeholder="Enter city" autoComplete="address-level2" />}<span className="form-hint">{cityOptions.length ? `${cityOptions.length} cities available for this state.` : "Enter your city."}</span></div>
      <div className="form-field"><label htmlFor="postal_code">Postal / ZIP code <span className="muted">(if applicable)</span></label><input id="postal_code" name="postal_code" maxLength={20} defaultValue={defaults.postalCode ?? ""} autoComplete="postal-code" placeholder="Postal code" /></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="area">Area / neighbourhood <span className="muted">(optional)</span></label><input id="area" name="area" maxLength={100} defaultValue={defaults.area ?? ""} placeholder="Neighbourhood or district" autoComplete="address-level3" /></div>
      {includeAddress ? <div className="form-field"><label htmlFor="address">Pickup or delivery address <span className="muted">(optional)</span></label><input id="address" name="address" maxLength={240} defaultValue={defaults.address ?? ""} placeholder="Street, building or landmark" autoComplete="street-address" /></div> : null}
    </div>
  </div>;
}
