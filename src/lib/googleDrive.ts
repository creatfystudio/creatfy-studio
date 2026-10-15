const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any = null;

export function initGoogleDriveAuth(callback?: (token: string) => void) {
  if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) return;
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.access_token) {
        localStorage.setItem('gdrive_access_token', response.access_token);
        // Regista o tempo de expiração (1 hora = 3600 segundos, guardamos com margem)
        const expiresAt = Date.now() + ((response.expires_in || 3600) - 300) * 1000;
        localStorage.setItem('gdrive_token_expires_at', expiresAt.toString());
        if (callback) callback(response.access_token);
      }
    },
  });
}

/** Pede autorização inicial com janela de consentimento */
export function connectGoogleDrive(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      initGoogleDriveAuth((t) => resolve(t));
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        reject(new Error('Biblioteca do Google ainda a carregar. Tente em instantes.'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

/** Obtém o token atual ou renova silenciosamente em segundo plano se tiver expirado */
export async function getValidToken(): Promise<string> {
  const token = localStorage.getItem('gdrive_access_token');
  const expiresAt = Number(localStorage.getItem('gdrive_token_expires_at') || 0);

  // Se o token existir e ainda for válido, devolve diretamente
  if (token && Date.now() < expiresAt) {
    return token;
  }

  // Se expirou mas a conta já foi conectada anteriormente, renova silenciosamente
  return new Promise((resolve, reject) => {
    try {
      initGoogleDriveAuth((newToken) => resolve(newToken));
      if (tokenClient) {
        // prompt vazio renova sem abrir janelas nem pedir confirmação
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        if (token) resolve(token); // Fallback temporário
        else reject(new Error('Google Drive desligado. Ligue a conta no separador Usuários.'));
      }
    } catch (err) {
      if (token) resolve(token);
      else reject(err);
    }
  });
}

export function isDriveConnected(): boolean {
  return !!localStorage.getItem('gdrive_access_token');
}

export function disconnectGoogleDrive() {
  localStorage.removeItem('gdrive_access_token');
  localStorage.removeItem('gdrive_token_expires_at');
}

export async function getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
  const token = await getValidToken();

  let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await searchRes.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  const created = await createRes.json();
  return created.id;
}

export async function uploadToDrive(
  file: Blob | File,
  fileName: string,
  folderId: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; fileId: string }> {
  const token = await getValidToken();

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: file.type || 'application/octet-stream',
  };

  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type || 'application/octet-stream',
      'X-Upload-Content-Length': file.size.toString(),
    },
    body: JSON.stringify(metadata),
  });

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Falha ao iniciar envio para o Google Drive.');
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  const result = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(result.error?.message || 'Falha ao guardar o ficheiro no Google Drive.');
  }

  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  onProgress?.(100);

  return {
    url: `https://drive.google.com/file/d/${result.id}/view?usp=sharing`,
    fileId: result.id,
  };
}