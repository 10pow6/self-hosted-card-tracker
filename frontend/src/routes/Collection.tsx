import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { BindersTab } from '@/components/BindersTab';
import { AllCardsTab } from '@/components/AllCardsTab';

type Tab = 'binders' | 'cards';

export function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'cards' ? 'cards' : 'binders';

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    next === 'binders' ? params.delete('tab') : params.set('tab', next);
    // Reset tab-scoped page params on tab change.
    params.delete('cpage');
    setSearchParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Your collection"
        description={
          tab === 'binders'
            ? 'Each binder is a stack of physical pages, every slot mapped back to your card database.'
            : 'Every physical card across your binders. Duplicates included. Click Refine to inspect or fix any slot.'
        }
      />
      <section className="px-4 md:px-8 pb-12">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5">
          <TabsList>
            <TabsTrigger value="binders">Binders</TabsTrigger>
            <TabsTrigger value="cards">All cards</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'binders' ? <BindersTab /> : <AllCardsTab />}
      </section>
    </>
  );
}
