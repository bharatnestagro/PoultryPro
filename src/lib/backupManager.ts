import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { uploadToDrive, findBackupFile, updateDriveFile } from './googleDrive';

export const runBackup = async (userId: string) => {
  try {
    // 1. Gather all data
    const backupData: any = {
      timestamp: new Date().toISOString(),
      userId: userId,
      data: {}
    };

    const collectionsToBackup = [
      'flocks',
      'dailyLogs',
      'transactions',
      'feedStock',
      'medicineStock'
    ];

    for (const colName of collectionsToBackup) {
      const q = query(collection(db, colName), where('userId', '==', userId));
      const snap = await getDocs(q);
      backupData.data[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Include user profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      backupData.data['users'] = { id: userId, ...userDoc.data() };
    }

    const filename = `PoultryPro_Backup_${userId}.json`;
    const content = JSON.stringify(backupData, null, 2);

    // 2. Upload/Update on Drive
    const existingFileId = await findBackupFile(filename);
    if (existingFileId) {
      await updateDriveFile(existingFileId, content);
    } else {
      await uploadToDrive(filename, content);
    }

    // 3. Update last backup timestamp in user profile
    await updateDoc(doc(db, 'users', userId), {
      lastBackupAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
};

export const checkAndRunAutoBackup = async (userId: string, lastBackupAt?: string) => {
  if (!lastBackupAt) return; // No auto-backup if never backed up before (user needs to trigger first link)
  
  const lastDate = new Date(lastBackupAt);
  const diff = Date.now() - lastDate.getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (diff >= twentyFourHours) {
    console.log('Running auto-scheduled backup...');
    try {
      await runBackup(userId);
    } catch (e) {
      console.error('Auto backup failed', e);
    }
  }
};
