import { Image } from '@heroui/react';
import { useContext, useEffect, useState } from 'react';
import { fetchAttachmentBlob } from './attachmentControl';
import { TokenContext } from '@/utils/TokenProvider';
import { logError } from '@/utils/errorHandler';

type Props = {
  attachmentId: number;
  alt: string;
};

// Attachments are only served to signed-in users who can see the project, and an
// <img> tag cannot send the token, so the image is fetched and shown from a blob URL.
export default function AttachmentThumbnail({ attachmentId, alt }: Props) {
  const tokenContext = useContext(TokenContext);
  const jwt = tokenContext.token?.access_token;
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!jwt) return;

    let objectUrl: string | undefined;
    let cancelled = false;
    fetchAttachmentBlob(jwt, attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((error: unknown) => {
        logError('Error loading attachment image', error);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [jwt, attachmentId]);

  if (!src) {
    return <div className="h-40 w-40 rounded-lg bg-neutral-100 dark:bg-neutral-700" />;
  }
  return <Image alt={alt} src={src} className="object-cover h-40 w-40" />;
}
