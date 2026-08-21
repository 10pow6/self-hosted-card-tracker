import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/PageHeader';
import { BindersTab } from '@/features/binders/BindersTab';
import { PhysicalCardsTab } from '@/features/binders/PhysicalCardsTab';

type Tab = 'binders' | 'physical';

// Param scheme: ?tab=physical selects the physical-cards tab. Each tab
// namespaces its own params (bq / pq, ppage, pstatus) so switching tabs
// never clobbers the other tab's state.
export function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  // 'cards' is the legacy value for old bookmarks.
  const tab: Tab = rawTab === 'physical' || rawTab === 'cards' ? 'physical' : 'binders';

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'binders') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Page>
      <PageHeader
        title="Binders"
        description={
          tab === 'binders'
            ? 'Your physical collection — each binder is a stack of pages whose slots map back to the catalog.'
            : 'Every physical card across your binders, duplicates included. The catalog of distinct cards lives under Catalog.'
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-5">
          <TabsTrigger value="binders">Binders</TabsTrigger>
          <TabsTrigger value="physical">Physical cards</TabsTrigger>
        </TabsList>
        <TabsContent value="binders">
          <BindersTab />
        </TabsContent>
        <TabsContent value="physical">
          <PhysicalCardsTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
