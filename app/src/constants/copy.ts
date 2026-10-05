export const DISCLAIMER_FULL =
  'Fleur is an experimental project, not a medical device. It can not diagnose or ' +
  'treat anything, and its scores have not been tested by doctors. This is not ' +
  'medical advice. Always talk to your doctor about your psoriasis, and do not ' +
  'change your treatment because of this app.';

export const DISCLAIMER_SHORT = 'Experimental. Not medical advice.';

export const RISK_HORIZON_KICKER = 'Flare risk score for the next 3 days';

export interface FactorExplanation {
  description: string;
  typicalLag: string;
  lagFrom: number;
  lagTo: number;
}

export const FACTOR_EXPLANATIONS: Readonly<Record<string, FactorExplanation>> = {
  stress: {
    description:
      'Stress is one of the most common psoriasis triggers people report. It can work both ways, since flares are stressful too.',
    typicalLag: 'Usually 7 to 14 days after a stressful time.',
    lagFrom: 7,
    lagTo: 14,
  },
  sleep_hours: {
    description:
      'Not getting enough sleep can make inflammation worse. Fleur looks at your average sleep over the last week.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  itch: {
    description:
      'Itch usually goes up at the same time as your skin gets worse, so it shows a flare more than it predicts one.',
    typicalLag: 'Same day to a few days.',
    lagFrom: 0,
    lagTo: 3,
  },
  alcohol_units: {
    description:
      'Some studies have linked drinking alcohol with worse psoriasis, mostly at higher amounts.',
    typicalLag: 'Usually 2 to 5 days.',
    lagFrom: 2,
    lagTo: 5,
  },
  diet_dairy: {
    description:
      'A lot of people think dairy is a trigger, but there is not much proof. Test it on purpose before cutting it out.',
    typicalLag: 'Anywhere from 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  diet_processed: {
    description:
      'Eating a lot of processed food is linked to inflammation in the body. The link to psoriasis is not proven.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  diet_sugar: {
    description:
      'Eating a lot of sugar is linked to inflammation. This is based on studies of many people, not proof for you.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  illness: {
    description:
      'Being sick makes your immune system more active, and that can show up on your skin a while later.',
    typicalLag: 'Usually 10 to 14 days.',
    lagFrom: 10,
    lagTo: 14,
  },
  sore_throat: {
    description:
      'A strep throat infection is a well known trigger for guttate psoriasis, so Fleur asks about it on its own.',
    typicalLag: 'Usually 14 to 21 days. Fleur only looks back 14 days, so it can miss the end of this.',
    lagFrom: 14,
    lagTo: 21,
  },
  skin_injury: {
    description:
      'New spots can show up where the skin was hurt, like a cut, scratch, sunburn or rubbing. This is called the Koebner effect.',
    typicalLag: 'Usually 10 to 14 days.',
    lagFrom: 10,
    lagTo: 14,
  },
  temp_delta_1d: {
    description:
      'A sudden drop in temperature can dry out your skin and make it worse.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  humidity_delta_1d: {
    description:
      'A sudden drop in humidity can dry out your skin.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  pressure_delta_1d: {
    description:
      'Some people say changes in air pressure affect their skin, but there is not much proof.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  uv_index_max: {
    description:
      'Sunlight usually helps psoriasis, which is why light therapy works. Days with less sun can go along with worse skin.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  pm2_5: {
    description:
      'Air pollution has been linked to psoriasis flares in some studies.',
    typicalLag: 'Usually 1 to 4 days.',
    lagFrom: 1,
    lagTo: 4,
  },
  pollen_total: {
    description:
      'How much pollen is in the air where you are.',
    typicalLag: 'Usually 1 to 4 days.',
    lagFrom: 1,
    lagTo: 4,
  },
  humidity_mean_pct: {
    description:
      'Low humidity for a long time can make skin drier and more irritated.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  severity_baseline: {
    description:
      'Your average skin rating over the last two weeks. Fleur compares each day to this instead of a fixed number.',
    typicalLag: 'The last 14 days.',
    lagFrom: 0,
    lagTo: 14,
  },
  severity_delta: {
    description:
      'How far today is above or below your recent average. This is the strongest sign Fleur has, because skin that has started getting worse often keeps getting worse.',
    typicalLag: 'Today, compared with the last 14 days.',
    lagFrom: 0,
    lagTo: 1,
  },
  sleep_debt_7d: {
    description:
      'How many hours of sleep you missed this week, compared to 7.5 hours a night.',
    typicalLag: 'The last 7 days.',
    lagFrom: 0,
    lagTo: 7,
  },
  temp_mean_c: {
    description:
      'The average temperature where you are today.',
    typicalLag: 'Today.',
    lagFrom: 0,
    lagTo: 1,
  },
};

export function explanationFor(baseVariable: string): FactorExplanation {
  return (
    FACTOR_EXPLANATIONS[baseVariable] ?? {
      description: 'Research has linked this to psoriasis flares.',
      typicalLag: 'Varies.',
      lagFrom: 0,
      lagTo: 14,
    }
  );
}
