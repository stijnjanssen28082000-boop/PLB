/**
 * Types mirroring docs/datamodel.md. Enums are string unions, not TypeScript
 * enums, because the datamodel stores them as text so local SQLite and Postgres
 * stay identical.
 */

export type Language = 'nl' | 'fr' | 'en';
export const LANGUAGES: readonly Language[] = ['nl', 'fr', 'en'];

/**
 * A translated value. NL is required: when a language is missing the app falls
 * back to NL and never shows an empty string (docs/datamodel.md 3.5).
 */
export type Translations = { nl: string } & Partial<Record<Language, string>>;

export type Country = 'BE' | 'FR';
export type Region = 'vlaanderen' | 'brussel' | 'wallonie';

export type UserRole = 'admin' | 'dispatcher' | 'plaatsbeschrijver' | 'viewer';

export type InspectionType = 'entry' | 'exit' | 'interim';

export type InspectionStatus =
  | 'draft'
  | 'in_progress'
  | 'awaiting_signatures'
  | 'signed'
  | 'pending_sync'
  | 'synced'
  | 'ai_processing'
  | 'review'
  | 'approved'
  | 'sent'
  | 'archived';

export type ElementCondition =
  | 'good'
  | 'traces_of_use'
  | 'damaged'
  | 'not_applicable'
  | 'not_inspected';

/** The conditions the inspector picks in Flow B, in their fixed on-screen order. */
export const SELECTABLE_CONDITIONS: readonly ElementCondition[] = [
  'good',
  'traces_of_use',
  'damaged',
  'not_applicable',
];

export type DescriptionSource = 'manual' | 'default' | 'ai_accepted' | 'ai_edited';

export type Liability = 'tenant' | 'landlord' | 'normal_wear' | 'undetermined';

export type SyncConflictStatus = 'none' | 'pending_review' | 'resolved';

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type SubAttributeType = 'text' | 'select' | 'number' | 'boolean';

export interface SubAttributeDefinition {
  key: string;
  label_translations: Translations;
  type: SubAttributeType;
  options?: string[];
}

export interface ElementDefinition {
  key: string;
  label_translations: Translations;
  /** `base` appears in every room type, `extension` is specific to one. */
  category: 'base' | 'extension';
  sort_order: number;
  condition_options: ElementCondition[];
  /** At least one photo is required before the room may count as completed. */
  requires_photo_if: ElementCondition[];
  sub_attributes: SubAttributeDefinition[];
  /** Filled in automatically when the condition is `good`; editable. */
  default_description_translations: Translations;
}

export interface RoomTemplate {
  id: string;
  organization_id: string | null;
  country: Country | 'ALL';
  room_type: string;
  name_translations: Translations;
  version: number;
  is_active: boolean;
  elements: ElementDefinition[];
  sort_order: number;
}

export interface Room {
  id: string;
  inspection_id: string;
  room_template_id: string;
  room_template_version: number;
  name: string;
  sort_order: number;
  floor_level: string | null;
  is_completed: boolean;
  general_notes: string | null;
  linked_room_id: string | null;
}

export interface RoomElement {
  id: string;
  room_id: string;
  element_key: string;
  condition: ElementCondition | null;
  description: string | null;
  description_source: DescriptionSource | null;
  sub_attribute_values: Record<string, string | number | boolean>;
  linked_element_id: string | null;
  has_change_vs_linked: boolean | null;
  change_description: string | null;
  liability: Liability | null;
  sort_order: number;
  device_id: string;
  client_updated_at: string;
  sync_conflict_status: SyncConflictStatus;
}

export interface Photo {
  id: string;
  organization_id: string;
  inspection_id: string;
  room_id: string | null;
  room_element_id: string | null;
  meter_reading_id: string | null;
  local_path: string | null;
  storage_path: string | null;
  thumbnail_storage_path: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  sha256: string;
  taken_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  caption: string | null;
  sort_order: number;
  photo_number: number | null;
  upload_status: UploadStatus;
  upload_attempts: number;
}

export interface Inspection {
  id: string;
  organization_id: string;
  property_id: string;
  type: InspectionType;
  linked_inspection_id: string | null;
  status: InspectionStatus;
  inspector_user_id: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  locked_at: string | null;
  language: Language;
  template_set_version: number;
  general_notes: string | null;
  weather_conditions: string | null;
  is_furnished: boolean | null;
  lease_contract_date: string | null;
  lease_start_date: string | null;
  street_side_facade: 'north' | 'east' | 'south' | 'west' | null;
  device_id: string;
}

export interface Property {
  id: string;
  organization_id: string;
  external_reference: string | null;
  street: string;
  house_number: string;
  box: string | null;
  postal_code: string;
  city: string;
  country: Country;
  region: Region | null;
  property_type: 'apartment' | 'house' | 'studio' | 'commercial' | 'garage' | 'other';
  floor: string | null;
  notes: string | null;
}

/** Resolve a translated value, falling back to NL — never to an empty string. */
export function translate(value: Translations | null | undefined, language: Language): string {
  if (!value) return '';
  return value[language]?.trim() || value.nl;
}
