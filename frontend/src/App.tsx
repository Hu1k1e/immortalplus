
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Layout
import Layout from './components/Layout';

// Pages (Placeholders for now)
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import DraftHelper from './pages/DraftHelper';
import Settings from './pages/Settings';

const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="matches" element={<PageTransition><Matches /></PageTransition>} />
        <Route path="matches/:matchId" element={<PageTransition><MatchDetail /></PageTransition>} />
        <Route path="draft" element={<PageTransition><DraftHelper /></PageTransition>} />
        <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
