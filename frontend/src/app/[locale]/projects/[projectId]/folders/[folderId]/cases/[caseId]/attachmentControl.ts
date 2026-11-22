import Config from '@/config/config';
import { logError } from '@/utils/errorHandler';
const apiServer = Config.apiServer;

async function fetchAttachmentBlob(jwt: string, attachmentId: number) {
  const fetchOptions = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  };

  const url = `${apiServer}/attachments/download/${attachmentId}`;
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return await response.blob();
}

async function fetchDownloadAttachment(jwt: string, attachmentId: number, downloadFileName: string) {
  try {
    const blob = await fetchAttachmentBlob(jwt, attachmentId);
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error: unknown) {
    logError('Error downloading attachment', error);
    throw error;
  }
}

async function fetchCreateAttachments(jwt: string, caseId: number, files: File[]) {
  try {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const url = `${apiServer}/attachments?parentCaseId=${caseId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const responseData = await response.json();
    return responseData;
  } catch (error: unknown) {
    logError('Error uploading files', error);
  }
}

async function fetchDeleteAttachment(jwt: string, attachmentId: number) {
  const fetchOptions = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
  };

  const url = `${apiServer}/attachments/${attachmentId}`;

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error: unknown) {
    logError('Error deleting file:', error);
    throw error;
  }
}

export { fetchAttachmentBlob, fetchDownloadAttachment, fetchCreateAttachments, fetchDeleteAttachment };
