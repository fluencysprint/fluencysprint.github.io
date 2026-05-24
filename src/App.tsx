import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Onboarding from './pages/Onboarding';
import Diagnostic from './pages/Diagnostic';
import Dashboard from './pages/Dashboard';
import Sprint from './pages/Sprint';
import Skills from './pages/Skills';
import Review from './pages/Review';
import Writing from './pages/Writing';
import Speaking from './pages/Speaking';
import Listening from './pages/Listening';
import Exam from './pages/Exam';
import Settings from './pages/Settings';
import { getActiveProfile, listProfiles, migrateLegacyIfNeeded } from './lib/profile';
import { initPersistenceLifecycle, requestPersistentStorage } from './lib/storageAdapter';
import { getSettings } from './lib/storage';

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = getActiveProfile();
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  // Force a re-render after first-load migration so RequireProfile sees state.
  const [bootKey, setBootKey] = useState(0);

  useEffect(() => {
    initPersistenceLifecycle();
    requestPersistentStorage();
    if (listProfiles().length === 0) {
      // Best-effort: lift a legacy c1sprint.* progress blob into a Spanish profile.
      const migrated = migrateLegacyIfNeeded();
      if (migrated) setBootKey(k => k + 1);
    }
    try {
      const settings = getSettings();
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <HashRouter key={bootKey}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/diagnostic" element={
          <RequireProfile>
            <Diagnostic />
          </RequireProfile>
        } />
        <Route path="/*" element={
          <RequireProfile>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sprint" element={<Sprint />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/review" element={<Review />} />
                <Route path="/writing" element={<Writing />} />
                <Route path="/speaking" element={<Speaking />} />
                <Route path="/listening" element={<Listening />} />
                <Route path="/exam" element={<Exam />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </RequireProfile>
        } />
      </Routes>
    </HashRouter>
  );
}
