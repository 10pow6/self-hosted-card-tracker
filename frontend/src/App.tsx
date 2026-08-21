import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/routes/Dashboard';
import { Scan } from '@/routes/Scan';
import { Collection } from '@/routes/Collection';
import { BinderDetail } from '@/routes/BinderDetail';
import { PageDetail } from '@/routes/PageDetail';
import { Catalog } from '@/features/catalog/Catalog';
import { CardDetail } from '@/features/catalog/CardDetail';
import { MergeCards } from '@/features/catalog/MergeCards';
import { PlacementRefine } from '@/features/refine/PlacementRefine';
import { Review } from '@/routes/Review';
import { Settings } from '@/routes/Settings';
import { About } from '@/routes/About';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<Scan />} />
          <Route path="binders" element={<Collection />} />
          <Route path="binders/:id" element={<BinderDetail />} />
          <Route path="binders/:id/pages/:n" element={<PageDetail />} />
          <Route path="cards" element={<Catalog />} />
          <Route path="cards/merge" element={<MergeCards />} />
          <Route path="cards/:id" element={<CardDetail />} />
          <Route path="placements/:id/refine" element={<PlacementRefine />} />
          <Route path="review" element={<Review />} />
          <Route path="settings" element={<Settings />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
