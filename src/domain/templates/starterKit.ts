import type { ElementDefinition, RoomTemplate, Translations } from '@/domain/types';
import { BASE_ELEMENTS, EXTENSION_ELEMENTS } from './elementLibrary';

/**
 * The global starter kit (docs/datamodel.md 3.5 / 3.5d): room_templates rows with
 * organization_id = NULL, readable by every organization and editable by none.
 * A customer duplicates one of these into their own row to change it.
 *
 * The ids are fixed so the seed is idempotent and a local copy keeps matching the
 * server row.
 */

const t = (nl: string, fr: string, en: string): Translations => ({ nl, fr, en });

/** Outdoor spaces have no walls/ceiling, so they skip the base set (3.5d). */
const OUTDOOR_ROOM_TYPES = new Set([
  'terrace',
  'balcony',
  'garden',
  'exterior',
]);

interface RoomTypeSeed {
  room_type: string;
  uuid: string;
  name: Translations;
  extensions: string[];
}

const ROOM_TYPES: RoomTypeSeed[] = [
  {
    room_type: 'entrance_hall',
    uuid: '00000000-0000-4000-8000-000000000001',
    name: t('Inkomhal', 'Hall d’entrée', 'Entrance hall'),
    extensions: ['front_door', 'intercom', 'mailbox', 'alarm_system'],
  },
  {
    room_type: 'living_room',
    uuid: '00000000-0000-4000-8000-000000000002',
    name: t('Woonkamer', 'Salon', 'Living room'),
    extensions: [],
  },
  {
    room_type: 'kitchen',
    uuid: '00000000-0000-4000-8000-000000000003',
    name: t('Keuken', 'Cuisine', 'Kitchen'),
    extensions: [
      'countertop', 'cabinets', 'sink_faucet', 'hob', 'oven', 'extractor_hood',
      'dishwasher', 'fridge', 'freezer', 'water_connection', 'gas_connection',
    ],
  },
  {
    room_type: 'bedroom',
    uuid: '00000000-0000-4000-8000-000000000004',
    name: t('Slaapkamer', 'Chambre', 'Bedroom'),
    extensions: ['built_in_wardrobe'],
  },
  {
    room_type: 'bathroom',
    uuid: '00000000-0000-4000-8000-000000000005',
    name: t('Badkamer', 'Salle de bains', 'Bathroom'),
    extensions: [
      'shower', 'bathtub', 'washbasin', 'faucets', 'toilet_unit', 'mirror',
      'tiling', 'sealant_joints', 'water_heater',
    ],
  },
  {
    room_type: 'toilet',
    uuid: '00000000-0000-4000-8000-000000000006',
    name: t('Toilet', 'WC', 'Toilet'),
    extensions: ['toilet_unit', 'hand_basin', 'tiling'],
  },
  {
    room_type: 'hallway',
    uuid: '00000000-0000-4000-8000-000000000007',
    name: t('Gang', 'Couloir', 'Hallway'),
    extensions: [],
  },
  {
    room_type: 'storage',
    uuid: '00000000-0000-4000-8000-000000000008',
    name: t('Berging', 'Débarras', 'Storage'),
    extensions: [],
  },
  {
    room_type: 'laundry',
    uuid: '00000000-0000-4000-8000-000000000009',
    name: t('Wasruimte', 'Buanderie', 'Laundry room'),
    extensions: ['washing_machine_connection', 'dryer_connection', 'sink'],
  },
  {
    room_type: 'office',
    uuid: '00000000-0000-4000-8000-00000000000a',
    name: t('Bureau', 'Bureau', 'Office'),
    extensions: [],
  },
  {
    room_type: 'garage',
    uuid: '00000000-0000-4000-8000-00000000000b',
    name: t('Garage', 'Garage', 'Garage'),
    extensions: ['garage_door'],
  },
  {
    room_type: 'cellar',
    uuid: '00000000-0000-4000-8000-00000000000c',
    name: t('Kelder', 'Cave', 'Cellar'),
    extensions: ['moisture_signs', 'insulation_visible'],
  },
  {
    room_type: 'attic',
    uuid: '00000000-0000-4000-8000-00000000000d',
    name: t('Zolder', 'Grenier', 'Attic'),
    extensions: ['moisture_signs', 'insulation_visible'],
  },
  {
    room_type: 'terrace',
    uuid: '00000000-0000-4000-8000-00000000000e',
    name: t('Terras', 'Terrasse', 'Terrace'),
    extensions: ['flooring', 'railing', 'drainage'],
  },
  {
    room_type: 'balcony',
    uuid: '00000000-0000-4000-8000-00000000000f',
    name: t('Balkon', 'Balcon', 'Balcony'),
    extensions: ['flooring', 'railing', 'drainage'],
  },
  {
    room_type: 'garden',
    uuid: '00000000-0000-4000-8000-000000000010',
    name: t('Tuin', 'Jardin', 'Garden'),
    extensions: ['lawn', 'plants_trees', 'fencing', 'garden_shed', 'paving'],
  },
  {
    room_type: 'exterior',
    uuid: '00000000-0000-4000-8000-000000000011',
    name: t('Buitenzijde', 'Extérieur', 'Exterior'),
    extensions: ['facade', 'roof_visible', 'gutters', 'garage_door', 'driveway'],
  },
  {
    room_type: 'common_area',
    uuid: '00000000-0000-4000-8000-000000000012',
    name: t('Gemeenschappelijke ruimte', 'Partie commune', 'Common area'),
    extensions: [],
  },
  {
    room_type: 'technical_room',
    uuid: '00000000-0000-4000-8000-000000000013',
    name: t('Technische ruimte', 'Local technique', 'Technical room'),
    extensions: ['boiler', 'electrical_panel', 'water_meter_location', 'fuse_box'],
  },
  {
    room_type: 'other',
    uuid: '00000000-0000-4000-8000-000000000014',
    name: t('Andere ruimte', 'Autre pièce', 'Other room'),
    extensions: [],
  },
];

function buildElements(seed: RoomTypeSeed): ElementDefinition[] {
  const elements: ElementDefinition[] = [];
  let order = 1;

  if (!OUTDOOR_ROOM_TYPES.has(seed.room_type)) {
    for (const base of BASE_ELEMENTS) {
      elements.push({ ...base, category: 'base', sort_order: order++ });
    }
  }

  for (const key of seed.extensions) {
    const extension = EXTENSION_ELEMENTS[key];
    if (!extension) {
      throw new Error(`Unknown extension element "${key}" for room type "${seed.room_type}"`);
    }
    elements.push({ ...extension, category: 'extension', sort_order: order++ });
  }

  return elements;
}

export const GLOBAL_ROOM_TEMPLATES: RoomTemplate[] = ROOM_TYPES.map((seed, index) => ({
  id: seed.uuid,
  organization_id: null,
  country: 'ALL',
  room_type: seed.room_type,
  name_translations: seed.name,
  version: 1,
  is_active: true,
  elements: buildElements(seed),
  sort_order: index + 1,
}));
