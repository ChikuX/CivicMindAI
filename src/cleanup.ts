import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Disabled database seed/cleanup script.
// Used previously to clear unsplash/picsum images and reset demo data.
// Disable it per instructions instead of deleting.

export async function cleanupDemoData() {
  /*
  try {
    const issuesSnap = await getDocs(collection(db, 'issues'));
    for (const d of issuesSnap.docs) {
      const data = d.data();
      // Remove placeholder images from mock data
      if (data.imageUrl && (data.imageUrl.includes('unsplash') || data.imageUrl.includes('picsum'))) {
        await deleteDoc(doc(db, 'issues', d.id));
      }
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
  */
}
