import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/routes/Dashboard';
import { Scan } from '@/routes/Scan';
import { Binders } from '@/routes/Binders';
import { BinderDetail } from '@/routes/BinderDetail';
import { PageDetail } from '@/routes/PageDetail';
import { Cards } from '@/routes/Cards';
import { CardDetail } from '@/routes/CardDetail';
import { MergeCards } from '@/routes/MergeCards';
import { Review } from '@/routes/Review';
import { Settings } from '@/routes/Settings';
import { About } from '@/routes/About';
import { PlacementRefine } from '@/routes/PlacementRefine';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<Scan />} />
          <Route path="binders" element={<Binders />} />
          <Route path="binders/:id" element={<BinderDetail />} />
          <Route path="binders/:id/pages/:n" element={<PageDetail />} />
          <Route path="cards" element={<Cards />} />
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
