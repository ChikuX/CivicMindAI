import React, { useState } from 'react';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { X, Mail, Lock, User, AlertCircle, Loader } from 'lucide-react';
import Logo from './Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: UserProfile) => void;
  hideClose?: boolean;
  initialMode?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, hideClose, initialMode = 'login' }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
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
            points: 0,
            badges: [],
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
          points: 0,
          badges: [],
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

  return (
    <div id="auth-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Logo className="w-5 h-5 text-blue-600 dark:text-blue-500" />
              {isLogin ? 'Sign In to CivicMind' : 'Create CivicMind Account'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isLogin ? 'Welcome back! Connect with your community.' : 'Join the neighborhood and earn verification points.'}
            </p>
          </div>
          {!hideClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div id="auth-error-alert" className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm transition-all duration-200 shadow-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="E.g. Rohan Mehta"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-900 dark:text-slate-100 text-sm outline-none transition"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-900 dark:text-slate-100 text-sm outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-slate-900 dark:text-slate-100 text-sm outline-none transition"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">Role Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('citizen')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      role === 'citizen'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-600/10 dark:border-blue-500 dark:text-blue-400'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                    }`}
                  >
                    Citizen Reporter
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('authority')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      role === 'authority'
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-600/10 dark:border-amber-500 dark:text-amber-400'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
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
              className="w-full py-2.5 mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center text-xs text-slate-600 dark:text-slate-400 transition-colors duration-300">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button 
                onClick={() => setIsLogin(false)}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                onClick={() => setIsLogin(true)}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
              >
                Login
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
