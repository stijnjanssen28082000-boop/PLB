import type { ElementDefinition, SubAttributeDefinition, Translations } from '@/domain/types';

/**
 * The global element library (docs/datamodel.md 3.5d). An organization picks
 * from these or types its own name, so this list is a starting point and never
 * a limit.
 */

const t = (nl: string, fr: string, en: string): Translations => ({ nl, fr, en });

const MATERIAL: SubAttributeDefinition = {
  key: 'material',
  label_translations: t('Materiaal', 'Matériau', 'Material'),
  type: 'select',
  options: ['paint', 'wallpaper', 'tiles', 'plaster', 'wood', 'other'],
};

const COLOR: SubAttributeDefinition = {
  key: 'color',
  label_translations: t('Kleur', 'Couleur', 'Colour'),
  type: 'text',
};

const FLOOR_MATERIAL: SubAttributeDefinition = {
  key: 'material',
  label_translations: t('Materiaal', 'Matériau', 'Material'),
  type: 'select',
  options: ['tiles', 'laminate', 'parquet', 'vinyl', 'carpet', 'concrete', 'other'],
};

const QUANTITY: SubAttributeDefinition = {
  key: 'quantity',
  label_translations: t('Aantal', 'Nombre', 'Quantity'),
  type: 'number',
};

const WORKS: SubAttributeDefinition = {
  key: 'works',
  label_translations: t('Werkend', 'Fonctionne', 'Working'),
  type: 'boolean',
};

/** Conditions that make at least one photo mandatory before a room can complete. */
const PHOTO_ON_DEVIATION = ['traces_of_use', 'damaged'] as const;

type ElementSeed = {
  key: string;
  labels: Translations;
  defaults: Translations;
  subAttributes?: SubAttributeDefinition[];
};

function define({ key, labels, defaults, subAttributes }: ElementSeed): Omit<ElementDefinition, 'category' | 'sort_order'> {
  return {
    key,
    label_translations: labels,
    condition_options: ['good', 'traces_of_use', 'damaged', 'not_applicable'],
    requires_photo_if: [...PHOTO_ON_DEVIATION],
    sub_attributes: subAttributes ?? [],
    default_description_translations: defaults,
  };
}

/**
 * Walls are described per compass direction, each with its own photos and text —
 * a real report does not combine them into one "walls" element. Fixed convention,
 * taken literally from the report: the street side is called the north wall,
 * whatever the actual compass direction (docs/datamodel.md 3.5d).
 */
const WALL_DEFAULTS = t(
  'Muur in goede staat, geen zichtbare beschadigingen.',
  'Mur en bon état, sans dégradation visible.',
  'Wall in good condition, no visible damage.',
);

