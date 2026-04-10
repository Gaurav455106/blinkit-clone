import { useState } from "react";

const slides = [
  {
    title: "What's new?",
    description: "Now create campaigns with multiple ad groups to manage your ads better!",
    link: "Know more",
  },
  {
    title: "Tip",
    description: "Use targeting options to reach your ideal audience effectively.",
    link: "Learn more",
  },
];

export function WhatsNewCard() {
  const [current, setCurrent] = useState(0);

  return (
    <div className="rounded-lg border border-border bg-accent/50 p-4">
      <h4 className="text-xs font-semibold text-foreground mb-1">{slides[current].title}</h4>
      <p className="text-xs text-muted-foreground mb-2">{slides[current].description}</p>
      <button className="text-xs text-primary font-medium hover:underline">{slides[current].link}</button>
      <div className="flex gap-1.5 mt-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === current ? "w-4 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
