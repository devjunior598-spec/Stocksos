import { readFileSync } from "node:fs";
import { join } from "node:path";

export function LegalDraft({ document, title }: { document: "terms-of-service-draft.md" | "privacy-policy-draft.md"; title: string }) {
  const source = readFileSync(join(process.cwd(), "docs", "legal", document), "utf8");
  const blocks = source.split(/\n\s*\n/).slice(1);
  return <>
    <section className="page-hero"><div className="page-container"><span className="eyebrow">Draft for review</span><h1>{title}</h1><p className="lead">This draft is not in force. StockSOS is reviewing its legal details and privacy practices before publication of final terms.</p></div></section>
    <article className="page-container info-content">{blocks.map((block, index) => {
      const clean = (text: string) => text.replace(/\*\*/g, "").trim();
      if (block.startsWith("## ")) return <h2 key={index}>{clean(block.slice(3))}</h2>;
      if (block.startsWith("- ")) return <ul key={index}>{block.split("\n").filter((line) => line.startsWith("- ")).map((line, i) => <li key={i}>{clean(line.slice(2))}</li>)}</ul>;
      return <p key={index} style={{ whiteSpace: "pre-line" }}>{clean(block)}</p>;
    })}</article>
  </>;
}
