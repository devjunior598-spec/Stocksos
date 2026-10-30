"use client";

import { useMemo, useState } from "react";
import { Country, State } from "country-state-city";

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
  const initialCountry = defaults.country && countries.some(({ code }) => code === defaults.country) ? defaults.country : "US";
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(defaults.region ?? "");
  const regionOptions = useMemo(() => State.getStatesOfCountry(country).map(({ name }) => name).sort((a, b) => a.localeCompare(b)), [country]);
  const regionLabel = country === "US" || country === "AU" ? "State" : country === "GB" ? "Country / region" : "State / province / region";

  return <div className="location-fields">
    <div className="form-section-heading"><span>Location</span><small>{description}</small></div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="country">Country</label><select id="country" name="country" required value={country} onChange={(event) => { setCountry(event.target.value); setRegion(""); }} autoComplete="country-name"><option value="" disabled>Select a country</option>{countries.map(({ code, name }) => <option value={code} key={code}>{name} ({code})</option>)}</select><span className="form-hint">Select from all available countries.</span></div>
      <div className="form-field"><label htmlFor="region">{regionLabel}</label>{regionOptions.length ? <select id="region" name="region" required value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1"><option value="">Select a state or region</option>{regionOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select> : <input id="region" name="region" required maxLength={100} value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Enter state, province or region" autoComplete="address-level1" />}<span className="form-hint">{regionOptions.length ? `${regionOptions.length} regions available for this country.` : "Enter the region manually if no official subdivision list is available."}</span></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" required minLength={2} maxLength={100} defaultValue={defaults.city ?? ""} placeholder="Enter city" autoComplete="address-level2" /></div>
      <div className="form-field"><label htmlFor="postal_code">Postal / ZIP code <span className="muted">(if applicable)</span></label><input id="postal_code" name="postal_code" maxLength={20} defaultValue={defaults.postalCode ?? ""} autoComplete="postal-code" placeholder="Postal code" /></div>
    </div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="area">Area / neighbourhood <span className="muted">(optional)</span></label><input id="area" name="area" maxLength={100} defaultValue={defaults.area ?? ""} placeholder="Neighbourhood or district" autoComplete="address-level3" /></div>
      {includeAddress ? <div className="form-field"><label htmlFor="address">Pickup or delivery address <span className="muted">(optional)</span></label><input id="address" name="address" maxLength={240} defaultValue={defaults.address ?? ""} placeholder="Street, building or landmark" autoComplete="street-address" /></div> : null}
    </div>
  </div>;
}
