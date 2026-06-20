export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

  let resourceType = 'image';
  if (file.type.startsWith('video/')) resourceType = 'video';
  else if (file.type.startsWith('audio/')) resourceType = 'raw';

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error('Cloudinary cloud name not configured');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: 'POST', body: formData, signal: controller.signal }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'Unknown error');
      throw new Error(`Cloudinary upload failed (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    return data.secure_url as string;
  } finally {
    clearTimeout(timeoutId);
  }
}
