declare const google: any;

const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export const getAccessToken = (): Promise<string> => {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return Promise.resolve(accessToken);
  }

  return new Promise((resolve, reject) => {
    try {
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services library not loaded.'));
        return;
      }
      
      if (!CLIENT_ID) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured. Please add it to your environment variables.'));
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            accessToken = response.access_token;
            // Access tokens typically expire in 3600 seconds
            tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // Subtract 1 minute for safety
            resolve(response.access_token);
          } else {
            console.error('Token Error:', response);
            reject(new Error('Failed to get access token: ' + (response.error || 'Unknown error')));
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      reject(error);
    }
  });
};

export const uploadToDrive = async (filename: string, content: string): Promise<any> => {
  const token = await getAccessToken();
  
  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${response.statusText}. ${errorBody}`);
  }

  return response.json();
};

export const findBackupFile = async (filename: string): Promise<string | null> => {
  const token = await getAccessToken();
  const query = encodeURIComponent(`name = '${filename}' and trashed = false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
};

export const updateDriveFile = async (fileId: string, content: string): Promise<any> => {
  const token = await getAccessToken();
  
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: content,
  });

  if (!response.ok) {
    throw new Error(`Failed to update Google Drive file: ${response.statusText}`);
  }

  return response.json();
};
