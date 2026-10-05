type NumberField = 'severity' | 'itch' | 'stress' | 'sleepHours' | 'alcoholUnits';
type YesNoField = 'illness' | 'soreThroat' | 'skinInjury' | 'dietProcessed';

export type CheckInQuestion =
  | {
      kind: 'scale';
      rule: string;
      short: string;
      field: Extract<NumberField, 'severity' | 'itch' | 'stress'>;
      question: string;
      minLabel: string;
      maxLabel: string;
    }
  | {
      kind: 'count';
      rule: string;
      short: string;
      field: Extract<NumberField, 'sleepHours' | 'alcoholUnits'>;
      question: string;
      unit: string;
      step: number;
      max: number;
    }
  | {
      kind: 'yesno';
      rule: string;
      short: string;
      field: YesNoField;
      question: string;
    };

export const CHECKIN_QUESTIONS: readonly CheckInQuestion[] = [
  {
    kind: 'scale',
    rule: 'skin_climbing',
    short: 'Skin',
    field: 'severity',
    question: 'How bad is your skin today?',
    minLabel: 'Clear',
    maxLabel: 'Worst ever',
  },
  {
    kind: 'scale',
    rule: 'stress',
    short: 'Stress',
    field: 'stress',
    question: 'How stressed were you today?',
    minLabel: 'Calm',
    maxLabel: 'Overwhelmed',
  },
  {
    kind: 'yesno',
    rule: 'illness',
    short: 'Sick',
    field: 'illness',
    question: 'Were you sick today?',
  },
  {
    kind: 'count',
    rule: 'short_sleep',
    short: 'Sleep',
    field: 'sleepHours',
    question: 'How many hours did you sleep last night?',
    unit: 'hours',
    step: 0.5,
    max: 16,
  },
  {
    kind: 'scale',
    rule: 'itch',
    short: 'Itch',
    field: 'itch',
    question: 'How itchy is your skin?',
    minLabel: 'Not at all',
    maxLabel: 'Unbearable',
  },
  {
    kind: 'yesno',
    rule: 'sore_throat',
    short: 'Sore throat',
    field: 'soreThroat',
    question: 'Do you have a sore throat?',
  },
  {
    kind: 'yesno',
    rule: 'skin_injury',
    short: 'Cut, scrape or sunburn',
    field: 'skinInjury',
    question: 'Any cut, scrape or sunburn today?',
  },
  {
    kind: 'count',
    rule: 'alcohol',
    short: 'Alcohol',
    field: 'alcoholUnits',
    question: 'How many alcoholic drinks today?',
    unit: 'drinks',
    step: 1,
    max: 12,
  },
  {
    kind: 'yesno',
    rule: 'processed_food',
    short: 'Processed food',
    field: 'dietProcessed',
    question: 'Did you eat processed food today?',
  },
];
