import React, { useState } from 'react';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { X, Mail, Lock, User, Shield, AlertCircle, Loader } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: UserProfile) => void;
  hideClose?: boolean;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, hideClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [role, setRole] = useState<'citizen' | 'authority' | 'admin'>('citizen');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Handle credentials auth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Fetch user profile from Firestore
        const profileRef = doc(db, 'users', uid);
        let profileSnap;
        try {
          profileSnap = await getDoc(profileRef);
        } catch (getErr) {
          handleFirestoreError(getErr, OperationType.GET, `users/${uid}`);
        }

        let profile: UserProfile;
        if (profileSnap.exists()) {
          profile = profileSnap.data() as UserProfile;
        } else {
          // Fallback if auth exists but no firestore document
          profile = {
            id: uid,
            email: email,
            points: 10,
            badges: ['First Report'],
            reportsCount: 0,
            verificationsCount: 0,
            role: email.includes('admin') ? 'admin' : email.includes('officer') ? 'authority' : 'citizen',
          };
          try {
            await setDoc(profileRef, profile);
          } catch (setErr) {
            handleFirestoreError(setErr, OperationType.CREATE, `users/${uid}`);
          }
        }

        onAuthSuccess(profile);
        onClose();
      } else {
        // Register
        if (!reporterName.trim()) {
          throw new Error('Name is required for registration.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const newProfile: UserProfile = {
          id: uid,
          email: email,
          points: 10,
          badges: ['First Report'],
          reportsCount: 0,
          verificationsCount: 0,
          role: role,
        };

        // Save profile to Firestore
        try {
          await setDoc(doc(db, 'users', uid), newProfile);
        } catch (setErr) {
          handleFirestoreError(setErr, OperationType.CREATE, `users/${uid}`);
        }
        
        // Also save user metadata to a global name mapping if needed
        try {
          await setDoc(doc(db, 'usernames', reporterName.toLowerCase()), {
            uid,
            name: reporterName
          });
        } catch (setErr) {
          handleFirestoreError(setErr, OperationType.CREATE, `usernames/${reporterName.toLowerCase()}`);
        }

        // Store active session username locally
        localStorage.setItem(`civicmind_name_${uid}`, reporterName);

        onAuthSuccess(newProfile);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errMsg = err.message || 'Authentication failed';
      if (typeof errMsg === 'string' && errMsg.startsWith('{') && errMsg.endsWith('}')) {
        try {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.error || 'Authentication failed';
        } catch (e) {}
      }
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password should be at least 6 characters.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Preset quick accounts for demo testing
  const handleQuickLogin = async (presetRole: 'citizen' | 'authority' | 'admin') => {
    setLoading(true);
    setError('');

    const config = {
      citizen: { email: 'citizen@civicmind.ai', pass: 'citizen123', name: 'Citizen Demo' },
      authority: { email: 'officer@civicmind.ai', pass: 'officer123', name: 'Authority Demo' },
      admin: { email: 'admin@civicmind.ai', pass: 'admin123', name: 'Admin Demo' }
    };

    const target = config[presetRole];

    try {
      // Attempt login
      let uid = '';
      try {
        const userCred = await signInWithEmailAndPassword(auth, target.email, target.pass);
        uid = userCred.user.uid;
      } catch (e: any) {
        // If demo user doesn't exist, register them!
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          const userCred = await createUserWithEmailAndPassword(auth, target.email, target.pass);
          uid = userCred.user.uid;
        } else {
          throw e;
        }
      }

      // Ensure profile document exists in Firestore
      const profileRef = doc(db, 'users', uid);
      let profileSnap;
      try {
        profileSnap = await getDoc(profileRef);
      } catch (getErr) {
        handleFirestoreError(getErr, OperationType.GET, `users/${uid}`);
      }

      let profile: UserProfile;
      if (profileSnap.exists()) {
        profile = profileSnap.data() as UserProfile;
        // Make sure roles match
        if (profile.role !== presetRole) {
          profile.role = presetRole;
          try {
            await setDoc(profileRef, profile, { merge: true });
          } catch (setErr) {
            handleFirestoreError(setErr, OperationType.UPDATE, `users/${uid}`);
          }
        }
      } else {
        profile = {
          id: uid,
          email: target.email,
          points: presetRole === 'citizen' ? 120 : 0,
          badges: presetRole === 'citizen' ? ['First Report', 'Verified Hero', 'Community Champion'] : [],
          reportsCount: presetRole === 'citizen' ? 4 : 0,
          verificationsCount: presetRole === 'citizen' ? 14 : 0,
          role: presetRole,
        };
        try {
          await setDoc(profileRef, profile);
        } catch (setErr) {
          handleFirestoreError(setErr, OperationType.CREATE, `users/${uid}`);
        }
      }

      localStorage.setItem(`civicmind_name_${uid}`, target.name);
      onAuthSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error('Quick login error:', err);
      let errMsg = err.message || 'unknown error';
      if (typeof errMsg === 'string' && errMsg.startsWith('{') && errMsg.endsWith('}')) {
        try {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.error || 'unknown error';
        } catch (e) {}
      }
      setError('Quick login failed: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              {isLogin ? 'Sign In to CivicMind' : 'Create CivicMind Account'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLogin ? 'Welcome back! Connect with your community.' : 'Join the neighborhood and earn verification points.'}
            </p>
          </div>
          {!hideClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div id="auth-error-alert" className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm transition-all duration-200 shadow-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Preset Quick Logins (VERY USEFUL) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-3 text-center">
              ⚡ Demo Testing Roles (One-Click)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('citizen')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-blue-950/40 hover:border-blue-500/30 border border-slate-800 transition group text-center"
              >
                <User className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
                <span className="text-[11px] font-medium text-slate-200 mt-1">Citizen</span>
                <span className="text-[9px] text-slate-500 font-mono">citizen@...</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('authority')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-amber-950/40 hover:border-amber-500/30 border border-slate-800 transition group text-center"
              >
                <Shield className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                <span className="text-[11px] font-medium text-slate-200 mt-1">Authority</span>
                <span className="text-[9px] text-slate-500 font-mono">officer@...</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-emerald-950/40 hover:border-emerald-500/30 border border-slate-800 transition group text-center"
              >
                <Shield className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                <span className="text-[11px] font-medium text-slate-200 mt-1">Admin</span>
                <span className="text-[9px] text-slate-500 font-mono">admin@...</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative px-3 bg-slate-900 text-xs text-slate-500 uppercase">
              Or use credentials
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="E.g. Rohan Mehta"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-100 text-sm outline-none transition"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-100 text-sm outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-100 text-sm outline-none transition"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans">Role Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('citizen')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      role === 'citizen'
                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Citizen Reporter
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('authority')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      role === 'authority'
                        ? 'bg-amber-600/10 border-amber-500 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Govt. Officer
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/15 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer Toggle */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 text-center text-xs text-slate-400">
          {isLogin ? (
            <p>
              New to CivicMind AI?{' '}
              <button 
                onClick={() => setIsLogin(false)}
                className="font-semibold text-blue-400 hover:text-blue-300 underline"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                onClick={() => setIsLogin(true)}
                className="font-semibold text-blue-400 hover:text-blue-300 underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
