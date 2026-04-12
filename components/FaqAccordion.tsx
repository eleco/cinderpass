'use client';

import { useState } from 'react';

type FaqItem = { q: string; a: string };
type FaqSection = { heading: string; items: FaqItem[] };

function FaqItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' faq-item-open' : ''}`}>
      <button
        type="button"
        className="faq-question"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <span className="faq-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open ? <div className="faq-answer">{a}</div> : null}
    </div>
  );
}

export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  return (
    <div className="faq-stack">
      {sections.map((section) => (
        <div key={section.heading} className="faq-section">
          <h2 className="faq-heading">{section.heading}</h2>
          <div className="faq-items">
            {section.items.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
