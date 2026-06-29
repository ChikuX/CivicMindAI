import React, { useState, useEffect } from 'react';
import { 
  X, MapPin, Calendar, Shield, CheckCircle, Clock, Award, 
  FileText, Copy, Trash2, Camera, Upload, AlertCircle, Loader, 
  ArrowRight, Heart, Share2, Sparkles, RefreshCw
} from 'lucide-react';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, OperationType, handleFirestoreError, storage } from '../firebase';
import { doc, updateDoc, increment, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';
import { CivicIssue, UserProfile } from '../types';
import { generateComplaintLetter, analyzeImage } from '../services/gemini';

interface IssueDetailDrawerProps {
  issue: CivicIssue | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onIssueUpdated: (updatedIssue: CivicIssue) => void;
  onIssueDeleted: (issueId: string) => void;
}

// Convert absolute timestamp to a friendly human relative string
const getRelativeTime = (timestamp: string | number): string => {
  const diff = Date.now() - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Downscale image helper to prevent Firestore doc size issues
const resizeImage = (file: File, maxWidth = 500, maxHeight = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Category mapping helper
const categoryEmojiMap = {
  pothole: '🕳️',
  'water leak': '💧',
  'broken streetlight': '💡',
  garbage: '🗑️',
  'damaged road': '🛣️',
  'open drain': '🚯',
  other: '🔧'
};

const severityLabelMap = {
  low: '🟢 Low Priority',
  medium: '🟡 Medium',
  high: '🟠 High Priority',
  critical: '🔴 Critical Hazard'
};

const severityBorderColors = {
  low: 'border-l-emerald-500',
  medium: 'border-l-amber-500',
  high: 'border-l-orange-500',
  critical: 'border-l-rose-500'
};

export default function IssueDetailDrawer({
  issue,
  isOpen,
  onClose,
  currentUser,
  onIssueUpdated,
  onIssueDeleted
}: IssueDetailDrawerProps) {
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedImage, setVerifiedImage] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'matching' | 'matched' | 'mismatched'>('idle');
  
  // Status transition states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusInput, setStatusInput] = useState<CivicIssue['status']>('Reported');
  
  // Complaint Letter states
  const [letterDraft, setLetterDraft] = useState('');
  const [loadingLetter, setLoadingLetter] = useState(false);

  // After photo upload state
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [afterPhotoLoading, setAfterPhotoLoading] = useState(false);
  const [resolutionNotesInput, setResolutionNotesInput] = useState('');
  const [error, setError] = useState('');

  // Reset internal states on open
  useEffect(() => {
    if (issue) {
      setStatusInput(issue.status);
      setLetterDraft('');
      setCopySuccess(false);
      setVerifiedImage(null);
      setVerificationFeedback('');
      setVerificationStatus('idle');
      setAfterPhoto(null);
      setResolutionNotesInput(issue.resolutionNotes || '');
      setError('');
    }
  }, [issue, isOpen]);

  const parseError = (err: any): string => {
    let msg = err?.message || String(err || 'unknown error');
    if (typeof msg === 'string' && msg.startsWith('{') && msg.endsWith('}')) {
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.error || msg;
      } catch (e) {}
    }
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return 'Permission Denied: Your account does not have authorization to perform this action. Officers or Admins can change status or delete reports, while community members can verify.';
    }
    return msg;
  };

  if (!isOpen || !issue) return null;

  // 1. Handle Community Verification
  const handleVerify = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (issue.verifiedBy.includes(currentUser.id)) return;

    setVerifying(true);
    try {
      const issueRef = doc(db, 'issues', issue.id!);
      const currentVerCount = issue.verificationCount + 1;
      const userName = localStorage.getItem(`civicmind_name_${currentUser.id}`) || currentUser.email?.split('@')[0] || 'Citizen';
      
      let finalStatus = issue.status;
      let finalSeverity = issue.severity;
      
      const newActivity = {
        action: `Community verification: Confirmed by ${userName}`,
        timestamp: Date.now(),
        by: userName
      };

      const updates: any = {
        verificationCount: increment(1),
        verifiedBy: arrayUnion(currentUser.id),
        activityLog: arrayUnion(newActivity),
        updatedAt: Date.now()
      };

      // Auto-bump priority / verification badges
      if (currentVerCount >= 3) {
        updates.status = 'Verified';
        finalStatus = 'Verified';
        // Auto-bump severity to High if it is low/medium
        if (issue.severity === 'low' || issue.severity === 'medium') {
          updates.severity = 'high';
          finalSeverity = 'high';
          updates.activityLog = arrayUnion(newActivity, {
            action: `Auto-promoted to HIGH priority based on community consensus (3+ verifications)`,
            timestamp: Date.now(),
            by: 'CivicMind AI Engine'
          });
        } else {
          updates.activityLog = arrayUnion(newActivity, {
            action: `Issue verified by community consensus (3+ verifications)`,
            timestamp: Date.now(),
            by: 'CivicMind AI Engine'
          });
        }
      }

      try {
        await updateDoc(issueRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
      }

      // Update reporter profile points
      const userRef = doc(db, 'users', currentUser.id);
      try {
        await updateDoc(userRef, {
          points: increment(5),
          verificationsCount: increment(1)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.id}`);
      }

      // Update state in UI
      const updated: CivicIssue = {
        ...issue,
        verificationCount: currentVerCount,
        verifiedBy: [...issue.verifiedBy, currentUser.id],
        status: finalStatus,
        severity: finalSeverity,
        activityLog: [...issue.activityLog, newActivity]
      };
      
      onIssueUpdated(updated);
      setVerificationFeedback('Verification logged successfully! +5 Points!');
      setVerificationStatus('matched');

    } catch (err: any) {
      console.error('Verify error:', err);
      const friendlyMsg = parseError(err);
      setVerificationStatus('mismatched');
      setVerificationFeedback(friendlyMsg);
    } finally {
      setVerifying(false);
    }
  };

  // 1b. Optional AI-based Verification Photo match (Camera verify)
  const handleVerifyWithPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setVerificationStatus('matching');
    setVerificationFeedback('Gemini is analyzing and matching verification photo...');

    try {
      // Downscale verification image
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setVerifiedImage(base64);

        // Analyze verification image to see if it matches original category
        const analysis = await analyzeImage(base64, file.type);
        
        if (analysis.category === issue.category) {
          setVerificationStatus('matched');
          setVerificationFeedback(`AI Match Verified: confirmed ${issue.category} successfully!`);
          
          // Log verification directly
          await handleVerify(null as any);
        } else {
          setVerificationStatus('mismatched');
          setVerificationFeedback(`AI Match Mismatch: Detected '${analysis.category}' but original issue is listed as '${issue.category}'. Please ensure photo is of the same defect.`);
        }
      };
    } catch (error) {
      console.error('Photo verification failed:', error);
      setVerificationStatus('mismatched');
      setVerificationFeedback('AI failed to parse the verification photo. Try in better lighting.');
    }
  };

  // 2. Official Grievance Letter draft
  const handleGenerateLetter = async () => {
    setLoadingLetter(true);
    try {
      const data = await generateComplaintLetter(issue.department, issue.description, issue.address);
      if (data && data.letter) {
        setLetterDraft(data.letter);
      }
    } catch (e) {
      console.error('Letter error:', e);
      setLetterDraft(`To,\nThe Ward Officer,\n${issue.department}\n\nSubject: Formal grievance regarding ${issue.category} at ${issue.address}.\n\nDear Sir/Madam,\n\nI am writing to report a serious hazard: ${issue.description}. It is located at ${issue.address}.\n\nThis issue was logged on CivicMind AI on ${new Date(issue.createdAt).toLocaleDateString()} and verified by ${issue.verificationCount} community members.\n\nPlease take immediate corrective action.\n\nDate: 2026-06-28\n\nSincerely,\n_____________________\nCitizen Signature`);
    } finally {
      setLoadingLetter(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letterDraft);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // 3. Authority Status update (CRUD/Workflow tracking)
  const handleStatusChange = async (newStatus: CivicIssue['status']) => {
    if (!currentUser) return;
    setStatusInput(newStatus);
    setUpdatingStatus(true);

    try {
      const issueRef = doc(db, 'issues', issue.id!);
      const userName = localStorage.getItem(`civicmind_name_${currentUser.id}`) || 'Govt Officer';
      
      const newActivity = {
        action: `Status marked as '${newStatus}' by ${userName}`,
        timestamp: Date.now(),
        by: userName
      };

      const updates: any = {
        status: newStatus,
        updatedAt: Date.now(),
        activityLog: arrayUnion(newActivity)
      };

      // If marked as resolved and we have an after photo, attach it
      if (newStatus === 'Resolved') {
        if (afterPhoto) {
          updates.resolvedImageUrl = afterPhoto;
          updates.resolvedAt = Date.now();
          updates.activityLog = arrayUnion(newActivity, {
            action: `Resolution photo attached by ${userName}`,
            timestamp: Date.now(),
            by: userName
          });
        }
        if (resolutionNotesInput.trim() !== '') {
          updates.resolutionNotes = resolutionNotesInput.trim();
        }
      }

      try {
        await updateDoc(issueRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
      }

      // Award points to original reporter upon issue resolution (+20 points!)
      if (newStatus === 'Resolved' && issue.reporterId) {
        try {
          const reporterRef = doc(db, 'users', issue.reporterId);
          await updateDoc(reporterRef, {
            points: increment(20)
          });
        } catch (e) {
          console.warn('Could not award points to reporter:', e);
        }
      }

      const updated: CivicIssue = {
        ...issue,
        status: newStatus,
        resolvedImageUrl: newStatus === 'Resolved' && afterPhoto ? afterPhoto : issue.resolvedImageUrl,
        resolvedAt: newStatus === 'Resolved' ? Date.now() : issue.resolvedAt,
        resolutionNotes: newStatus === 'Resolved' ? resolutionNotesInput.trim() : issue.resolutionNotes,
        activityLog: [...issue.activityLog, newActivity]
      };
      onIssueUpdated(updated);
    } catch (e: any) {
      console.error('Status change error:', e);
      setError('Failed to update status: ' + parseError(e));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handles uploading resolving "after" photo
  const handleAfterPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAfterPhotoLoading(true);
    try {
      const resizedBase64 = await resizeImage(file);
      try {
        const imageRef = ref(storage, `issues/resolved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
        await uploadString(imageRef, resizedBase64, 'data_url');
        const url = await getDownloadURL(imageRef);
        setAfterPhoto(url);
      } catch (err) {
        console.error("Firebase Storage failed, falling back to base64:", err);
        setAfterPhoto(resizedBase64);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process image. Please try again.');
    } finally {
      setAfterPhotoLoading(false);
    }
  };

  // 4. Admin CRUD Deletion
  const handleDeleteReport = async () => {
    if (window.confirm('Are you absolutely sure you want to delete this civic report from Firestore? This is irreversible.')) {
      try {
        setError('');
        await deleteDoc(doc(db, 'issues', issue.id!));
        onIssueDeleted(issue.id!);
        onClose();
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `issues/${issue.id}`);
      }
    }
  };

  const isAlreadyVerified = currentUser && issue.verifiedBy.includes(currentUser.id);
  const isAuthority = currentUser && (currentUser.role === 'authority' || currentUser.role === 'admin');
  const isAdmin = currentUser && currentUser.role === 'admin';

  // Determine which user-uploaded image to display (prioritizing resolvedImageUrl if resolved, otherwise imageUrl)
  const getDisplayImage = () => {
    const isUploaded = (url?: string) => {
      if (!url) return false;
      const cleanUrl = url.trim();
      if (cleanUrl === '' || cleanUrl === 'null' || cleanUrl === 'undefined') return false;
      return cleanUrl.startsWith('data:') || cleanUrl.startsWith('http');
    };

    if (isUploaded(issue.resolvedImageUrl)) {
      return issue.resolvedImageUrl;
    }
    if (isUploaded(issue.imageUrl)) {
      return issue.imageUrl;
    }
    return null;
  };

  const displayImage = getDisplayImage();

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full md:w-[480px] lg:w-[440px] xl:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 transform translate-x-0 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0 z-10 transition-colors duration-300">
        <div>
          <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-widest uppercase bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded-md">
            {issue.category} {categoryEmojiMap[issue.category as keyof typeof categoryEmojiMap]}
          </span>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-tight flex items-center gap-1.5">
            Report #{issue.id?.slice(0, 6)}
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white dark:bg-slate-900 transition-colors duration-300">
        
        {/* Error Notification */}
        {error && (
          <div id="drawer-error-alert" className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm transition-all duration-200 shadow-sm animate-fade-in shrink-0 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold leading-snug">{error}</span>
          </div>
        )}

        {/* Photo Display */}
        <div className="flex flex-col gap-3">
          {issue.resolvedImageUrl ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-40 bg-slate-100 dark:bg-slate-950 shadow-sm transition-colors duration-300">
                <img src={issue.imageUrl} alt="Before" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold text-slate-700 dark:text-slate-300">Before</span>
                </div>
              </div>
              <div className="relative rounded-2xl overflow-hidden border border-emerald-200 dark:border-emerald-900/50 h-40 bg-emerald-50 dark:bg-slate-950 shadow-sm transition-colors duration-300">
                <img src={issue.resolvedImageUrl} alt="After" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-emerald-50/90 dark:bg-emerald-950/90 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400">After</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-48 bg-slate-100 dark:bg-slate-950 shrink-0 shadow-sm flex items-center justify-center transition-colors duration-300">
              {issue.imageUrl && (issue.imageUrl.startsWith('data:') || issue.imageUrl.startsWith('http')) ? (
                <>
                  <img src={issue.imageUrl} alt="Civic issue photograph" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 dark:from-slate-950/90 via-transparent to-transparent"></div>
                  
                  {/* Severity tag */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold text-slate-900 dark:text-white transition-colors duration-300">
                      {severityLabelMap[issue.severity as keyof typeof severityLabelMap]}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-lg text-slate-500 font-accent">No image uploaded. Take a picture next time!</span>
              )}
            </div>
          )}
          
          {/* Address & Geo Location */}
          <div className="flex flex-col gap-1 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-xs text-slate-700 dark:text-slate-400 font-medium leading-tight font-sans">{issue.address}</p>
            </div>
            <p className="text-[10px] text-slate-500 pl-5.5 font-mono">
              Geo: {issue.lat.toFixed(6)}, {issue.lng.toFixed(6)}
            </p>
          </div>
        </div>

        {/* Core Metadata */}
        <div className={`p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border-l-4 ${severityBorderColors[issue.severity as keyof typeof severityBorderColors]} space-y-3 transition-colors duration-300 shadow-sm dark:shadow-none`}>
          <div className="grid grid-cols-2 gap-y-3 text-xs text-slate-600 dark:text-slate-400 font-sans">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reporter</span>
              <span className="font-semibold text-slate-900 dark:text-slate-300 truncate">
                {issue.isAnonymous ? 'Anonymous' : issue.reporterName}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Officer</span>
              <span className="font-semibold text-slate-900 dark:text-slate-300 truncate">
                {issue.status === 'Resolved' || issue.status === 'Closed' 
                  ? (issue.activityLog.slice().reverse().find(log => log.action.includes('Resolved') || log.action.includes('Closed'))?.by || 'Assigned Officer') 
                  : (issue.status === 'In Progress' ? (issue.activityLog.slice().reverse().find(log => log.action.includes('In Progress'))?.by || 'Assigned Officer') : 'Unassigned')}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
              <span className={`font-bold ${
                issue.status === 'Resolved' ? 'text-emerald-600 dark:text-emerald-400' : 
                issue.status === 'In Progress' ? 'text-blue-600 dark:text-blue-400' :
                'text-amber-600 dark:text-amber-400'
              }`}>
                {issue.status}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Votes</span>
              <span className="font-bold text-slate-900 dark:text-slate-300">
                {issue.verificationCount}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 col-span-2">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 leading-snug">
                {issue.department}
              </span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/50 mt-2 transition-colors duration-300">
            <p className="text-sm text-slate-800 dark:text-slate-100 font-sans leading-relaxed">
              "{issue.description}"
            </p>
            <div className="flex items-center gap-1 mt-2 font-mono text-[10px] text-slate-500 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              Reported {getRelativeTime(issue.createdAt)}
            </div>
          </div>
        </div>

        {/* AI Department routing & explanation */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-2 transition-colors duration-300 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-300 tracking-wide uppercase">
              Smart Action routing
            </span>
          </div>
          <div className="text-xs font-sans">
            <p className="text-slate-900 dark:text-slate-200 font-semibold text-[13px]">
              Assigned to: <span className="text-blue-600 dark:text-blue-400">{issue.department}</span>
            </p>
            {issue.departmentExplanation && (
              <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {issue.departmentExplanation}
              </p>
            )}
          </div>
        </div>

        {/* Verification Hub */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-3 transition-colors duration-300 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">
                Community Verification ({issue.verificationCount})
              </span>
            </div>
            {issue.verificationCount >= 3 && (
              <span className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse-custom">
                ✓ Community Verified
              </span>
            )}
          </div>

          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Wards require consensus to bump urgency. Let officers know this problem is active!
          </p>

          {verificationFeedback && (
            <div className={`p-2.5 rounded-lg border text-xs font-sans flex items-center gap-1.5 transition-colors duration-300 ${
              verificationStatus === 'matched' 
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{verificationFeedback}</span>
            </div>
          )}

          {/* Citizen Verification Buttons */}
          {currentUser ? (
            isAlreadyVerified ? (
              <div className="py-2 text-center font-sans text-xs font-semibold text-slate-500 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 rounded-lg">
                ✓ You have verified this issue
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Regular quick confirm */}
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold font-sans text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {verifying ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Heart className="w-3.5 h-3.5 text-rose-200 fill-rose-200/20" />
                  )}
                  I can confirm this (+5 Points)
                </button>

                {/* Camera-based AI verification upload */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleVerifyWithPhoto}
                    disabled={verificationStatus === 'matching'}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={verificationStatus === 'matching'}
                    className="w-full py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/30 text-slate-700 dark:text-slate-300 font-semibold font-sans text-xs transition flex items-center justify-center gap-1.5 shadow-sm dark:shadow-none"
                  >
                    {verificationStatus === 'matching' ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    Verify with Photo (Gemini AI Match)
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="py-2 text-center font-sans text-xs text-slate-500 border border-slate-200 dark:border-slate-850 rounded-lg bg-white dark:bg-slate-950/40">
              Sign in to verify and earn community points
            </div>
          )}
        </div>

        {/* Complaint Letter Generator (Generates complaint letter text) */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-3 transition-colors duration-300 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4.5 h-4.5 text-amber-500" />
              Official Grievance Document
            </span>
            <button
              onClick={handleGenerateLetter}
              disabled={loadingLetter}
              className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition flex items-center gap-1"
            >
              {loadingLetter ? (
                <Loader className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {letterDraft ? 'Regenerate (AI)' : 'Draft Letter (AI)'}
            </button>
          </div>

          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Instantly draft a professional, ready-to-sign formal complaint addressed to municipal authorities.
          </p>

          {letterDraft && (
            <div className="space-y-2 animate-fade-in">
              <div className="relative">
                <textarea
                  readOnly
                  rows={6}
                  value={letterDraft}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono rounded-lg resize-none leading-relaxed transition-colors duration-300"
                />
                <button
                  onClick={copyToClipboard}
                  className="absolute bottom-3 right-3 p-1.5 rounded bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition border border-slate-200 dark:border-slate-800 flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-sans text-[10px] font-semibold">{copySuccess ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-3 transition-colors duration-300 shadow-sm dark:shadow-none">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide block">
            Community Comments ({issue.comments?.length || 0})
          </span>
          <div className="space-y-3 font-sans">
            {(issue.comments || []).map((comment) => (
              <div key={comment.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs transition-colors duration-300">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900 dark:text-slate-300">{comment.by}</span>
                  <span className="font-mono text-slate-500 text-[10px]">{getRelativeTime(comment.timestamp)}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-200">{comment.text}</p>
              </div>
            ))}
            
            {currentUser ? (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('commentText') as HTMLInputElement;
                  if (!input.value.trim()) return;
                  const newComment = {
                    id: Math.random().toString(36).substr(2, 9),
                    text: input.value.trim(),
                    by: localStorage.getItem(`civicmind_name_${currentUser.id}`) || currentUser.email?.split('@')[0] || 'Citizen',
                    timestamp: Date.now()
                  };
                  input.value = '';
                  try {
                    await updateDoc(doc(db, 'issues', issue.id!), {
                      comments: arrayUnion(newComment)
                    });
                    onIssueUpdated({
                      ...issue,
                      comments: [...(issue.comments || []), newComment]
                    });
                  } catch (err) {
                    console.error('Failed to post comment', err);
                  }
                }}
                className="flex items-center gap-2 mt-2"
              >
                <input 
                  type="text" 
                  name="commentText"
                  placeholder="Add a public comment..." 
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors duration-300"
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm">Post</button>
              </form>
            ) : (
              <div className="text-xs text-slate-500 text-center py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors duration-300">Sign in to comment</div>
            )}
          </div>
        </div>

        {/* ACTIVITY LOG (Timeline) */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-4 transition-colors duration-300 shadow-sm dark:shadow-none">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide block">
            Resolution Progress History
          </span>

          {issue.resolutionNotes && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs space-y-1 font-sans">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Official Resolution Notes:</span>
              <p className="text-slate-700 dark:text-slate-200">{issue.resolutionNotes}</p>
            </div>
          )}
          
          <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
            {issue.activityLog.slice().reverse().map((log, index) => (
              <div key={index} className="relative text-xs">
                {/* Timeline Dot */}
                <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-50 dark:border-slate-950 ${
                  index === 0 ? 'bg-blue-500 ring-4 ring-blue-500/15 scale-110' : 'bg-slate-300 dark:bg-slate-700'
                }`}></div>
                
                <p className="text-slate-800 dark:text-slate-200 font-medium font-sans leading-relaxed">
                  {log.action}
                </p>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 mt-0.5">
                  <span>By: {log.by}</span>
                  <span>•</span>
                  <span>{getRelativeTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AUTHORITY CONTROLS (Only visible to Officers/Admins) */}
        {isAuthority && (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border-2 border-amber-500/10 space-y-4 transition-colors duration-300 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <Shield className="w-4.5 h-4.5" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Official Authority Work Desk
              </span>
            </div>

            <div className="space-y-3 font-sans">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Set Resolution Status</label>
                <div className="flex gap-1">
                  {(['Reported', 'Verified', 'In Progress', 'Resolved', 'Closed'] as CivicIssue['status'][]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      disabled={updatingStatus}
                      className={`flex-1 py-1 px-1.5 rounded border text-[10px] font-bold text-center transition ${
                        issue.status === st 
                          ? 'bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-600/10 dark:border-amber-500 dark:text-amber-400' 
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Image Upload Prompt (When status is Resolved or transitioning to Resolved) */}
              {issue.status !== 'Resolved' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">Resolution Notes (Optional)</label>
                    <textarea 
                      value={resolutionNotesInput}
                      onChange={(e) => setResolutionNotesInput(e.target.value)}
                      placeholder="Explain how this issue was resolved..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:border-amber-500 focus:outline-none resize-none transition-colors duration-300"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                      Add "After Fix" Photo
                    </span>
                    {afterPhoto && (
                      <button 
                        type="button"
                        onClick={() => setAfterPhoto(null)} 
                        className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {afterPhoto ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 h-24 bg-slate-100 dark:bg-slate-900 transition-colors duration-300">
                      <img src={afterPhoto} alt="After Fix" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleAfterPhotoChange}
                        disabled={afterPhotoLoading}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <button
                        type="button"
                        className="w-full py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition flex items-center justify-center gap-1 transition-colors duration-300"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Upload Completion Photo
                      </button>
                    </div>
                  )}
                  {afterPhoto && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('Resolved')}
                      className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-sm"
                    >
                      ✓ Finalize Resolution with Photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMIN CONTROLS (Delete from Firestore, full CRUD) */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border-2 border-rose-500/10 flex items-center justify-between transition-colors duration-300 shadow-sm dark:shadow-none">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wide">
                Admin Panel Control
              </span>
              <span className="font-sans text-[10px] text-slate-500">
                Remove fraudulent or duplicate reports
              </span>
            </div>
            <button
              onClick={handleDeleteReport}
              className="font-sans px-3 py-1.5 bg-rose-50 dark:bg-rose-600/10 border border-rose-200 dark:border-rose-600/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-600/20 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Delete Report
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
