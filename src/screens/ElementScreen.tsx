import { useTranslation } from 'react-i18next';
import { ConditionSelector } from '@/components/ConditionSelector';
import {
  translate,
  type ElementCondition,
  type ElementDefinition,
  type Language,
  type Photo,
  type RoomElement,
} from '@/domain/types';

/**
 * Flow B, step 2: one element at a time.
 *
 * The fast path is deliberately one tap. Tapping "good" fills in the template's
 * default wording, asks for no photo and moves on — most elements in most
 * inspections are fine, and making that case cost more than a tap is what makes
 * an app slower than a notepad.
 *
 * Anything worse than good opens the description field and requires a photo
 * before the room can count as finished.
 */
export function ElementScreen({
  definition,
  element,
  photos,
  roomName,
  position,
  total,
  reportLanguage,
  onSelectCondition,
  onDescriptionChange,
  onSubAttributeChange,
  onTakePhoto,
  onRemovePhoto,
  onPrevious,
  onNext,
}: {
  definition: ElementDefinition;
  element: RoomElement;
  photos: Photo[];
  roomName: string;
  position: number;
  total: number;
  /** The inspection's language, which may differ from the interface language. */
  reportLanguage: Language;
  onSelectCondition: (condition: ElementCondition) => void;
  onDescriptionChange: (description: string) => void;
  onSubAttributeChange: (key: string, value: string) => void;
  onTakePhoto: () => void;
  onRemovePhoto: (photoId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();

  const needsPhoto = element.condition
    ? definition.requires_photo_if.includes(element.condition)
    : false;
  const photoMissing = needsPhoto && photos.length === 0;
  const showsDescription = element.condition !== null && element.condition !== 'not_applicable';

  return (
    <>
      <div className="app-content">
        {/* The room name lives here rather than in the header: next to the
            language toggle and the sync status it would truncate to nothing on
            a phone, and there is room for it above the element name. */}
        <p className="progress__label">
          {roomName} · {t('element.counter', { current: position, total })}
        </p>
        <h1 style={{ marginBottom: 16 }}>
          {translate(definition.label_translations, reportLanguage)}
        </h1>

        <ConditionSelector
          value={element.condition}
          allowed={definition.condition_options}
          onChange={onSelectCondition}
        />

        {photoMissing && (
          <p className="notice notice--required" role="status" style={{ marginTop: 16 }}>
            {t('element.photoRequired')}
          </p>
        )}

        {showsDescription && (
          <>
            {/* The camera comes before the description when a photo is required:
                Flow B asks for the photo button to be prominent, and making the
                inspector scroll past a text field to reach the mandatory step is
                the opposite of that. */}
            <div className="photo-strip">
              {photos.map((photo) => (
                <div key={photo.id} className="photo-thumb">
                  {photo.local_path && <img src={photo.local_path} alt="" />}
                  <button
                    type="button"
                    className="photo-thumb__remove"
                    aria-label={t('element.removePhoto')}
                    onClick={() => onRemovePhoto(photo.id)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="button"
              onClick={onTakePhoto}
              style={{
                width: '100%',
                minHeight: 'var(--touch-primary)',
                marginBottom: 16,
                ...(photoMissing
                  ? {
                      borderColor: 'var(--color-condition-damaged)',
                      borderWidth: 3,
                    }
                  : {}),
              }}
            >
              {t('element.addPhoto')}
              {photos.length > 0 && ` · ${t('element.photoCount', { count: photos.length })}`}
            </button>

            <div className="field">
              <label className="field__label" htmlFor="element-description">
                {t('element.description')}
              </label>
              <textarea
                id="element-description"
                className="field__textarea"
                value={element.description ?? ''}
                placeholder={t('element.descriptionPlaceholder')}
                onChange={(event) => onDescriptionChange(event.target.value)}
              />
            </div>

            {/* Sub-attributes stay collapsed: useful, but never in the way of
                the fast path (Flow B, step 2). */}
            {definition.sub_attributes.length > 0 && (
              <details className="disclosure" style={{ marginTop: 16 }}>
                <summary>
                  {t('element.subAttributes')} · {t('common.optional')}
                </summary>
                <div className="disclosure__body">
                  {definition.sub_attributes.map((attribute) => {
                    const id = `sub-${attribute.key}`;
                    const value = String(element.sub_attribute_values[attribute.key] ?? '');

                    return (
                      <div className="field" key={attribute.key}>
                        <label className="field__label" htmlFor={id}>
                          {translate(attribute.label_translations, reportLanguage)}
                        </label>
                        {attribute.type === 'select' ? (
                          <select
                            id={id}
                            className="field__select"
                            value={value}
                            onChange={(event) =>
                              onSubAttributeChange(attribute.key, event.target.value)
                            }
                          >
                            <option value="">—</option>
                            {attribute.options?.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={id}
                            className="field__input"
                            type={attribute.type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(event) =>
                              onSubAttributeChange(attribute.key, event.target.value)
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="button"
          onClick={onPrevious}
          disabled={position === 1}
          style={{ minHeight: 'var(--touch-primary)' }}
        >
          {t('common.previous')}
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={onNext}
          disabled={element.condition === null}
        >
          {position === total ? t('element.nextRoom') : t('element.nextElement')}
        </button>
      </div>
    </>
  );
}
