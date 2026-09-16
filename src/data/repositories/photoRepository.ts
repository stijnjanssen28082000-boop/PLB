import type { SqlDriver } from '@/data/db/driver';
import type { Photo, UploadStatus } from '@/domain/types';
import { refreshRoomCompletion } from './inspectionRepository';
import { enqueueFileUpload, softDeleteRow, upsertRow, utcNow, type WriteContext } from './persist';

const ACTIVE = 'deleted_at is null';

export async function listPhotosForElement(db: SqlDriver, elementId: string): Promise<Photo[]> {
  const rows = await db.query(
    `select * from photos where room_element_id = ? and ${ACTIVE} order by sort_order`,
    [elementId],
  );
  return rows.map(mapPhoto);
}

/**
 * Records a photo and queues its file.
 *
 * Two queue rows on purpose: the metadata row syncs with the rest of the data,
 * the file follows separately, because the sync order is data first and files
 * after (docs/datamodel.md 3.16). sha256 is computed over the *compressed*
 * file, since that is the file that is kept (§6.7).
 */
export async function addPhoto(
  db: SqlDriver,
  input: {
    id: string;
    organizationId: string;
    inspectionId: string;
    roomId: string | null;
    roomElementId: string | null;
    localPath: string;
    sha256: string;
    takenAt: string;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    gpsLat?: number | null;
    gpsLng?: number | null;
    sortOrder: number;
  },
  context: WriteContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await upsertRow(
      tx,
      'photos',
      {
        id: input.id,
        organization_id: input.organizationId,
        inspection_id: input.inspectionId,
        room_id: input.roomId,
        room_element_id: input.roomElementId,
        local_path: input.localPath,
        sha256: input.sha256,
        taken_at: input.takenAt,
        file_size_bytes: input.fileSizeBytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        gps_lat: input.gpsLat ?? null,
        gps_lng: input.gpsLng ?? null,
        mime_type: 'image/jpeg',
        sort_order: input.sortOrder,
        upload_status: 'pending',
        upload_attempts: 0,
      },
      context,
    );

    await enqueueFileUpload(tx, 'photos', input.id, input.localPath, context);

    // A photo can be what makes a room complete: an element marked `damaged`
    // is not finished until its photo exists.
    if (input.roomId) {
      await refreshRoomCompletion(tx, input.roomId, context);
    }
  });
}

/** Removes a photo taken by mistake. Soft delete: nothing is ever really gone. */
export async function removePhoto(
  db: SqlDriver,
  photoId: string,
  context: WriteContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.query<{ room_id: string | null }>(
      'select room_id from photos where id = ?',
      [photoId],
    );

    await softDeleteRow(tx, 'photos', photoId, context);

    // Removing the only photo of a damaged element makes its room incomplete again.
    if (row?.room_id) {
      await refreshRoomCompletion(tx, row.room_id, context);
    }
  });
}

export async function markUploadStatus(
  db: SqlDriver,
  photoId: string,
  status: UploadStatus,
  context: WriteContext,
): Promise<void> {
  await upsertRow(
    db,
    'photos',
    { id: photoId, upload_status: status, updated_at: (context.now ?? utcNow)() },
    context,
  );
}

function mapPhoto(row: Record<string, unknown>): Photo {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    inspection_id: String(row.inspection_id),
    room_id: (row.room_id as string) ?? null,
    room_element_id: (row.room_element_id as string) ?? null,
    meter_reading_id: (row.meter_reading_id as string) ?? null,
    local_path: (row.local_path as string) ?? null,
    storage_path: (row.storage_path as string) ?? null,
    thumbnail_storage_path: (row.thumbnail_storage_path as string) ?? null,
    file_size_bytes: (row.file_size_bytes as number) ?? null,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    mime_type: String(row.mime_type),
    sha256: String(row.sha256),
    taken_at: String(row.taken_at),
    gps_lat: (row.gps_lat as number) ?? null,
    gps_lng: (row.gps_lng as number) ?? null,
    caption: (row.caption as string) ?? null,
    sort_order: Number(row.sort_order),
    photo_number: (row.photo_number as number) ?? null,
    upload_status: row.upload_status as UploadStatus,
    upload_attempts: Number(row.upload_attempts),
  };
}
