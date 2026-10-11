import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { BLINKIT_STATES, type CityStockMap, type GoalType, type StateName } from "@/data/scenarios";
import { Section } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/components/game/game.css";

const GOAL_LABELS: Record<GoalType, string> = {
  "ROAS-First": "Drive sales with maximum return on ad spend",
  "Awareness-First": "Build brand recognition among new shoppers",
  "Category-Creation": "Pioneer this category and educate new customers",
  "Volume-First": "Sell as many units as possible",
  "Inventory-Clearance": "Move aging stock before it expires",
};

/** Attempts before the student may skip the check. */
const SKIP_AFTER_ATTEMPTS = 3;

function buildQuiz(goalType: GoalType, primaryState: StateName, stock: CityStockMap) {
  const correct1 = GOAL_LABELS[goalType];
  // Deterministic wrong picks so the quiz is stable across renders
  const wrong1 = (Object.entries(GOAL_LABELS) as [GoalType, string][]).filter(([k]) => k !== goalType).map(([, v]) => v).slice(0, 2);
  // Other stocked states make the student read the numbers; an empty state fills any gap,
  // picked from the stock itself so it isn't always the first ones alphabetically
  // The answer is whichever state really has the most stock (a secondary state can beat the primary)
  const top = BLINKIT_STATES.reduce((best, s) => ((stock[s] ?? 0) > (stock[best] ?? 0) ? s : best), primaryState);
  const stockedOthers = BLINKIT_STATES.filter((s) => s !== top && (stock[s] ?? 0) > 0).sort((a, b) => (stock[b] ?? 0) - (stock[a] ?? 0));
  const empty = BLINKIT_STATES.filter((s) => (stock[s] ?? 0) === 0);
  const offset = BLINKIT_STATES.reduce((h, s) => h + (stock[s] ?? 0) * (s.length + 1), top.length) % Math.max(1, empty.length);
  const wrong2 = [...stockedOthers, ...empty.slice(offset), ...empty.slice(0, offset)].slice(0, 2);
  return {
    q1Options: [correct1, ...wrong1].sort(),
    correct1,
    q2Options: [top, ...wrong2].sort(),
    correct2: top as string,
  };
}

type Props = {
  goalType: GoalType;
  primaryState: StateName;
  stock: CityStockMap;
  /** Called with true when the check is passed or skipped, false when an answer changes after that. */
  onStatusChange: (done: boolean) => void;
};

function Question({ id, prompt, options, answer, correct, checked, onPick }: {
  id: string;
  prompt: string;
  options: readonly string[];
  answer: string | null;
  correct: string;
  checked: boolean;
  onPick: (v: string) => void;
}) {
  return (
    <fieldset role="radiogroup" aria-labelledby={id} className="space-y-2">
      <legend id={id} className="mb-2 text-sm font-medium text-foreground">{prompt}</legend>
      {options.map((opt) => {
        const selected = answer === opt;
        const isCorrect = checked && opt === correct;
        const isWrong = checked && selected && opt !== correct;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(opt)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm",
              isWrong && "sim-shake",
              isCorrect ? "border-sim-good bg-sim-good/10 text-foreground"
                : isWrong ? "border-sim-bad bg-sim-bad/10 text-foreground"
                : selected ? "border-primary bg-accent text-foreground"
                : "border-border text-foreground hover:bg-secondary",
            )}
          >
            {isCorrect && <CheckCircle2 className="sim-pop-in h-4 w-4 shrink-0 text-sim-good" />}
            {isWrong && <XCircle className="h-4 w-4 shrink-0 text-sim-bad" />}
            {opt}
          </button>
        );
      })}
    </fieldset>
  );
}

export function BriefQuiz({ goalType, primaryState, stock, onStatusChange }: Props) {
  const quiz = useMemo(() => buildQuiz(goalType, primaryState, stock), [goalType, primaryState, stock]);
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [skipped, setSkipped] = useState(false);

  const q1Correct = checked && q1 === quiz.correct1;
  const q2Correct = checked && q2 === quiz.correct2;
  const passed = q1Correct && q2Correct;

  const pick = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setChecked(false);
    if (!skipped) onStatusChange(false);
  };

  const handleCheck = () => {
    setChecked(true);
    const ok = q1 === quiz.correct1 && q2 === quiz.correct2;
    if (ok) onStatusChange(true);
    else setAttempts((n) => n + 1);
  };

  const handleSkip = () => {
    setSkipped(true);
    onStatusChange(true);
  };

  const wrongMessage = !q1Correct && !q2Correct
    ? "Both answers are wrong. Re-read the summary and try again."
    : !q1Correct ? "The first answer is wrong. Look at the client's goal again." : "The second answer is wrong. Check the stocked states in the Market tab.";

  return (
    <Section title="Quick check before you continue" description="Two questions to make sure the basics stuck.">
      <div className="grid gap-6 md:grid-cols-2">
        <Question id="quiz-q1" prompt="What is this brand's main campaign objective?" options={quiz.q1Options} answer={q1} correct={quiz.correct1} checked={checked} onPick={pick(setQ1)} />
        <Question id="quiz-q2" prompt="Which state has the most stock for this brand?" options={quiz.q2Options} answer={q2} correct={quiz.correct2} checked={checked} onPick={pick(setQ2)} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
        {!passed && !skipped && (
          <Button variant="outline" size="sm" disabled={!q1 || !q2} onClick={handleCheck}>Check answers</Button>
        )}
        {checked && !passed && !skipped && <p className="text-sm text-sim-bad">{wrongMessage}</p>}
        {passed && <p className="flex items-center gap-2 text-sm font-medium text-sim-good"><CheckCircle2 className="h-4 w-4" /> Both correct. You can continue.</p>}
        {skipped && <p className="text-sm text-sim-warn">Check skipped. Ask your trainer to go over the brief with you.</p>}
      </div>

      {attempts >= SKIP_AFTER_ATTEMPTS && !passed && !skipped && (
        <div className="mt-4 rounded-lg bg-sim-warn/10 px-4 py-3 text-sm text-foreground">
          Stuck? The goal is in the summary at the top; stock is in the Market tab. If it still doesn't add up, ask your trainer.{" "}
          <button type="button" onClick={handleSkip} className="font-medium text-sim-warn underline underline-offset-2 hover:text-foreground">
            Skip and continue
          </button>
        </div>
      )}
    </Section>
  );
}
