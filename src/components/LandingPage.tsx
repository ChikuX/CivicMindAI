import React from 'react';
import { Map as MapIcon, BarChart2, ArrowRight, Activity, Users, CheckCircle, ChevronRight } from 'lucide-react';
import { CivicIssue, UserProfile } from '../types';
import Logo from './Logo';

interface LandingPageProps {
  onLoginClick: () => void;
  onGetStartedClick: () => void;
  issues: CivicIssue[];
  currentUser: UserProfile | null;
}

export default function LandingPage({ onLoginClick, onGetStartedClick, issues, currentUser }: LandingPageProps) {
  const totalReports = issues.length;
  const resolvedReports = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
  const activeCitizens = new Set(issues.map(i => i.reporterId)).size;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shadow-sm">
              <Logo className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
            <span className="font-display font-bold tracking-tight text-slate-900 dark:text-white text-lg">CivicMind AI</span>
          </div>
          <div className="flex items-center gap-4">
            {!currentUser && (
              <button 
                onClick={onLoginClick}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                Login
              </button>
            )}
            <button 
              onClick={onGetStartedClick}
              className="text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 px-5 py-2 rounded-full transition shadow-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 lg:pt-40 lg:pb-28">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <h1 className="font-display text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            Fixing cities, <br className="hidden md:block" />
            faster together.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            CivicMind AI empowers citizens to report urban defects and helps authorities prioritize infrastructure repairs through community verification and intelligent routing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={onGetStartedClick}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-medium rounded-full transition flex items-center justify-center gap-2 shadow-sm"
            >
              Start Reporting <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Live Statistics */}
      <section className="py-16 border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <h3 className="font-sans font-semibold text-4xl text-slate-900 dark:text-white">{totalReports}</h3>
              <p className="font-mono text-xs font-medium tracking-wider text-slate-500 uppercase">Total Reports</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-sans font-semibold text-4xl text-slate-900 dark:text-white">{resolvedReports}</h3>
              <p className="font-mono text-xs font-medium tracking-wider text-slate-500 uppercase">Issues Resolved</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-sans font-semibold text-4xl text-slate-900 dark:text-white">{activeCitizens}</h3>
              <p className="font-mono text-xs font-medium tracking-wider text-slate-500 uppercase">Active Citizens</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white tracking-tight">How It Works</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">From a pothole in your street to a resolved ticket in the municipal database, in three simple steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm space-y-4 transition-colors duration-300">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <MapIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">1. Pin & Report</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                Spot a problem? Snap a photo and pin it on the interactive civic map. Our AI automatically categorizes the issue.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm space-y-4 transition-colors duration-300">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">2. Community Verify</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                Other citizens can verify your report, boosting its priority score and ensuring authorities focus on what matters most.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm space-y-4 transition-colors duration-300">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">3. Track Resolution</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                Follow the progress in real-time as municipal officers get assigned, work on the issue, and post the final resolution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-24 px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Bridging the gap between citizens and the city.
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Traditional municipal reporting is slow, opaque, and frustrating. Reports get lost in bureaucracy, and citizens are left in the dark.
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              CivicMind AI brings transparency and speed to urban maintenance. By combining crowdsourced data with intelligent routing, we ensure that every report reaches the right department instantly.
            </p>
            <ul className="space-y-3 pt-4">
              {[
                'Real-time geolocation mapping',
                'AI-powered issue categorization',
                'Transparent activity logs & updates',
                'Gamified citizen engagement'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl transition-colors duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <span className="font-mono text-xs font-medium text-slate-500 uppercase tracking-wider">Live Activity</span>
                  <Activity className="w-4 h-4 text-slate-400" />
                </div>
                {issues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0">
                      <span className="text-xs">📍</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{issue.category}</p>
                      <p className="font-mono text-[10px] text-slate-500 truncate">{issue.address}</p>
                    </div>
                    <div className="shrink-0">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        issue.status === 'Resolved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50' : 
                        issue.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50'
                      }`}>
                        {issue.status}
                      </span>
                    </div>
                  </div>
                ))}
                {issues.length === 0 && (
                  <div className="py-8 text-center text-xl font-accent text-slate-500">
                    No recent activity. Let's make our city better!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <p className="text-slate-500 text-sm font-medium">
          © {new Date().getFullYear()} CivicMind AI. Building smarter cities together.
        </p>
      </footer>
    </div>
  );
}
