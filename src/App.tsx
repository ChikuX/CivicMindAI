import React, { useState, useEffect } from 'react';
import { 
  Map as MapIcon, BarChart2, Trophy, Sparkles, User, LogOut, LogIn,
  Sun, Moon, Shield, Settings, Loader, Plus
} from 'lucide-react';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, getDocs, addDoc, deleteDoc, clearIndexedDbPersistence } from 'firebase/firestore';
import { CivicIssue, UserProfile } from './types';
import { cleanupDemoData } from './cleanup';

// Component imports
import MapSection from './components/MapSection';
import DashboardSection from './components/DashboardSection';
import LeaderboardSection from './components/LeaderboardSection';
import InsightsSection from './components/InsightsSection';
import ProfileSection from './components/ProfileSection';
import AuthModal from './components/AuthModal';
import ReportDrawer from './components/ReportDrawer';
import IssueDetailDrawer from './components/IssueDetailDrawer';

// Grid location coordinate rounding helper
const getNeighborhoodName = (lat: number, lng: number): string => {
  const points = [
    { name: 'Koramangala 4th Block (Ward 151)', lat: 12.93, lng: 77.62 },
    { name: 'Indiranagar 100 Feet Rd (Ward 80)', lat: 12.97, lng: 77.64 },
    { name: 'MG Road Metro Zone (Ward 81)', lat: 12.97, lng: 77.60 },
    { name: 'Richmond Town West (Ward 111)', lat: 12.96, lng: 77.60 },
    { name: 'Lalbagh Botanical Zone (Ward 143)', lat: 12.95, lng: 77.58 },
    { name: 'Cubbon Park Greens (Ward 79)', lat: 12.97, lng: 77.59 },
    { name: 'Malleshwaram Center (Ward 65)', lat: 13.00, lng: 77.57 },
    { name: 'Jayanagar 4th Block (Ward 170)', lat: 12.92, lng: 77.58 }
  ];

  let closest = points[0];
  let minDist = Infinity;
  for (const p of points) {
    const dist = Math.sqrt(Math.pow(p.lat - lat, 2) + Math.pow(p.lng - lng, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }
  return closest.name;
};

export default function App() {
  // Global States
  const [currentTab, setCurrentTab] = useState<'map' | 'dashboard' | 'leaderboard' | 'insights'>('map');
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Layout Panel States
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  // Configuration States
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // Default dark dashboard
  const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946]); // Bangalore Default

  // Geolocate user on mount to center the map correctly
  useEffect(() => {
    cleanupDemoData();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn('Startup geolocation failed:', error);
        }
      );
    }
  }, []);

  // 1. Subscribe to Firestore Issues in real-time
  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: CivicIssue[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CivicIssue);
      });

      setIssues(list);
      setLoadingIssues(false);
    }, (error) => {
      console.error('Firestore Issues real-time subscription error:', error);
      // Start clean with an empty array if loading fails
      setIssues([]);
      setLoadingIssues(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Auth State Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoadingAuth(true);
      if (authUser) {
        // Automatically redirect to dashboard on valid session load
        setCurrentTab('dashboard');

        // Fetch matching UserProfile document from Firestore
        const userDocRef = doc(db, 'users', authUser.uid);
        
        // Listen to User Profile changes in real-time to update points/badges instantly
        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser(docSnap.data() as UserProfile);
          } else {
            // Default profile based on email domain/keyword if logged in but document hasn't been written
            const email = authUser.email || '';
            const fallbackRole = email.includes('admin') ? 'admin' : email.includes('officer') ? 'authority' : 'citizen';
            setCurrentUser({
              id: authUser.uid,
              email: email,
              points: 10,
              badges: ['First Report'],
              reportsCount: 0,
              verificationsCount: 0,
              role: fallbackRole
            });
          }
          setLoadingAuth(false);
        }, (error) => {
          console.error("User profile load error:", error);
          const email = authUser.email || '';
          const fallbackRole = email.includes('admin') ? 'admin' : email.includes('officer') ? 'authority' : 'citizen';
          setCurrentUser({
            id: authUser.uid,
            email: email,
            points: 10,
            badges: ['First Report'],
            reportsCount: 0,
            verificationsCount: 0,
            role: fallbackRole
          });
          setLoadingAuth(false);
        });

        return () => unsubProfile();
      } else {
        setCurrentUser(null);
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Log Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Let onAuthStateChanged handle setting currentUser to null to prevent race conditions
      setIssues([]); 
      setCurrentTab('dashboard');
    } catch (err) {
      console.error('Signout failed:', err);
    }
  };

  // User auth success callback
  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
  };

  // Select an issue to display details (opens side panel / bottom sheet)
  const handleSelectIssue = (issue: CivicIssue) => {
    setSelectedIssue(issue);
    setIsReporting(false);
    // Center map on issue coordinates
    setMapCenter([issue.lat, issue.lng]);
    setCurrentTab('map');
  };

  // Trigger new report drawer opening
  const handleOpenReport = () => {
    setIsReporting(true);
    setSelectedIssue(null);
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-400">Loading CivicMind session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <AuthModal
          isOpen={true}
          onClose={() => {}} // Cannot close
          onAuthSuccess={(profile) => {
            setCurrentUser(profile);
            setCurrentTab('dashboard');
          }}
          hideClose={true}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col md:flex-row h-screen w-screen overflow-hidden ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'
    } font-sans`}>
      
      {/* 1. SIDEBAR (Collapsible, responsive, hidden on Mobile) */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r transition-all duration-300 ${
        darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      } ${
        // Collapsed (68px) on tablet, full (280px) on desktop
        'w-[72px] lg:w-[260px]'
      }`}>
        
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5.5 h-5.5 text-white" />
          </div>
          <div className="hidden lg:block truncate leading-none">
            <h1 className="font-extrabold text-slate-100 text-base tracking-tight">CivicMind AI</h1>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">
              fixed faster.
            </span>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1.5 flex flex-col justify-start">
          {[
            { id: 'map', label: 'Civic Map', icon: MapIcon },
            { id: 'dashboard', label: 'Impact Desk', icon: BarChart2 },
            { id: 'leaderboard', label: 'Leaders', icon: Trophy },
            { id: 'insights', label: 'AI Insights', icon: Sparkles },
            { id: 'profile', label: 'Profile', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id as any);
                  setSelectedIssue(null);
                  setIsReporting(false);
                  if (tab.id === 'profile') {
                    setSelectedProfile(null); // Show my own profile
                  }
                }}
                className={`w-full py-3 px-3 rounded-xl font-bold text-xs tracking-wide flex items-center gap-3.5 transition group relative ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15' 
                    : darkMode 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'scale-105' : 'group-hover:scale-105 transition duration-350'}`} />
                <span className="hidden lg:inline">{tab.label}</span>

                {/* Tooltip on collapsed mode (tablet) */}
                <div className="lg:hidden absolute left-20 bg-slate-950 text-slate-200 border border-slate-850 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition whitespace-nowrap z-50">
                  {tab.label}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Configurations & Session profile */}
        <div className="p-3 border-t border-slate-800/40 space-y-2">
          
          {/* Dark Mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full py-2 px-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 flex items-center gap-3.5 text-xs font-bold transition group"
          >
            {darkMode ? (
              <>
                <Sun className="w-5 h-5 text-amber-500" />
                <span className="hidden lg:inline">Light Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-slate-400" />
                <span className="hidden lg:inline">Dark Theme</span>
              </>
            )}
          </button>

          {/* User Auth Footer */}
          {currentUser ? (
            <div className="pt-2 border-t border-slate-800/20">
              <div className="flex items-center gap-2.5 p-1 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="hidden lg:block truncate leading-tight">
                  <p className="font-bold text-xs text-slate-200 truncate">
                    {localStorage.getItem(`civicmind_name_${currentUser.id}`) || currentUser.email?.split('@')[0]}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                    ⭐ {currentUser.points} pts
                  </p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full py-1.5 px-3 mt-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 transition"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden lg:inline">Sign In</span>
            </button>
          )}

        </div>

      </aside>

      {/* 2. MOBILE TOP HEADER BRAND (Only visible on Mobile) */}
      <header className="md:hidden shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-5 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-black text-slate-100 text-sm tracking-tight">CivicMind AI</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Small auth login icon */}
          {currentUser ? (
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-850 text-slate-400 hover:text-rose-400"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="p-1.5 rounded-lg bg-blue-600 text-white shadow-lg flex items-center justify-center"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 3. MAIN WORKSPACE */}
      <main className="flex-1 min-h-0 flex flex-col relative z-0 pb-[72px] md:pb-0">
        
        {loadingIssues ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold tracking-wide font-sans">Connecting to live municipal grid...</p>
          </div>
        ) : (
          <>
            {/* TAB PANELS */}
            {currentTab === 'map' && (
              <div className="flex-1 w-full h-full relative">
                <MapSection
                  issues={issues}
                  onSelectIssue={handleSelectIssue}
                  heatmapEnabled={heatmapEnabled}
                  mapCenter={mapCenter}
                  onReportClick={handleOpenReport}
                />
                
                {/* BIG FLOATING "REPORT ISSUE" BUTTON (Sits on top-right of map on Desktop, above bottom nav on mobile) */}
                <button
                  onClick={handleOpenReport}
                  className="absolute bottom-6 right-6 z-10 pl-4 pr-5 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-full shadow-2xl flex items-center gap-2 transition duration-300 hover:scale-105 active:scale-95 group focus:outline-none"
                  style={{ boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.45), 0 0 15px 1px rgba(168, 85, 247, 0.25)' }}
                >
                  <Plus className="w-5 h-5 shrink-0 group-hover:rotate-90 transition-transform duration-300" />
                  Report Issue
                </button>
              </div>
            )}

            {currentTab === 'dashboard' && (
              <DashboardSection
                issues={issues}
                heatmapEnabled={heatmapEnabled}
                onToggleHeatmap={() => setHeatmapEnabled(!heatmapEnabled)}
                onSelectIssue={handleSelectIssue}
              />
            )}

            {currentTab === 'leaderboard' && (
              <LeaderboardSection
                currentUser={currentUser}
                onOpenAuth={() => {}}
                onSelectProfile={(profile) => {
                  setSelectedProfile(profile);
                  setCurrentTab('profile');
                }}
              />
            )}

            {currentTab === 'insights' && (
              <InsightsSection
                issues={issues}
              />
            )}

            {currentTab === 'profile' && (selectedProfile || currentUser) && (
              <ProfileSection
                userProfile={selectedProfile || currentUser!}
                currentUser={currentUser}
                issues={issues}
                onSelectIssue={handleSelectIssue}
                onLogout={handleSignOut}
              />
            )}
          </>
        )}

      </main>

      {/* 4. MOBILE BOTTOM NAVBAR (Only visible on Mobile screens) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2.5 px-6 flex items-center justify-between z-30 shadow-2xl overflow-x-auto gap-4">
        {[
          { id: 'map', label: 'Map', icon: MapIcon },
          { id: 'dashboard', label: 'Stats', icon: BarChart2 },
          { id: 'leaderboard', label: 'Leaders', icon: Trophy },
          { id: 'insights', label: 'AI', icon: Sparkles },
          { id: 'profile', label: 'Profile', icon: User }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentTab(tab.id as any);
                setSelectedIssue(null);
                setIsReporting(false);
                if (tab.id === 'profile') {
                  setSelectedProfile(null);
                }
              }}
              className={`flex flex-col items-center gap-1 transition ${
                isActive ? 'text-blue-500 scale-105' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold tracking-wider uppercase">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 5. OVERLAYS, DRAWERS & MODALS */}

      {/* Backdrop overlay for drawers */}
      {(isReporting || selectedIssue) && (
        <div 
          onClick={() => {
            setIsReporting(false);
            setSelectedIssue(null);
          }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 md:hidden"
        ></div>
      )}

      {/* Report Issue Drawer */}
      <ReportDrawer
        isOpen={isReporting}
        onClose={() => setIsReporting(false)}
        currentUser={currentUser}
        onReportSubmitted={(newIssue) => {
          // Centering map on the coordinates of the newly added issue
          setMapCenter([newIssue.lat, newIssue.lng]);
        }}
        mapCenter={mapCenter}
      />

      {/* Issue Detail View Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue}
        isOpen={selectedIssue !== null}
        onClose={() => setSelectedIssue(null)}
        currentUser={currentUser}
        onIssueUpdated={(updated) => {
          setSelectedIssue(updated);
          // Auto-reupdate in-memory list
          setIssues(issues.map(i => i.id === updated.id ? updated : i));
        }}
        onIssueDeleted={(deletedId) => {
          setIssues(issues.filter(i => i.id !== deletedId));
          setSelectedIssue(null);
        }}
      />

    </div>
  );
}
