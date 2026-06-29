import React, { useState, useEffect } from 'react';
import { Award, Trophy, User, Shield, CheckCircle, Flame, Star, Sparkles, LogIn, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface LeaderboardSectionProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onSelectProfile: (profile: UserProfile) => void;
}

// Badge styling helper
const badgeConfig = {
  'First Report': { icon: Flame, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', desc: 'Logged first neighborhood civic issue.' },
  'Verified Hero': { icon: Shield, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', desc: 'Verified 5+ community issues.' },
  'Problem Solver': { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', desc: 'Had at least 1 reported issue successfully resolved.' },
  'Community Champion': { icon: Star, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', desc: 'Earned over 100 civic activity points.' }
};

export default function LeaderboardSection({ currentUser, onOpenAuth, onSelectProfile }: LeaderboardSectionProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch Leaderboard from Firestore
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          reporterName: localStorage.getItem(`civicmind_name_${docSnap.id}`) || data.email?.split('@')[0] || 'Citizen',
          ...data
        });
      });

      setLeaderboard(list);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [currentUser]);

  // Find active user rank in leaderboard list
  const activeUserRank = currentUser 
    ? leaderboard.findIndex(u => u.id === currentUser.id) + 1 
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full animate-fade-in bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex items-center justify-between transition-colors duration-300">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Civic Leaders & Champion Profiles
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Earning points by reporting issues, confirming hazards, and verifying successful repairs.
          </p>
        </div>

        <button 
          onClick={fetchLeaderboard}
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: ACTIVE USER PROFILE STATUS */}
        <div className="space-y-4">
          <h3 className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            Your Civic Standing
          </h3>

          {currentUser ? (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm relative overflow-hidden transition-colors duration-300">
              {/* Background gradient hint */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full filter blur-xl"></div>
              
              {/* Profile Card Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-base">
                    {localStorage.getItem(`civicmind_name_${currentUser.id}`) || currentUser.email?.split('@')[0]}
                  </h4>
                  <p className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">
                    🛡️ {currentUser.role.toUpperCase()} Member
                  </p>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-850">
                <div className="text-center">
                  <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Points</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-200 mt-0.5">{currentUser.points}</p>
                </div>
                <div className="text-center border-x border-slate-100 dark:border-slate-850">
                  <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Reports</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-200 mt-0.5">{currentUser.reportsCount}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Verified</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-200 mt-0.5">{currentUser.verificationsCount}</p>
                </div>
              </div>

              {/* Badges showcase */}
              <div className="space-y-3">
                <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                  Badges Earned ({currentUser.badges?.length || 0})
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  {currentUser.badges && currentUser.badges.map((badgeName) => {
                    const cfg = badgeConfig[badgeName as keyof typeof badgeConfig];
                    if (!cfg) return null;
                    const IconComp = cfg.icon;
                    return (
                      <div 
                        key={badgeName}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center group relative cursor-help ${cfg.color.replace('text-', 'text-').replace('bg-', 'bg-').replace('border-', 'border-')}`}
                        title={cfg.desc}
                      >
                        <IconComp className="w-5 h-5 group-hover:scale-110 transition duration-300" />
                        <span className="font-sans text-[10px] font-bold text-slate-800 dark:text-slate-200 mt-1.5 truncate w-full">
                          {badgeName}
                        </span>
                      </div>
                    );
                  })}
                  {(!currentUser.badges || currentUser.badges.length === 0) && (
                    <p className="text-lg font-accent text-slate-500 col-span-2 text-center py-4">
                      No badges earned yet. Lodge reports to activate them!
                    </p>
                  )}
                </div>
              </div>

              {activeUserRank > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                  🏆 Leaderboard Ranking: <span className="text-amber-500 dark:text-amber-400 font-bold">#{activeUserRank}</span> in ward
                </div>
              )}

            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4 transition-colors duration-300">
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500 mx-auto">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-200 text-sm">Join the CivicMind Honor Roll</h4>
                <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Earn merit points and unlock community badges by tracking and verifying neighborhood issues.
                </p>
              </div>
              <button
                onClick={onOpenAuth}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Sign In / Sign Up
              </button>
            </div>
          )}

          {/* Points Rules Guide */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 space-y-3 transition-colors duration-300">
            <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase block">
              ⭐ How points work
            </span>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-center justify-between">
                <span>Lodge a new civic report</span>
                <span className="font-mono font-bold text-amber-500">+10 pts</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Verify a neighboring issue</span>
                <span className="font-mono font-bold text-blue-500 dark:text-blue-400">+5 pts</span>
              </li>
              <li className="flex items-center justify-between">
                <span>When your report gets Resolved</span>
                <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">+20 pts</span>
              </li>
            </ul>
          </div>

        </div>

        {/* RIGHT COLUMN: LEADERBOARD TABLE (Takes 2/3 space on Desktop) */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase flex items-center gap-2">
            <Award className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" />
            Top Community Reporters
          </h3>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950/60 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">
                    <th className="px-6 py-3.5 text-center w-16">Rank</th>
                    <th className="px-6 py-3.5">Citizen</th>
                    <th className="px-6 py-3.5 text-center w-24">Reports</th>
                    <th className="px-6 py-3.5 text-center w-24">Verifications</th>
                    <th className="px-6 py-3.5 text-right w-28">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 text-xs text-slate-700 dark:text-slate-300">
                  {leaderboard.map((user, index) => {
                    const isTopThree = index < 3;
                    const rankMedals = ['🥇', '🥈', '🥉'];
                    
                    return (
                      <tr 
                        key={user.id}
                        onClick={() => onSelectProfile(user)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors cursor-pointer ${
                          currentUser && currentUser.id === user.id ? 'bg-blue-50 dark:bg-blue-500/5' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-6 py-4 text-center font-extrabold text-sm">
                          {isTopThree ? (
                            <span className="text-lg">{rankMedals[index]}</span>
                          ) : (
                            <span className="font-mono text-slate-400 dark:text-slate-500">#{index + 1}</span>
                          )}
                        </td>

                        {/* Name & Badges preview */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                              {user.reporterName}
                              {currentUser && currentUser.id === user.id && (
                                <span className="ml-2 font-mono text-[9px] font-bold bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </span>
                            
                            {/* Badges preview row */}
                            <div className="flex items-center gap-1">
                              {user.badges && user.badges.slice(0, 3).map((b: string) => {
                                const cfg = badgeConfig[b as keyof typeof badgeConfig];
                                if (!cfg) return null;
                                return (
                                  <span 
                                    key={b} 
                                    className="font-sans text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold"
                                  >
                                    {b}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </td>

                        {/* Reports Count */}
                        <td className="px-6 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {user.reportsCount || 0}
                        </td>

                        {/* Verifications Count */}
                        <td className="px-6 py-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {user.verificationsCount || 0}
                        </td>

                        {/* Points Score */}
                        <td className="px-6 py-4 text-right font-extrabold text-amber-500 dark:text-amber-400 text-sm">
                          {user.points || 0} <span className="font-mono text-[10px] text-slate-500 font-semibold">pts</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {leaderboard.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-2xl font-accent">
                No active leaderboard scores found. Be the first to lodge a report!
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
