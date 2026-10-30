type Category = { id: string; name: string; slug: string };

const keywords: Record<string, string[]> = {
  "building-materials": ["cement", "plywood", "timber", "bricks", "sand", "tiles", "roofing"],
  electronics: ["laptop", "phone", "computer", "charger", "television", "monitor"],
  "auto-parts": ["tyres", "tires", "brake pads", "spark plugs", "alternator"],
  "food-beverages": ["rice", "flour", "sugar", "cooking oil", "coffee", "juice"],
  "medical-supplies": ["syringes", "bandages", "stethoscope", "surgical masks"],
  "office-supplies": ["printer paper", "stationery", "stapler", "ink cartridges"],
  packaging: ["cartons", "packaging", "bubble wrap", "packing tape"],
  agriculture: ["fertilizer", "fertiliser", "seeds", "animal feed"],
  "fashion-retail": ["shirts", "trousers", "dresses", "shoes", "fabric"],
};

/** Conservative extraction: only explicit numeric budgets; never invent a location. */
export function parseSearchIntent(input: string, categories: Category[], savedCity = "") {
  let product = input.trim();
  let min: number | undefined;
  let max: number | undefined;
  const amount = "(?:₦\\s*|NGN\\s*)?(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(k|thousand)?(?:\\s*(?:naira|NGN))?";
  const number = (value: string, suffix?: string) => Number(value.replaceAll(",", "")) * (suffix ? 1000 : 1);
  const range = new RegExp(`\\bbetween\\s+${amount}\\s+and\\s+${amount}`, "i");
  const match = product.match(range);
  if (match) {
    min = number(match[1], match[2]); max = number(match[3], match[4]);
    product = product.replace(match[0], "");
  } else {
    const ceiling = product.match(new RegExp(`\\b(?:under|below|up to|maximum|max|budget(?: of)?)\\s+${amount}`, "i"));
    const floor = product.match(new RegExp(`\\b(?:above|over|at least|minimum|min)\\s+${amount}`, "i"));
    if (ceiling) { max = number(ceiling[1], ceiling[2]); product = product.replace(ceiling[0], ""); }
    if (floor) { min = number(floor[1], floor[2]); product = product.replace(floor[0], ""); }
  }
  if ((min !== undefined && min > 1e10) || (max !== undefined && max > 1e10) || (min !== undefined && max !== undefined && min > max)) {
    throw new Error("Please give a price range with the minimum below the maximum.");
  }
  if (/[$€£]|\b(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/i.test(input)) {
    throw new Error("These listings are priced in NGN. Please specify a naira budget, or search without a price range.");
  }
  const location = product.match(/\b(?:in|near|around)\s+([\p{L}][\p{L}\s.'-]*?)\s*[.!?]*$/u);
  const city = location ? location[1].trim().replace(/[.!?]+$/, "") : savedCity.trim();
  if (location) product = product.replace(location[0], "");
  product = product.replace(/^(?:please\s+)?(?:find(?: me)?|show me|i need|we need|i am looking for|i'm looking for|looking for|search for)\s+/i, "").replace(/[.!?,]+$/g, "").replace(/\s+/g, " ").trim();
  const lower = product.toLowerCase();
  const category = categories.find((entry) => lower === entry.name.toLowerCase() || (keywords[entry.slug] ?? []).some((word) => new RegExp(`\\b${word}\\b`, "i").test(lower)));
  return { q: product.slice(0, 80), city: city.slice(0, 60), category: category?.id ?? "", min, max, locationSource: location ? "spoken" : city ? "profile" : "unspecified" };
}
