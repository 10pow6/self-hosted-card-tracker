import { ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { DiscordIcon, GithubIcon, XIcon, YoutubeIcon } from '@/components/icons';

const SOCIALS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: 'https://github.com/10pow6', label: 'GitHub', icon: <GithubIcon /> },
  { href: 'https://twitter.com/10pow6', label: 'Twitter', icon: <XIcon /> },
  { href: 'https://discord.gg/6tr2kHcJ2b', label: 'Discord', icon: <DiscordIcon /> },
  { href: 'https://www.youtube.com/@10pow6', label: 'YouTube', icon: <YoutubeIcon /> },
];

export function About() {
  return (
    <Page width="narrow">
      <PageHeader title="About" description="Card Tracker — built and maintained by 10pow6 LLC." />
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-6 flex items-start gap-4">
            <img
              src="/icon.png"
              alt="10pow6"
              className="size-16 rounded-2xl shadow-lg shadow-primary/20 shrink-0"
              draggable={false}
            />
            <div className="min-w-0">
              <div className="microlabel text-muted-foreground">Card Tracker</div>
              <h2 className="text-xl font-semibold mt-1">A self-hosted home for your collection</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Photograph a binder page, the app finds each card, and every placement maps back to
                a canonical entry in your local catalog. Pokémon, sports, MTG, Yu-Gi-Oh — same
                flow, same catalog.
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
              If you keep cards in binders, every <em>"where did I put my Charizard?"</em> turns
              into flipping pages. The existing options are some mix of: tedious manual entry, a
              paid subscription, a cloud account that holds your data hostage, or a tool locked to
              a single card type. Privacy and longevity matter — a tracker for a 30-year-old card
              hobby shouldn't depend on someone else's server staying online.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Card Tracker runs entirely on your own machine. Your photos, embeddings, and
              database never leave the box. Pokémon and sports cards live in the same canonical
              table because cards are cards — your binders don't care what's printed on them. The
              only network call during normal use is a one-time download of the local vision model
              the first time you scan; after that, you can pull the network cable and everything
              still works.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The architecture is deliberately conservative — SQLite, brute-force similarity, a
              small CPU-friendly model — because lightweight tools survive longer than clever
              ones. The model slots in Settings are the extension points: swap in a vision LLM for
              detection, a different embedder, or an MCP-driven metadata enricher when you're
              ready. The UI doesn't change; the engine room does.
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
                <span className="text-foreground font-medium">License · MIT.</span> Copyright ©
                2026 10pow6 LLC. Permission is granted, free of charge, to use, copy, modify, and
                distribute this software, subject to the conditions in the LICENSE file shipped
                with the source.
              </div>
              <div>
                <span className="text-foreground font-medium">No warranty.</span> The software is
                provided <em>as is</em>, without warranty of any kind, express or implied,
                including but not limited to the warranties of merchantability, fitness for a
                particular purpose, and non-infringement. In no event shall the authors or
                copyright holders be liable for any claim, damages, or other liability arising
                from the use of the software.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
