import { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store/store';
import { applyTheme } from './theme/apply';
import { Toaster, clearToasts } from './components/toast';
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
import { SessionDetailScreen } from './screens/SessionDetail';

function ThemeManager() {
  const theme = useStore((s) => s.prefs.theme);
  const accent = useStore((s) => s.prefs.accent);
  const textSize = useStore((s) => s.prefs.textSize ?? 'default');
  useEffect(() => {
    applyTheme(theme, accent);
  }, [theme, accent]);
  useEffect(() => {
    document.documentElement.setAttribute('data-text', textSize);
  }, [textSize]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, accent);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, accent]);
  return null;
}

const LAST_SEEN_KEY = 'get-gym-done:last-seen';
/** Away this long, the app opens on Today rather than on whatever screen was left open. */
const STALE_MS = 30 * 60 * 1000;
/** Screens that are about one moment: a finished workout's summary, a day's overview. */
const MOMENTARY = /^\/(complete|day|session)\//;

/**
 * Coming back to the app after a while lands on Today. Reopening on last week's summary or
 * on a day overview led people to start the wrong day. A workout in progress is resumed.
 */
function ReturnToToday() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  useEffect(() => {
    const read = () => {
      try {
        return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
      } catch {
        return 0;
      }
    };
    const stamp = () => {
      try {
        localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    const check = () => {
      const last = read();
      const onboarded = useStore.getState().prefs.onboardingComplete;
      if (onboarded && last && Date.now() - last > STALE_MS && MOMENTARY.test(pathRef.current)) {
        navigate('/home', { replace: true });
      }
      stamp();
    };
    check();
    const onVis = () => (document.visibilityState === 'visible' ? check() : stamp());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', stamp);
    const id = window.setInterval(stamp, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', stamp);
      window.clearInterval(id);
    };
  }, [navigate]);
  return null;
}

type Tab = 'today' | 'workouts' | 'profile' | 'settings';

function MainShell() {
  const [tab, setTab] = useState<Tab>('today');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    clearToasts(); // tabs share one route, so the route-change clear doesn't fire
  }, [tab]);
  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'today', label: 'Today', icon: <HomeIcon size={24} /> },
    { key: 'workouts', label: 'Workouts', icon: <Dumbbell size={24} /> },
    { key: 'profile', label: 'Profile', icon: <BarChart size={24} /> },
    { key: 'settings', label: 'Settings', icon: <Gear size={24} /> },
  ];
  return (
    <div className="screen">
      <div className="screen-scroll" ref={scrollRef}>
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
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeManager />
      <ReturnToToday />
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
          <Route path="/session/:sessionId" element={<SessionDetailScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster />
    </HashRouter>
  );
}