export const BASE_ELEMENTS: Array<Omit<ElementDefinition, 'category' | 'sort_order'>> = [
  define({
    key: 'wall_north',
    labels: t('Noordmuur (straatzijde)', 'Mur nord (côté rue)', 'North wall (street side)'),
    defaults: WALL_DEFAULTS,
    subAttributes: [MATERIAL, COLOR],
  }),
  define({
    key: 'wall_east',
    labels: t('Oostmuur', 'Mur est', 'East wall'),
    defaults: WALL_DEFAULTS,
    subAttributes: [MATERIAL, COLOR],
  }),
  define({
    key: 'wall_south',
    labels: t('Zuidmuur', 'Mur sud', 'South wall'),
    defaults: WALL_DEFAULTS,
    subAttributes: [MATERIAL, COLOR],
  }),
  define({
    key: 'wall_west',
    labels: t('Westmuur', 'Mur ouest', 'West wall'),
    defaults: WALL_DEFAULTS,
    subAttributes: [MATERIAL, COLOR],
  }),
  define({
    key: 'ceiling',
    labels: t('Plafond', 'Plafond', 'Ceiling'),
    defaults: t(
      'Plafond in goede staat, geen zichtbare beschadigingen of vochtsporen.',
      'Plafond en bon état, sans dégradation ni trace d’humidité visible.',
      'Ceiling in good condition, no visible damage or damp marks.',
    ),
    subAttributes: [MATERIAL, COLOR],
  }),
  define({
    key: 'floor',
    labels: t('Vloer', 'Sol', 'Floor'),
    defaults: t(
      'Vloer in goede staat, geen zichtbare beschadigingen.',
      'Sol en bon état, sans dégradation visible.',
      'Floor in good condition, no visible damage.',
    ),
    subAttributes: [FLOOR_MATERIAL, COLOR],
  }),
  define({
    key: 'skirting_boards',
    labels: t('Plinten', 'Plinthes', 'Skirting boards'),
    defaults: t(
      'Plinten in goede staat, volledig aanwezig en goed bevestigd.',
      'Plinthes en bon état, complètes et bien fixées.',
      'Skirting boards in good condition, complete and properly fixed.',
    ),
  }),
  define({
    key: 'doors',
    labels: t('Deuren', 'Portes', 'Doors'),
    defaults: t(
      'Deur in goede staat, sluit en vergrendelt correct.',
      'Porte en bon état, ferme et verrouille correctement.',
      'Door in good condition, closes and locks correctly.',
    ),
    subAttributes: [QUANTITY, MATERIAL],
  }),
  define({
    key: 'windows',
    labels: t('Ramen', 'Fenêtres', 'Windows'),
    defaults: t(
      'Raam in goede staat, opent en sluit correct, beglazing zonder barsten.',
      'Fenêtre en bon état, ouvre et ferme correctement, vitrage sans fissure.',
      'Window in good condition, opens and closes correctly, glazing free of cracks.',
    ),
    subAttributes: [QUANTITY, MATERIAL],
  }),
  define({
    key: 'window_coverings',
    labels: t('Raambekleding', 'Habillage de fenêtre', 'Window coverings'),
    defaults: t(
      'Raambekleding aanwezig en in goede staat, werkt correct.',
      'Habillage de fenêtre présent et en bon état, fonctionne correctement.',
      'Window coverings present and in good condition, operating correctly.',
    ),
    subAttributes: [QUANTITY],
  }),
  define({
    key: 'sockets_switches',
    labels: t('Stopcontacten en schakelaars', 'Prises et interrupteurs', 'Sockets and switches'),
    defaults: t(
      'Stopcontacten en schakelaars aanwezig en onbeschadigd.',
      'Prises et interrupteurs présents et non endommagés.',
      'Sockets and switches present and undamaged.',
    ),
    subAttributes: [QUANTITY],
  }),
  define({
    key: 'lighting',
    labels: t('Verlichting', 'Éclairage', 'Lighting'),
    defaults: t(
      'Verlichtingspunt aanwezig en werkend.',
      'Point lumineux présent et fonctionnel.',
      'Light fitting present and working.',
    ),
    subAttributes: [QUANTITY, WORKS],
  }),
  define({
    key: 'heating',
    labels: t('Verwarming', 'Chauffage', 'Heating'),
    defaults: t(
      'Verwarmingselement aanwezig, geen zichtbare lekkage of beschadiging.',
      'Élément de chauffage présent, sans fuite ni dégradation visible.',
      'Heating unit present, no visible leak or damage.',
    ),
    subAttributes: [QUANTITY, WORKS],
  }),
  define({
    key: 'ventilation',
    labels: t('Ventilatie', 'Ventilation', 'Ventilation'),
    defaults: t(
      'Ventilatievoorziening aanwezig en onbelemmerd.',
      'Dispositif de ventilation présent et non obstrué.',
      'Ventilation provision present and unobstructed.',
    ),
  }),
];

