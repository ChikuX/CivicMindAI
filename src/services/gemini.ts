import { CivicIssue } from '../types';

export async function analyzeImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<{
  category: CivicIssue['category'];
  severity: CivicIssue['severity'];
  description: string;
}> {
  const response = await fetch('/api/gemini/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze image');
  }

  return response.json();
}

export async function routeDepartment(category: string, description: string, area: string): Promise<{
  department: string;
  explanation: string;
}> {
  const response = await fetch('/api/gemini/route-department', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category, description, area }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to determine department');
  }

  return response.json();
}

export async function generateComplaintLetter(department: string, description: string, location: string): Promise<{
  letter: string;
}> {
  const response = await fetch('/api/gemini/generate-letter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ department, description, location }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate complaint letter');
  }

  return response.json();
}

export async function generateInsights(issuesSummary: Array<{
  category: string;
  severity: string;
  status: string;
  address: string;
}>): Promise<{
  insights: string;
}> {
  const response = await fetch('/api/gemini/insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ issuesSummary }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate insights');
  }

  return response.json();
}
