import { Link } from 'react-router';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TONE_CLASSES } from '@/lib/decisions';
import { cn } from '@/lib/utils';

// Answers "what does the AI decide on its own vs. what waits for me?" —
// the pipeline's actual authority, stated in-product (DESIGN.md · Overview).
const RULES: { tone: keyof typeof TONE_CLASSES; title: string; detail: string }[] = [
  {
    tone: 'ai',
    title: 'Auto-matched',
    detail:
      'A crop whose similarity clears the auto-accept threshold is matched by the model. Labeled violet everywhere, and always reversible.',
  },
  {
    tone: 'warning',
    title: 'Sent to review',
    detail:
      'Anything below the threshold waits in the queue. The model ranks candidates; nothing is written until you decide.',
  },
  {
    tone: 'info',
    title: 'Added as new card',
    detail:
      'With no close match at all, the pipeline creates a new catalog entry — merge it later if it turns out to be a duplicate.',
  },
  {
    tone: 'success',
    title: 'Your word is final',
    detail:
      'Confirming or editing anything marks it human-verified (green) and overrides every model suggestion.',
  },
];

export function GuardrailsCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          What runs on autopilot
        </div>
        <ul className="mt-3 space-y-3">
          {RULES.map((rule) => (
            <li key={rule.title} className="flex gap-2.5 text-sm">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_CLASSES[rule.tone].dot)} />
              <span>
                <span className="font-medium">{rule.title}</span>
                <span className="block text-muted-foreground text-[13px] leading-snug mt-0.5">
                  {rule.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link to="/settings">
            Models & AI settings
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
