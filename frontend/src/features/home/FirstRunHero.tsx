import { Link } from 'react-router';
import { Camera, ScanSearch, Inbox, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const STEPS = [
  {
    icon: Camera,
    title: 'Photograph a page',
    detail: 'Any binder layout from 1×1 to 4×4. Straight-on, even light — the detector does the rest.',
  },
  {
    icon: ScanSearch,
    title: 'The model proposes',
    detail: 'Cards are detected and compared to your growing catalog. Every suggestion shows its confidence.',
  },
  {
    icon: Inbox,
    title: 'You decide',
    detail: 'Ambiguous matches wait in the review queue. Nothing is filed without a rule you set or a click you make.',
  },
];

// Fresh-install state: five zeros and an empty list tell a new user nothing —
// this tells them what the app does and where to start.
export function FirstRunHero() {
  return (
    <Card className="overflow-hidden border-primary/30">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center gap-2 microlabel text-primary">
          <Sparkles className="size-3.5" />
          Getting started
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          Your collection starts with one photo
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-4" />
                </span>
                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                {step.title}
              </div>
              <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
        <Button className="mt-6" asChild>
          <Link to="/scan">
            <Camera />
            Scan your first page
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
