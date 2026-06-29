import React from 'react';
import { UserProfile, CivicIssue } from '../types';
import { User, Shield, AlertTriangle, CheckCircle, Clock, Award, Activity, LogOut, ChevronRight } from 'lucide-react';

interface ProfileSectionProps {
  userProfile: UserProfile;
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export default function ProfileSection({ userProfile, issues, onSelectIssue, currentUser, onLogout }: ProfileSectionProps) {
  const isSelf = currentUser && currentUser.id === userProfile.id;
  const isAuthority = userProfile.role === 'authority';

  const userIssues = issues.filter(issue => issue.reporterName.toLowerCase() === (userProfile.email || '').toLowerCase() || (userProfile.email && issue.verifiedBy.includes(userProfile.email)));
  const assignedIssues = issues.filter(issue => issue.department && isAuthority); // Simplified assignment logic

  const reportsSubmitted = userIssues.length;
  const reportsResolved = userIssues.filter(i => i.status === 'Resolved').length;
  const reportsPending = userIssues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed').length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600/20 to-purple-600/10"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-lg">
              {isAuthority ? <Shield className="w-10 h-10 text-emerald-400" /> : <User className="w-10 h-10 text-blue-400" />}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="text-3xl font-black text-white tracking-tight">{userProfile.email || 'Citizen'}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
                  isAuthority ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' : 'bg-blue-900/50 text-blue-400 border border-blue-800'
                }`}>
                  {isAuthority ? 'Government Officer' : 'Verified Citizen'}
                </span>
              </div>
              <p className="text-slate-400 font-medium">Joined recently</p>
              
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {userProfile.badges.map((badge, idx) => (
                  <span key={idx} className="bg-slate-800/80 border border-slate-700 text-[10px] font-bold text-amber-400 px-2 py-1 rounded-md flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {isSelf && (
              <button 
                onClick={onLogout}
                className="mt-4 md:mt-0 px-4 py-2 bg-red-950/40 text-red-400 border border-red-900 rounded-xl hover:bg-red-900/50 transition flex items-center gap-2 text-sm font-bold"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contribution Score</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-amber-400 leading-none">{userProfile.points}</span>
              <span className="text-sm font-medium text-slate-400 mb-1">pts</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Reports</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white leading-none">{reportsSubmitted}</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resolved</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-emerald-400 leading-none">{reportsResolved}</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pending</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-amber-500 leading-none">{reportsPending}</span>
            </div>
          </div>
        </div>

        {/* Reports Timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Recent Activity
            </h2>
          </div>

          <div className="space-y-4">
            {userIssues.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-slate-500 font-medium">No reports submitted yet.</p>
              </div>
            ) : (
              userIssues.map(issue => (
                <div 
                  key={issue.id} 
                  onClick={() => onSelectIssue(issue)}
                  className="group flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                    {issue.imageUrl && issue.imageUrl.startsWith('data:') ? (
                      <img src={issue.imageUrl} alt="Issue" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-slate-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        issue.status === 'Resolved' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50' : 'bg-amber-950/50 text-amber-400 border border-amber-800/50'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 line-clamp-1">{issue.description}</h3>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-1">{issue.address}</p>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition hidden md:block shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
