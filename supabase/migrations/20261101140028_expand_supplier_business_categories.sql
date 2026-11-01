-- Broaden category coverage for the global supplier marketplace.
-- Existing category IDs, names, and business/product assignments are retained.
insert into public.categories (name, slug, sort_order) values
  ('Machinery and industrial equipment', 'industrial-machinery', 110),
  ('Tools and hardware', 'tools-hardware', 120),
  ('Chemicals and raw materials', 'chemicals-raw-materials', 130),
  ('Computers and IT equipment', 'computers-it', 140),
  ('Telecommunications and networking', 'telecom-networking', 150),
  ('Electrical and renewable energy', 'electrical-renewable-energy', 160),
  ('Plumbing and HVAC', 'plumbing-hvac', 170),
  ('Safety and protective equipment', 'safety-ppe', 180),
  ('Laboratory and scientific supplies', 'laboratory-scientific', 190),
  ('Beauty and personal care', 'beauty-personal-care', 200),
  ('Cleaning and janitorial supplies', 'cleaning-janitorial', 210),
  ('Home and kitchen', 'home-kitchen', 220),
  ('Furniture and interiors', 'furniture-interiors', 230),
  ('Hospitality and food service', 'hospitality-food-service', 240),
  ('Textiles and fabrics', 'textiles-fabrics', 250),
  ('Toys and childcare', 'toys-childcare', 260),
  ('Sports and outdoor equipment', 'sports-outdoor', 270),
  ('Pet supplies', 'pet-supplies', 280),
  ('Printing and office equipment', 'printing-office-equipment', 290),
  ('Water and sanitation', 'water-sanitation', 300),
  ('Vehicles and transportation', 'vehicles-transportation', 310)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;
