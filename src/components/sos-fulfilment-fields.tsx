"use client";

import { useState } from "react";

export function SOSFulfilmentFields() {
  const [urgency, setUrgency] = useState("today");
  return <>
    <div className="form-section-heading"><span>Fulfilment</span><small>Tell suppliers how and when you need the stock.</small></div>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="delivery_method">Fulfilment preference</label><select id="delivery_method" name="delivery_method" defaultValue="both"><option value="both">Both: pickup or delivery</option><option value="delivery">Delivery to me</option><option value="pickup">I can pick it up</option><option value="flexible">No preference</option></select><span className="form-hint">Choose both if you can either collect the order or receive delivery.</span></div>
      <div className="form-field"><label htmlFor="urgency">When do you need it?</label><select id="urgency" name="urgency" value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="immediately">Immediately</option><option value="within_30_minutes">Within 30 minutes</option><option value="within_2_hours">Within 2 hours</option><option value="today">Today</option><option value="scheduled">Scheduled</option></select></div>
    </div>
    {urgency === "scheduled" ? <div className="form-field"><label htmlFor="scheduled_at">Scheduled date and time</label><input id="scheduled_at" name="scheduled_at" type="datetime-local" required /></div> : null}
  </>;
}