/** Extension elements, keyed so a room type can pull the ones it needs. */
export const EXTENSION_ELEMENTS: Record<string, Omit<ElementDefinition, 'category' | 'sort_order'>> = Object.fromEntries(
  (
    [
      ['countertop', t('Werkblad', 'Plan de travail', 'Countertop'), [MATERIAL]],
      ['cabinets', t('Keukenkasten', 'Armoires de cuisine', 'Kitchen cabinets'), [QUANTITY, MATERIAL]],
      ['sink_faucet', t('Spoelbak en kraan', 'Évier et robinet', 'Sink and tap'), [WORKS]],
      ['hob', t('Kookplaat', 'Plaque de cuisson', 'Hob'), [WORKS]],
      ['oven', t('Oven', 'Four', 'Oven'), [WORKS]],
      ['extractor_hood', t('Dampkap', 'Hotte', 'Extractor hood'), [WORKS]],
      ['dishwasher', t('Vaatwasser', 'Lave-vaisselle', 'Dishwasher'), [WORKS]],
      ['fridge', t('Koelkast', 'Réfrigérateur', 'Fridge'), [WORKS]],
      ['freezer', t('Diepvriezer', 'Congélateur', 'Freezer'), [WORKS]],
      ['water_connection', t('Wateraansluiting', 'Raccordement d’eau', 'Water connection'), []],
      ['gas_connection', t('Gasaansluiting', 'Raccordement de gaz', 'Gas connection'), []],
      ['shower', t('Douche', 'Douche', 'Shower'), [WORKS]],
      ['bathtub', t('Bad', 'Baignoire', 'Bathtub'), [WORKS]],
      ['washbasin', t('Wastafel', 'Lavabo', 'Washbasin'), [WORKS]],
      ['faucets', t('Kranen', 'Robinetterie', 'Taps'), [QUANTITY, WORKS]],
      ['toilet_unit', t('Toilet', 'WC', 'Toilet'), [WORKS]],
      ['mirror', t('Spiegel', 'Miroir', 'Mirror'), []],
      ['tiling', t('Betegeling', 'Carrelage', 'Tiling'), [COLOR]],
      ['sealant_joints', t('Siliconevoegen', 'Joints silicone', 'Sealant joints'), []],
      ['water_heater', t('Boiler', 'Chauffe-eau', 'Water heater'), [WORKS]],
      ['hand_basin', t('Handwasbakje', 'Lave-mains', 'Hand basin'), [WORKS]],
      ['washing_machine_connection', t('Aansluiting wasmachine', 'Raccordement lave-linge', 'Washing machine connection'), []],
      ['dryer_connection', t('Aansluiting droogkast', 'Raccordement sèche-linge', 'Dryer connection'), []],
      ['sink', t('Uitgietbak', 'Évier', 'Utility sink'), [WORKS]],
      ['built_in_wardrobe', t('Ingebouwde kast', 'Armoire encastrée', 'Built-in wardrobe'), [QUANTITY]],
      ['front_door', t('Voordeur', 'Porte d’entrée', 'Front door'), [MATERIAL]],
      ['intercom', t('Parlofoon', 'Parlophone', 'Intercom'), [WORKS]],
      ['mailbox', t('Brievenbus', 'Boîte aux lettres', 'Mailbox'), []],
      ['alarm_system', t('Alarmsysteem', 'Système d’alarme', 'Alarm system'), [WORKS]],
      ['flooring', t('Vloerbedekking', 'Revêtement de sol', 'Flooring'), [FLOOR_MATERIAL]],
      ['railing', t('Borstwering', 'Garde-corps', 'Railing'), []],
      ['drainage', t('Afvoer', 'Évacuation', 'Drainage'), []],
      ['lawn', t('Gazon', 'Pelouse', 'Lawn'), []],
      ['plants_trees', t('Beplanting en bomen', 'Plantations et arbres', 'Plants and trees'), []],
      ['fencing', t('Afsluiting', 'Clôture', 'Fencing'), [MATERIAL]],
      ['garden_shed', t('Tuinhuis', 'Abri de jardin', 'Garden shed'), []],
      ['paving', t('Verharding', 'Revêtement', 'Paving'), [MATERIAL]],
      ['facade', t('Gevel', 'Façade', 'Facade'), [MATERIAL]],
      ['roof_visible', t('Dak (zichtbaar deel)', 'Toiture (partie visible)', 'Roof (visible part)'), []],
      ['gutters', t('Dakgoten', 'Gouttières', 'Gutters'), []],
      ['garage_door', t('Garagepoort', 'Porte de garage', 'Garage door'), [WORKS]],
      ['driveway', t('Oprit', 'Allée', 'Driveway'), [MATERIAL]],
      ['boiler', t('Verwarmingsketel', 'Chaudière', 'Boiler'), [WORKS]],
      ['electrical_panel', t('Elektrische kast', 'Tableau électrique', 'Electrical panel'), []],
      ['water_meter_location', t('Locatie watermeter', 'Emplacement compteur d’eau', 'Water meter location'), []],
      ['fuse_box', t('Zekeringkast', 'Boîte à fusibles', 'Fuse box'), []],
      ['moisture_signs', t('Vochtsporen', 'Traces d’humidité', 'Damp marks'), []],
      ['insulation_visible', t('Isolatie (zichtbaar)', 'Isolation (visible)', 'Insulation (visible)'), []],
    ] as Array<[string, Translations, SubAttributeDefinition[]]>
  ).map(([key, labels, subAttributes]) => [
    key,
    define({
      key,
      labels,
      subAttributes,
      defaults: {
        nl: `${labels.nl} in goede staat, geen zichtbare beschadigingen.`,
        fr: `${labels.fr} en bon état, sans dégradation visible.`,
        en: `${labels.en} in good condition, no visible damage.`,
      },
    }),
  ]),
);
