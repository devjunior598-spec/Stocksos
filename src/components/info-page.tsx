import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

export type InfoSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export function InfoPage({
  eyebrow,
  title,
  intro,
  sections,
  cards,
  action,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections?: InfoSection[];
  cards?: { title: string; description: string }[];
  action?: { label: string; href: string };
}) {
  return (
    <>
      <section className="page-hero">
        <div className="page-container">
          <span className="eyebrow"><span className="status-dot" />{eyebrow}</span>
          <h1>{title}</h1>
          <p className="lead">{intro}</p>
          {action ? <Link className="button button-primary" href={action.href}>{action.label}<ArrowUpRight size={16} /></Link> : null}
        </div>
      </section>
      <section className="page-container info-content">
        {cards?.length ? (
          <div className="info-card-list">
            {cards.map((card) => (
              <article className="info-card" key={card.title}>
                <span className="feature-icon"><Check size={19} /></span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        ) : null}
        {sections?.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets?.length ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
          </section>
        ))}
      </section>
    </>
  );
}
