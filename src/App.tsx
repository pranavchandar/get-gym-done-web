import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from './store/store';
import { applyTheme } from './theme/apply';
import { Toaster } from './components/toast';
import { Home as HomeIcon, Dumbbell, BarChart, Gear } from './components/icons';

import { SplashScreen } from './screens/Splash';
import { PickSplitScreen } from './screens/PickSplit';
import { RoutineMethodScreen } from './screens/RoutineMethod';
import { CustomizeRoutineScreen } from './screens/CustomizeRoutine';
import { HomeScreen } from './screens/Home';
import { WorkoutsListScreen } from './screens/WorkoutsList';
import { ProfileScreen } from './screens/Profile';
import { SettingsScreen } from './screens/Settings';
import { DayOverviewScreen } from './screens/DayOverview';
import { ActiveWorkoutScreen } from './screens/ActiveWorkout';
import { WorkoutCompleteScreen } from './screens/WorkoutComplete';

function ThemeManager() {
  const theme = useStore((s) => s.prefs.theme);
  const accent = useStore((s) => s.prefs.accent);
  useEffect(() => {
    applyTheme(theme, accent);
  }, [theme, accent]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, accent);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, accent]);
  return null;
}

type Tab = 'today' | 'workouts' | 'profile' | 'settings';

function MainShell() {
  const [tab, setTab] = useState<Tab>('today');
  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'today', label: 'Today', icon: <HomeIcon size={24} /> },
    { key: 'workouts', label: 'Workouts', icon: <Dumbbell size={24} /> },
    { key: 'profile', label: 'Profile', icon: <BarChart size={24} /> },
    { key: 'settings', label: 'Settings', icon: <Gear size={24} /> },
  ];
  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="crossfade" key={tab}>
          {tab === 'today' && <HomeScreen />}
          {tab === 'workouts' && <WorkoutsListScreen />}
          {tab === 'profile' && <ProfileScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </div>
      </div>
      <nav className="tabbar">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.icon}
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Root() {
  const onboardingComplete = useStore((s) => s.prefs.onboardingComplete);
  return <Navigate to={onboardingComplete ? '/home' : '/splash'} replace />;
}

function RequireOnboarding({ children }: { children: JSX.Element }) {
  const onboardingComplete = useStore((s) => s.prefs.onboardingComplete);
  const navigate = useNavigate();
  useEffect(() => {
    if (!onboardingComplete) navigate('/splash', { replace: true });
  }, [onboardingComplete, navigate]);
  return children;
}

export function App() {
  const ensureSeeded = useStore((s) => s.ensureSeeded);
  useEffect(() => {
    ensureSeeded();
  }, [ensureSeeded]);

  return (
    <HashRouter>
      <ThemeManager />
      <div className="app-frame">
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/pick-split" element={<PickSplitScreen />} />
          <Route path="/routine-method/:splitId" element={<RoutineMethodScreen />} />
          <Route path="/customize" element={<CustomizeRoutineScreen />} />
          <Route path="/customize/:seedSplitId" element={<CustomizeRoutineScreen />} />
          <Route
            path="/home"
            element={
              <RequireOnboarding>
                <MainShell />
              </RequireOnboarding>
            }
          />
          <Route path="/day/:dayId" element={<DayOverviewScreen />} />
          <Route path="/workout/:dayId" element={<ActiveWorkoutScreen />} />
          <Route path="/complete/:sessionId" element={<WorkoutCompleteScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster />
    </HashRouter>
  );
}
