import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function cleanupDemoData() {
  console.log('Running demo data cleanup...');
  try {
    const issuesSnap = await getDocs(collection(db, 'issues'));
    let deletedCount = 0;
    
    for (const issueDoc of issuesSnap.docs) {
      const data = issueDoc.data();
      const hasMockImg = data.imageUrl && (
        data.imageUrl.includes('images.unsplash.com') ||
        data.imageUrl.includes('picsum.photos')
      );
      const hasMockResolvedImg = data.resolvedImageUrl && (
        data.resolvedImageUrl.includes('images.unsplash.com') ||
        data.resolvedImageUrl.includes('picsum.photos')
      );
      
      if (hasMockImg || hasMockResolvedImg) {
        await deleteDoc(doc(db, 'issues', issueDoc.id));
        deletedCount++;
      }
    }
    
    console.log(`Cleaned up ${deletedCount} demo reports.`);
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}
