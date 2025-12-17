'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Camera, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface AvatarUploadProps {
    userId: string;
    currentAvatarUrl: string | null;
    userName: string;
}

// Resize image to 256x256 using Canvas API
async function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Set canvas size to 256x256
                canvas.width = 256;
                canvas.height = 256;

                // Calculate crop dimensions to maintain aspect ratio
                const size = Math.min(img.width, img.height);
                const x = (img.width - size) / 2;
                const y = (img.height - size) / 2;

                // Draw image centered and cropped
                ctx.drawImage(img, x, y, size, size, 0, 0, 256, 256);

                // Convert to blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Could not create blob'));
                    }
                }, 'image/jpeg', 0.9);
            };
            img.onerror = () => reject(new Error('Could not load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

export function AvatarUpload({ userId, currentAvatarUrl, userName }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const supabase = createSupabaseBrowserClient();

            // Resize image
            const resizedBlob = await resizeImage(file);

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/avatar.${fileExt}`;
            const { error: uploadError, data } = await supabase.storage
                .from('avatars')
                .upload(fileName, resizedBlob, {
                    upsert: true,
                    contentType: 'image/jpeg',
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Update local state
            setAvatarUrl(publicUrl);

            // Refresh the page to update all avatar instances
            window.location.reload();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="relative group">
            <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
            />
            <label
                htmlFor="avatar-upload"
                className="cursor-pointer block"
            >
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/20 shadow-lg group-hover:border-emerald-400/50 transition-all">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt={userName}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                            {userName[0]?.toUpperCase() || 'U'}
                        </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploading ? (
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                            <Camera className="w-6 h-6 text-white" />
                        )}
                    </div>
                </div>
            </label>

            {error && (
                <p className="text-xs text-red-400 mt-2">{error}</p>
            )}
        </div>
    );
}
