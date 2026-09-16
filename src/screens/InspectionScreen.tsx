import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@/app/DatabaseProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SyncIndicator } from '@/components/SyncIndicator';
import {
  addRoom,
  getInspection,
  listRoomElements,
  listRoomTemplates,
  listRooms,
  setElementCondition,
  setElementSubAttributes,
} from '@/data/repositories/inspectionRepository';
import { addPhoto, listPhotosForElement, removePhoto } from '@/data/repositories/photoRepository';
import { upsertRow } from '@/data/repositories/persist';
import { capturePhoto } from '@/platform/camera';
import { newId } from '@/platform/device';
import {
  translate,
  type ElementCondition,
  type Inspection,
  type Photo,
  type Room,
  type RoomElement,
  type RoomTemplate,
} from '@/domain/types';
import { ElementScreen } from './ElementScreen';
import { RoomOverviewScreen, type RoomProgress } from './RoomOverviewScreen';

type View = { name: 'rooms' } | { name: 'element'; roomId: string; index: number };

/**
 * Flow B end to end: the room list, and one element at a time inside a room.
 *
 * C.2 principle 7 — the inspector gets called away and comes back. Every change
 * is written through the repository the moment it is made, so there is no draft
 * state that a closed app could lose.
 */
export function InspectionScreen({ inspectionId }: { inspectionId: string }) {
  const { t } = useTranslation();
  const { db, writeContext } = useDatabase();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [templates, setTemplates] = useState<RoomTemplate[]>([]);
  const [elementsByRoom, setElementsByRoom] = useState<Record<string, RoomElement[]>>({});
  const [photosByElement, setPhotosByElement] = useState<Record<string, Photo[]>>({});
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [view, setView] = useState<View>({ name: 'rooms' });

  const refresh = useCallback(async () => {
    const loaded = await getInspection(db, inspectionId);
    if (!loaded) return;

    const loadedRooms = await listRooms(db, inspectionId);
    const elements: Record<string, RoomElement[]> = {};
    for (const room of loadedRooms) {
      elements[room.id] = await listRoomElements(db, room.id);
    }

    const [queue] = await db.query<{ pending: number }>(
      `select count(*) as pending from sync_queue where status = 'pending'`,
    );

    setInspection(loaded);
    setRooms(loadedRooms);
    setElementsByRoom(elements);
    setTemplates(await listRoomTemplates(db, loaded.organization_id));
    setPendingSyncCount(queue?.pending ?? 0);
  }, [db, inspectionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const templatesById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const roomProgress = useMemo<RoomProgress[]>(
    () =>
      rooms.map((room) => {
        const elements = elementsByRoom[room.id] ?? [];
        return {
          room,
          remaining: elements.filter((element) => element.condition === null).length,
          total: elements.length,
        };
      }),
    [rooms, elementsByRoom],
  );

  const handleAddRoom = useCallback(async () => {
    if (!inspection) return;

    // Flow B step 1 asks for a clear "add room" for non-standard rooms. The
    // picker itself is the next screen to build; this adds a bedroom so the
    // flow is walkable end to end.
    const template = templates.find((candidate) => candidate.room_type === 'bedroom') ?? templates[0];
    if (!template) return;

    const name = translate(template.name_translations, inspection.language);
    await addRoom(
      db,
      {
        id: newId(),
        inspectionId,
        template,
        name: `${name} ${rooms.length + 1}`,
        sortOrder: rooms.length + 1,
        elementIds: template.elements.map(() => newId()),
      },
      writeContext,
    );

    await refresh();
  }, [db, inspection, inspectionId, refresh, rooms.length, templates, writeContext]);

  const loadPhotos = useCallback(
    async (elementId: string) => {
      setPhotosByElement((current) => ({ ...current, [elementId]: [] }));
      const loaded = await listPhotosForElement(db, elementId);
      setPhotosByElement((current) => ({ ...current, [elementId]: loaded }));
    },
    [db],
  );

  const openRoom = useCallback(
    async (roomId: string) => {
      const elements = elementsByRoom[roomId] ?? [];
      // Resume where the room was left off rather than at the top: the inspector
      // may be returning after an interruption (C.2 principle 7).
      const firstUnanswered = elements.findIndex((element) => element.condition === null);
      const index = firstUnanswered === -1 ? 0 : firstUnanswered;

      const element = elements[index];
      if (element) await loadPhotos(element.id);
      setView({ name: 'element', roomId, index });
    },
    [elementsByRoom, loadPhotos],
  );

  if (!inspection) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <p className="empty-state">{t('errors.notFound')}</p>
        </div>
      </div>
    );
  }

  const header = (
    <header className="app-header">
      <div className="app-header__title">{t('rooms.title')}</div>
      <LanguageToggle />
      <SyncIndicator pendingCount={pendingSyncCount} />
    </header>
  );

  if (view.name === 'rooms') {
    return (
      <div className="app-shell">
        {header}
        <RoomOverviewScreen
          rooms={roomProgress}
          onOpenRoom={(roomId) => void openRoom(roomId)}
          onAddRoom={() => void handleAddRoom()}
        />
      </div>
    );
  }

  const room = rooms.find((candidate) => candidate.id === view.roomId);
  const elements = elementsByRoom[view.roomId] ?? [];
  const element = elements[view.index];
  const template = room ? templatesById.get(room.room_template_id) : undefined;
  const definition = template?.elements.find(
    (candidate) => candidate.key === element?.element_key,
  );

  if (!room || !element || !definition) {
    return (
      <div className="app-shell">
        {header}
        <div className="app-content">
          <p className="empty-state">{t('errors.notFound')}</p>
        </div>
      </div>
    );
  }

  const goToIndex = async (index: number) => {
    const target = elements[index];
    if (target) await loadPhotos(target.id);
    setView({ name: 'element', roomId: view.roomId, index });
  };

  const handleSelectCondition = async (condition: ElementCondition) => {
    // Flow B: choosing "good" fills in the template's standard wording, so the
    // common case really is a single tap.
    const usesDefault = condition === 'good';
    const description = usesDefault
      ? translate(definition.default_description_translations, inspection.language)
      : (element.description ?? '');

    await setElementCondition(
      db,
      {
        elementId: element.id,
        roomId: room.id,
        condition,
        description,
        descriptionSource: usesDefault ? 'default' : 'manual',
      },
      writeContext,
    );
    await refresh();
  };

  const handleTakePhoto = async () => {
    const captured = await capturePhoto();
    if (!captured) return;

    await addPhoto(
      db,
      {
        id: newId(),
        organizationId: inspection.organization_id,
        inspectionId,
        roomId: room.id,
        roomElementId: element.id,
        localPath: captured.localPath,
        sha256: captured.sha256,
        takenAt: captured.takenAt,
        fileSizeBytes: captured.fileSizeBytes,
        width: captured.width,
        height: captured.height,
        sortOrder: (photosByElement[element.id]?.length ?? 0) + 1,
      },
      writeContext,
    );

    await loadPhotos(element.id);
    await refresh();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="button button--ghost app-header__back"
          onClick={() => setView({ name: 'rooms' })}
          aria-label={t('common.back')}
          style={{ color: 'inherit' }}
        >
          <span aria-hidden="true">‹</span>
        </button>
        {/* No title here: the element name is the h1 just below, and a second
            copy next to the controls would only truncate. */}
        <div className="app-header__title" />
        <LanguageToggle />
        <SyncIndicator pendingCount={pendingSyncCount} />
      </header>

      <ElementScreen
        definition={definition}
        element={element}
        photos={photosByElement[element.id] ?? []}
        roomName={room.name}
        position={view.index + 1}
        total={elements.length}
        reportLanguage={inspection.language}
        onSelectCondition={(condition) => void handleSelectCondition(condition)}
        onDescriptionChange={(description) => {
          void (async () => {
            await upsertRow(
              db,
              'room_elements',
              {
                id: element.id,
                room_id: room.id,
                description,
                description_source: 'manual',
                device_id: writeContext.deviceId,
                client_updated_at: new Date().toISOString(),
              },
              writeContext,
            );
            await refresh();
          })();
        }}
        onSubAttributeChange={(key, value) => {
          void (async () => {
            await setElementSubAttributes(
              db,
              {
                elementId: element.id,
                roomId: room.id,
                values: { ...element.sub_attribute_values, [key]: value },
              },
              writeContext,
            );
            await refresh();
          })();
        }}
        onTakePhoto={() => void handleTakePhoto()}
        onRemovePhoto={(photoId) => {
          void (async () => {
            await removePhoto(db, photoId, writeContext);
            await loadPhotos(element.id);
            await refresh();
          })();
        }}
        onPrevious={() => void goToIndex(view.index - 1)}
        onNext={() => {
          if (view.index + 1 < elements.length) {
            void goToIndex(view.index + 1);
          } else {
            setView({ name: 'rooms' });
          }
        }}
      />
    </div>
  );
}
