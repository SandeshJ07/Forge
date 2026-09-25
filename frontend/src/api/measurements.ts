import * as ImagePicker from 'expo-image-picker';
import { apiClient, apiFileUrl } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Measurement, MeasurementType, ProgressPhoto } from '@/types/database';

export async function fetchMeasurements(type?: MeasurementType): Promise<Measurement[]> {
  return apiClient.get<Measurement[]>(`/measurements${type ? `?type=${encodeURIComponent(type)}` : ''}`);
}

export async function addMeasurement(input: {
  type: MeasurementType;
  value: number;
  unit: string;
  date: string;
}): Promise<Measurement> {
  return apiClient.post<Measurement>('/measurements', input);
}

export async function deleteMeasurement(id: string): Promise<void> {
  await apiClient.delete(`/measurements/${id}`);
}

export async function fetchDistinctMeasurementTypes(): Promise<string[]> {
  return apiClient.get<string[]>('/measurements/types');
}

export async function pickAndUploadProgressPhoto(date: string): Promise<ProgressPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission denied.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileExt = asset.uri.split('.').pop() ?? 'jpg';
  const mimeType = asset.mimeType ?? 'image/jpeg';

  const formData = new FormData();
  // React Native's FormData accepts this {uri, name, type} shape directly;
  // on web, fetch the asset and append a real Blob/File instead.
  if (asset.uri.startsWith('data:') || asset.uri.startsWith('blob:')) {
    const blob = await (await fetch(asset.uri)).blob();
    formData.append('file', blob, `photo.${fileExt}`);
  } else {
    formData.append('file', { uri: asset.uri, name: `photo.${fileExt}`, type: mimeType } as unknown as Blob);
  }

  return apiClient.post<ProgressPhoto>(`/measurements/photos?date=${date}`, formData, { isFormData: true });
}

export async function fetchProgressPhotos(): Promise<ProgressPhoto[]> {
  return apiClient.get<ProgressPhoto[]>('/measurements/photos');
}

/**
 * The photo-file endpoint requires Authorization, which <Image source={{uri}}>
 * can't attach directly — so this fetches the file as a blob and hands back
 * an object/data URL the Image component can render.
 */
export async function getProgressPhotoUrl(photoId: string): Promise<string> {
  const session = useAuthStore.getState().session;
  const response = await fetch(apiFileUrl(`/measurements/photos/${photoId}/file`), {
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
  });
  if (!response.ok) throw new Error('Failed to load photo');

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function deleteProgressPhoto(photo: ProgressPhoto): Promise<void> {
  await apiClient.delete(`/measurements/photos/${photo.id}`);
}
