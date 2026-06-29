import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, MapPin, Sparkles, Loader, AlertCircle, X, Check, HelpCircle } from 'lucide-react';
import { analyzeImage, routeDepartment } from '../services/gemini';
import { collection, addDoc, doc, updateDoc, increment, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, OperationType, handleFirestoreError, storage } from '../firebase';
import { CivicIssue, UserProfile } from '../types';
import L from 'leaflet';

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onReportSubmitted: (newIssue: CivicIssue) => void;
  mapCenter: [number, number];
}

// Downscale image helper to prevent Firestore doc size issues and keep Gemini requests fast
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

// Simple list of Bangalore wards / neighborhoods based on lat/lng closeness
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

export default function ReportDrawer({ isOpen, onClose, currentUser, onReportSubmitted, mapCenter }: ReportDrawerProps) {
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Upload & AI analysis, Step 2: Location & Details
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [routing, setRouting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [category, setCategory] = useState<CivicIssue['category']>('pothole');
  const [severity, setSeverity] = useState<CivicIssue['severity']>('medium');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(mapCenter[0]);
  const [lng, setLng] = useState(mapCenter[1]);
  const [address, setAddress] = useState('Fetching address...');
  const [reporterName, setReporterName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // References
  const minimapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerInstance = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form states on close
      setStep(1);
      setImage(null);
      setAnalyzing(false);
      setRouting(false);
      setSubmitting(false);
      setShowSuccess(false);
      setError('');
      setReporterName('');
      setIsAnonymous(false);
      if (currentUser) {
        // Preset username if logged in
        const storedName = localStorage.getItem(`civicmind_name_${currentUser.id}`) || currentUser.email?.split('@')[0] || 'Citizen';
        setReporterName(storedName);
      }
    }
  }, [isOpen, currentUser]);

  // Dynamic Nominatim Address fetching
  const updateAddress = async (latitude: number, longitude: number) => {
    setAddress('Fetching address...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        const area = getNeighborhoodName(latitude, longitude);
        const isCloseToBangalore = Math.abs(latitude - 12.97) < 0.5 && Math.abs(longitude - 77.59) < 0.5;
        setAddress(isCloseToBangalore ? `${area}, Bengaluru` : area);
      }
    } catch (e) {
      const area = getNeighborhoodName(latitude, longitude);
      const isCloseToBangalore = Math.abs(latitude - 12.97) < 0.5 && Math.abs(longitude - 77.59) < 0.5;
      setAddress(isCloseToBangalore ? `${area}, Bengaluru` : area);
    }
  };

  // Handle Geolocation API to set current location
  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;
          setLat(uLat);
          setLng(uLng);
          
          updateAddress(uLat, uLng);

          if (mapInstance.current) {
            mapInstance.current.setView([uLat, uLng], 16);
            if (markerInstance.current) {
              markerInstance.current.setLatLng([uLat, uLng]);
            }
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          updateAddress(mapCenter[0], mapCenter[1]);
        }
      );
    } else {
      updateAddress(mapCenter[0], mapCenter[1]);
    }
  };

  // Initialize minimap when entering step 2
  useEffect(() => {
    if (step === 2 && minimapRef.current && !mapInstance.current) {
      // Small timeout to allow container rendering
      const timer = setTimeout(() => {
        if (!minimapRef.current) return;
        
        const map = L.map(minimapRef.current, {
          zoomControl: false,
          attributionControl: false
        }).setView([lat, lng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // Custom marker that can be dragged
        const marker = L.marker([lat, lng], {
          draggable: true
        }).addTo(map);

        marker.on('dragend', () => {
          const position = marker.getLatLng();
          setLat(position.lat);
          setLng(position.lng);
          updateAddress(position.lat, position.lng);
        });

        // Trigger address fetch on load
        updateAddress(lat, lng);

        mapInstance.current = map;
        markerInstance.current = marker;

        // Force a resize calculation
        map.invalidateSize();
      }, 100);

      return () => clearTimeout(timer);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerInstance.current = null;
      }
    };
  }, [step]);

  // Handle image select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError('');

    let base64 = '';
    try {
      // Resize image for Firestore / Gemini and get base64
      base64 = await resizeImage(file);
      setImage(base64);

      // Call Gemini Vision to auto-analyze
      const analysis = await analyzeImage(base64, file.type);
      
      if (analysis) {
        setCategory(analysis.category || 'pothole');
        setSeverity(analysis.severity || 'medium');
        setDescription(analysis.description || '');
      }

      // Automatically trigger location lock
      detectLocation();

      // Go to Step 2
      setStep(2);
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setError('AI photo analysis failed. Please specify the category and description manually.');
      
      // Still show the actual resized base64 image or read direct as Data URL to ensure Firestore gets actual image
      if (base64) {
        setImage(base64);
        detectLocation();
        setStep(2);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result as string);
          detectLocation();
          setStep(2);
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError('Please upload an issue photo first.');
      return;
    }

    setSubmitting(true);
    setRouting(true);
    setError('');

    try {
      const activeUser = currentUser;
      const finalReporterName = isAnonymous ? 'Anonymous' : (reporterName.trim() || 'Citizen');

      // 1. Get smart department routing from Gemini
      let department = 'Municipal Corporation General';
      let departmentExplanation = 'Routed to local ward officer for general inspection.';
      try {
        const routeData = await routeDepartment(category, description, address);
        if (routeData) {
          department = routeData.department;
          departmentExplanation = routeData.explanation;
        }
      } catch (geminiErr) {
        console.warn('Gemini Routing failed, falling back to general:', geminiErr);
        // Standard fallbacks based on category
        const fallbackDeps = {
          pothole: 'Roads Department',
          'water leak': 'Water & Sewage Department',
          'broken streetlight': 'Electricity Board',
          garbage: 'Sanitation Department',
          'damaged road': 'Roads Department',
          'open drain': 'Water & Sewage Department',
          other: 'Municipal Corporation General'
        };
        department = fallbackDeps[category] || 'Municipal Corporation General';
      }

      setRouting(false);

      // Upload image to Firebase Storage if available
      let finalImageUrl = '';
      if (image && image.startsWith('data:')) {
        try {
          const imageRef = ref(storage, `issues/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
          await uploadString(imageRef, image, 'data_url');
          finalImageUrl = await getDownloadURL(imageRef);
        } catch (err) {
          console.error("Failed to upload image to Storage:", err);
          finalImageUrl = image; // fallback to base64 if storage fails
        }
      }

      // 2. Build the CivicIssue model
      const newIssue: CivicIssue = {
        category,
        severity,
        description,
        department,
        departmentExplanation,
        lat,
        lng,
        address,
        imageUrl: finalImageUrl || image,
        reporterName: finalReporterName,
        reporterId: currentUser?.id,
        isAnonymous,
        status: 'Reported',
        verificationCount: 0,
        verifiedBy: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        activityLog: [
          {
            action: `Issue reported by ${finalReporterName}`,
            timestamp: Date.now(),
            by: finalReporterName
          },
          {
            action: `AI smart-routed issue to ${department}`,
            timestamp: Date.now(),
            by: 'CivicMind AI Core'
          }
        ]
      };

      // 3. Save to Firestore
      let docRef;
      try {
        const issuesCol = collection(db, 'issues');
        docRef = await addDoc(issuesCol, newIssue);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'issues');
      }
      const savedIssue = { ...newIssue, id: docRef.id };

      // 4. Update user points if logged in (Citizen)
      if (activeUser) {
        const userRef = doc(db, 'users', activeUser.id);
        
        // Add 10 points for reporting, increment reportsCount
        try {
          await updateDoc(userRef, {
            points: increment(10),
            reportsCount: increment(1),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${activeUser.id}`);
        }

        // Re-read profile to check badges
        let updatedSnap;
        try {
          updatedSnap = await getDoc(userRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${activeUser.id}`);
        }

        if (updatedSnap.exists()) {
          const data = updatedSnap.data();
          const currentBadges = data.badges || [];
          const newBadges = [...currentBadges];

          if (!currentBadges.includes('First Report')) {
            newBadges.push('First Report');
          }
          if (data.reportsCount >= 5 && !currentBadges.includes('Problem Solver')) {
            newBadges.push('Problem Solver');
          }
          if (data.points >= 100 && !currentBadges.includes('Community Champion')) {
            newBadges.push('Community Champion');
          }

          if (newBadges.length !== currentBadges.length) {
            try {
              await updateDoc(userRef, { badges: newBadges });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `users/${activeUser.id}`);
            }
          }
        }
      }

      // Show satisfying success animation
      setShowSuccess(true);
      onReportSubmitted(savedIssue);

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Submit issue error:', err);
      let errMsg = err?.message || String(err || 'unknown error');
      if (typeof errMsg === 'string' && errMsg.startsWith('{') && errMsg.endsWith('}')) {
        try {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.error || errMsg;
        } catch (e) {}
      }
      if (errMsg.includes('permission-denied') || errMsg.includes('Missing or insufficient permissions')) {
        errMsg = 'Permission Denied: Your account is not authorized to save reports. Please verify your login status.';
      }
      setError('Failed to submit report: ' + errMsg);
    } finally {
      setSubmitting(false);
      setRouting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full md:w-[480px] lg:w-[440px] xl:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 transform translate-x-0 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 shrink-0 transition-colors duration-300">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Report a Civic Issue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Spotted something broken? let's fix it.
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Success View */}
      {showSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 text-center animate-fade-in transition-colors duration-300">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path className="animate-draw-checkmark" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Report Lodged!</h4>
          <p className="font-sans text-sm text-slate-600 dark:text-slate-400 max-w-sm mt-2">
            Thank you! Your issue is now on the map. We've routed it and generated a formal grievance letter.
          </p>
          {currentUser && (
            <div className="mt-6 px-4 py-2.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 font-mono">
              🚀 +10 Reporter Points Awarded!
            </div>
          )}
        </div>
      ) : (
        /* Form Content */
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white dark:bg-slate-900 transition-colors duration-300">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-sans">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: PHOTO UPLOAD */}
          {step === 1 && (
            <div className="space-y-4 py-6">
              <h4 className="font-sans text-sm font-semibold text-slate-800 dark:text-slate-300">
                First, snap or upload a photo of the issue
              </h4>

              <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-950/60 transition group cursor-pointer overflow-hidden min-h-[220px]">
                {analyzing ? (
                  <div className="space-y-4 py-4 flex flex-col items-center justify-center">
                    <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">Analyzing your photo... 🔍</p>
                      <p className="text-xs text-slate-500 font-sans">Gemini Vision is classifying the damage & severity...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="p-4 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110 transition mb-4">
                      <Camera className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 font-sans">
                      Tap to take photo or upload
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-sans">
                      Supports direct camera capture on mobile (JPEG, PNG)
                    </p>
                  </>
                )}
              </div>

              {/* Friendly empty states helper */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800 flex gap-3 text-xs text-slate-600 dark:text-slate-400 font-sans">
                <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-slate-300 font-semibold">Gemini Vision AI</strong> automatically extracts the category, estimates how critical the issue is, and drafts a description in seconds!
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: DETAILS & LOCATION MAP */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5 pb-6 font-sans">
              
              {/* Photo Preview Thumbnail */}
              {image && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-36 bg-slate-100 dark:bg-slate-950 shrink-0">
                  <img src={image} alt="Civic defect preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 dark:from-slate-950/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-blue-500/10 backdrop-blur-md border border-blue-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold text-blue-100 dark:text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gemini Scanned
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setStep(1);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900/70 border border-slate-700 hover:bg-slate-900 text-slate-300 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CivicIssue['category'])}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-lg text-slate-900 dark:text-slate-200 text-xs outline-none cursor-pointer"
                  >
                    <option value="pothole">🕳️ Pothole</option>
                    <option value="water leak">💧 Water Leak</option>
                    <option value="broken streetlight">💡 Streetlight</option>
                    <option value="garbage">🗑️ Garbage Pile</option>
                    <option value="damaged road">🛣️ Damaged Road</option>
                    <option value="open drain">🚯 Open Drain</option>
                    <option value="other">🔧 Other Issue</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as CivicIssue['severity'])}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-lg text-slate-900 dark:text-slate-200 text-xs outline-none cursor-pointer font-medium"
                  >
                    <option value="low" className="text-emerald-600 dark:text-emerald-400">🟢 Low Priority</option>
                    <option value="medium" className="text-amber-600 dark:text-amber-400">🟡 Medium</option>
                    <option value="high" className="text-orange-600 dark:text-orange-400">🟠 High</option>
                    <option value="critical" className="text-rose-600 dark:text-rose-400">🔴 Critical</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Issue Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue, damage, or location details..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-lg text-slate-900 dark:text-slate-200 text-xs outline-none resize-none"
                />
              </div>

              {/* Location minimap (interactive) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    Verify Location (Drag pin to adjust)
                  </label>
                  <button
                    type="button"
                    onClick={detectLocation}
                    className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition"
                  >
                    Recenter GPS
                  </button>
                </div>

                {/* Minimap div */}
                <div 
                  ref={minimapRef}
                  className="h-32 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 relative overflow-hidden z-0"
                ></div>

                {/* Pin Address Display */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate">{address}</span>
                </div>
              </div>

              {/* Reporter details */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reporter Identity</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="anon-checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-blue-500 focus:ring-0 outline-none w-3.5 h-3.5 cursor-pointer"
                    />
                    <label htmlFor="anon-checkbox" className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer">
                      Stay Anonymous
                    </label>
                  </div>
                </div>

                {!isAnonymous && (
                  <input
                    type="text"
                    required={!isAnonymous}
                    placeholder="Enter your name"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-lg text-slate-900 dark:text-slate-200 text-xs outline-none"
                  />
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {routing ? 'AI Routing report to Department...' : 'Uploading Issue...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Submit Report & Route
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
