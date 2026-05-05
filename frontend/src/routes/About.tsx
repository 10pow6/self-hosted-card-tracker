import { ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/PageHeader';

const SOCIALS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: 'https://github.com/10pow6', label: 'GitHub', icon: <GithubIcon /> },
  { href: 'https://twitter.com/10pow6', label: 'Twitter', icon: <XIcon /> },
  { href: 'https://discord.gg/6tr2kHcJ2b', label: 'Discord', icon: <DiscordIcon /> },
  { href: 'https://www.youtube.com/@10pow6', label: 'YouTube', icon: <YoutubeIcon /> },
];

export function About() {
  return (
    <>
      <PageHeader
        title="About"
        description="Card Tracker — built and maintained by 10pow6 LLC."
      />
      <section className="px-4 md:px-8 pb-12 max-w-3xl space-y-4">
        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-6 flex items-start gap-4">
            <img
              src="/icon.png"
              alt="10pow6"
              className="size-16 rounded-2xl shadow-lg shadow-primary/20 shrink-0"
              draggable={false}
            />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Card Tracker
              </div>
              <h2 className="text-xl font-semibold mt-0.5">A self-hosted home for your collection</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Photograph a binder page, the app finds each card, and every placement maps back to a
                canonical entry in your local database. Pokémon, sports, MTG, Yu-Gi-Oh — same flow,
                same database.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-semibold">Why this exists</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you keep cards in binders, every <em>"where did I put my Charizard?"</em> turns into
              flipping pages. The existing options are some mix of: tedious manual entry, a paid
              subscription, a cloud account that holds your data hostage, or a tool locked to a
              single card type. Privacy and longevity matter — a tracker for a 30-year-old card
              hobby shouldn't depend on someone else's server staying online.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Card Tracker is the answer to that. It runs entirely on your own machine. Your photos,
              embeddings, and database never leave the box. Pokémon and sports cards live in the
              same canonical table because cards are cards — your binders don't care what's printed
              on them. The only network call it makes during normal use is a one-time download of
              the local vision model the first time you scan; after that, you can pull the network
              cable and everything still works.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The architecture is deliberately conservative — SQLite, brute-force similarity, a
              small CPU-friendly model — because lightweight tools survive longer than clever ones.
              Future hooks are placeholder model slots in Settings: swap in a vision LLM for
              detection, a different embedder, or an MCP-driven metadata enricher when you're ready.
              The UI doesn't change; the engine room does.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-6 space-y-4">
            <div>
              <h3 className="font-semibold">Find us</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bug reports, ideas, and questions all welcome.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground">{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </span>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-6 space-y-3">
            <h3 className="font-semibold">License & disclaimer</h3>
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <div>
                <span className="text-foreground font-medium">License · MIT.</span>{' '}
                Copyright © 2026 10pow6 LLC. Permission is granted, free of charge, to use, copy,
                modify, and distribute this software, subject to the conditions in the LICENSE file
                shipped with the source.
              </div>
              <div>
                <span className="text-foreground font-medium">No warranty.</span>{' '}
                The software is provided <em>as is</em>, without warranty of any kind, express or
                implied, including but not limited to the warranties of merchantability, fitness for
                a particular purpose, and non-infringement. In no event shall the authors or
                copyright holders be liable for any claim, damages, or other liability arising from
                the use of the software.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

// Brand icons inlined — lucide-react v1 dropped brand icons.

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.18c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.12 3.05.73.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.832L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a14.41 14.41 0 0 0-.617 1.265 18.27 18.27 0 0 0-5.488 0A14.06 14.06 0 0 0 9.823 3.2a19.74 19.74 0 0 0-3.764 1.171C2.388 9.844 1.402 15.18 1.892 20.444a19.94 19.94 0 0 0 6.061 3.063c.49-.665.927-1.371 1.302-2.114a12.96 12.96 0 0 1-2.05-.99c.172-.127.34-.26.502-.395 3.926 1.815 8.176 1.815 12.054 0 .164.135.33.268.502.395a12.94 12.94 0 0 1-2.053.99c.376.743.812 1.45 1.301 2.114a19.92 19.92 0 0 0 6.067-3.063c.575-6.13-.978-11.42-4.16-16.075ZM8.02 17.21c-1.21 0-2.21-1.114-2.21-2.486 0-1.371.978-2.486 2.21-2.486 1.236 0 2.232 1.123 2.21 2.486 0 1.372-.974 2.486-2.21 2.486Zm7.96 0c-1.21 0-2.21-1.114-2.21-2.486 0-1.371.978-2.486 2.21-2.486 1.235 0 2.232 1.123 2.21 2.486 0 1.372-.975 2.486-2.21 2.486Z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.55 12 3.55 12 3.55s-7.505 0-9.377.5A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.5 9.376.5 9.376.5s7.505 0 9.377-.5a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  );
}
