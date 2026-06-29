export interface ActivityLogItem {
  action: string;
  timestamp: string | number;
  by: string;
}

export interface CivicIssueComment {
  id: string;
  text: string;
  by: string;
  timestamp: string | number;
}

export interface CivicIssue {
  id?: string;
  category: 'pothole' | 'water leak' | 'broken streetlight' | 'garbage' | 'damaged road' | 'open drain' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  department: string;
  departmentExplanation?: string;
  lat: number;
  lng: number;
  address: string;
  imageUrl: string; // Base64 data URL
  reporterName: string;
  reporterId?: string;
  isAnonymous: boolean;
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved' | 'Closed';
  verificationCount: number;
  verifiedBy: string[]; // List of user names/IDs who verified
  createdAt: string | number;
  updatedAt: string | number;
  activityLog: ActivityLogItem[];
  comments?: CivicIssueComment[];
  resolvedImageUrl?: string; // Base64 data URL for resolved issues
  resolvedAt?: string | number;
  resolutionNotes?: string;
}

export interface UserProfile {
  id: string; // matches email or auth uid or username
  email?: string;
  points: number;
  badges: string[];
  reportsCount: number;
  verificationsCount: number;
  role: 'citizen' | 'authority' | 'admin';
}
