import React from 'react';
import { UserProfile, CivicIssue } from '../types';
import { User, Shield, AlertTriangle, Activity, LogOut, ChevronRight, Award, Mail } from 'lucide-react';

interface ProfileSectionProps {
  userProfile: UserProfile;
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export default function ProfileSection({ userProfile, issues, onSelectIssue, currentUser, onLogout }: ProfileSectionProps) {
  const isSelf = currentUser && currentUser.id === userProfile.id;
  const isAuthority = userProfile.role === 'authority' || userProfile.role === 'admin';

  // Get display name (fallback to local storage or email prefix)
  // For users clicked from leaderboard, they might have a reporterName attached dynamically
  const displayName = (userProfile as any).reporterName 
    || localStorage.getItem(`civicmind_name_${userProfile.id}`) 
    || userProfile.email?.split('@')[0] 
    || 'Citizen';

  // Issues reported by this user
  const userIssues = issues.filter(issue => 
    issue.reporterId === userProfile.id || 
    (userProfile.email && issue.reporterName.toLowerCase() === userProfile.email.toLowerCase())
  );
  
  // For authorities: issues assigned to their department (simulated based on role/mock mapping)
  // Let's assume authorities see issues in the "Municipal Corporation General" or we just show all if no specific mapping
  const assignedIssues = issues.filter(issue => issue.department);

  const reportsSubmitted = userIssues.length;
  const reportsResolved = userIssues.filter(i => i.status === 'Resolved').length;
  const reportsPending = userIssues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed').length;

  const authorityAssigned = assignedIssues.length;
  const authorityResolved = assignedIssues.filter(i => i.status === 'Resolved').length;
  const authorityPerformance = authorityAssigned > 0 ? Math.round((authorityResolved / authorityAssigned) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 animate-fade-in transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-sm transition-colors duration-300">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-600/20 dark:to-purple-600/10 transition-colors duration-300"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm overflow-hidden transition-colors duration-300">
              {/* Profile Picture */}
              {isAuthority ? (
                <Shield className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <User className="w-10 h-10 text-blue-500 dark:text-blue-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="font-display text-3xl font-black text-slate-900 dark:text-white tracking-tight">{displayName}</h1>
                <span className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold w-fit ${
                  isAuthority ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                }`}>
                  {isAuthority ? 'Government Officer' : 'Verified Citizen'}
                </span>
              </div>
              
              {userProfile.email && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                  <Mail className="w-4 h-4" />
                  {userProfile.email}
                </div>
              )}
              
              {!isAuthority && (
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {userProfile.badges?.map((badge, idx) => (
                    <span key={idx} className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-[9px] font-bold text-amber-600 dark:text-amber-400 px-2 py-1 rounded-md flex items-center gap-1 transition-colors duration-300">
                      <Award className="w-3 h-3" />
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {isSelf && (
              <button 
                onClick={onLogout}
                className="mt-4 md:mt-0 px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition flex items-center gap-2 text-sm font-bold"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {!isAuthority ? (
          /* CITIZEN PROFILE STATS */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reports Submitted</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-slate-900 dark:text-white leading-none">{reportsSubmitted}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pending Reports</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-amber-500 leading-none">{reportsPending}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resolved Reports</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-emerald-500 dark:text-emerald-400 leading-none">{reportsResolved}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Contribution Score</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-amber-500 dark:text-amber-400 leading-none">{userProfile.points}</span>
                <span className="font-mono text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">pts</span>
              </div>
            </div>
          </div>
        ) : (
          /* GOVERNMENT PROFILE STATS */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Department</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-sm font-bold text-slate-900 dark:text-white leading-tight">Civic Maintenance<br/>(General)</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Assigned Reports</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-blue-500 dark:text-blue-400 leading-none">{authorityAssigned}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resolved Reports</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-emerald-500 dark:text-emerald-400 leading-none">{authorityResolved}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors duration-300 shadow-sm">
              <p className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Performance</p>
              <div className="flex items-end gap-2">
                <span className="font-sans text-3xl font-black text-purple-500 dark:text-purple-400 leading-none">{authorityPerformance}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 transition-colors duration-300 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              {isAuthority ? 'Assigned Reports' : 'Submitted Reports'}
            </h2>
          </div>

          <div className="space-y-4">
            {(!isAuthority ? userIssues : assignedIssues).length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-slate-500 text-xl font-accent">No reports to show. Time to explore your neighborhood!</p>
              </div>
            ) : (
              (!isAuthority ? userIssues : assignedIssues).map(issue => (
                <div 
                  key={issue.id} 
                  onClick={() => onSelectIssue(issue)}
                  className="group flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 transition cursor-pointer shadow-sm dark:shadow-none"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 relative">
                    {issue.imageUrl && (issue.imageUrl.startsWith('data:') || issue.imageUrl.startsWith('http')) ? (
                      <img src={issue.imageUrl} alt="Issue" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider ${
                        issue.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/50' : 
                        issue.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/50' :
                        'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/50'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {issue.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 line-clamp-1 font-sans">{issue.description}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mt-1 font-sans">{issue.address}</p>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition hidden md:block shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

