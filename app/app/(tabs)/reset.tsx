/**
 * Reset — new in the v2 redesign.
 *
 * Not a treatment feature (§2): every card here is a lever on a *logged
 * input* — sleep, stress, food, skin handling — never a claim about
 * psoriasis itself. "Today's plan" is genuinely derived from the current
 * top drivers (`risk.drivers`, the same signed contributions `/risk-detail`
 * shows), mapped to a category through `categoryForVariable`. Before a
 * forecast exists, or when nothing maps cleanly, it falls back to a fixed,
 * clearly-labelled default order rather than inventing a personalised one.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import {
  BowlIcon,
  DropletIcon,
  MoonIcon,
  NotebookIcon,
  PersonMoveIcon,
  WindIcon,
} from '../../src/components/icons';
import { PressableScale, Reveal } from '../../src/components/motion';
import {
  Card,
  IconBadge,
  Kicker,
  Screen,
  Txt,
} from '../../src/components/primitives';
import {
  DEFAULT_PLAN_ORDER,
  RESET_CATEGORIES,
  categoryForVariable,
  planItemFor,
  type PlanItem,
  type ResetCategory,
  type ResetCategoryKey,
} from '../../src/constants/reset';
import { useApp } from '../../src/hooks/appState';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing } from '../../src/theme';

const CATEGORY_ICON: Record<ResetCategory['icon'], (props: { size: number; color: string }) => React.ReactElement> = {
  move: PersonMoveIcon,
  wind: WindIcon,
  bowl: BowlIcon,
  moon: MoonIcon,
  drop: DropletIcon,
  notebook: NotebookIcon,
};

export default function ResetScreen(): React.ReactElement {
  const { palette } = useTheme();
  const router = useRouter();
  const { risk } = useApp();

  const personalized = risk.status === 'ready' && risk.drivers.length > 0;

  const plan = useMemo<{ items: PlanItem[]; personalized: boolean }>(() => {
    const categories: ResetCategoryKey[] = [];
    if (risk.status === 'ready') {
      for (const driver of risk.drivers) {
        const category = categoryForVariable(driver.variable);
        if (category && !categories.includes(category)) categories.push(category);
      }
    }
    for (const fallback of DEFAULT_PLAN_ORDER) {
      if (categories.length >= 3) break;
      if (!categories.includes(fallback)) categories.push(fallback);
    }
    return { items: categories.slice(0, 3).map(planItemFor), personalized };
  }, [risk, personalized]);

  return (
    <Screen contentStyle={{ paddingBottom: 120 }}>
      <Reveal>
        <Kicker>Flare care</Kicker>
        <Txt variant="display" style={{ marginTop: 4 }}>
          Reset
        </Txt>
        <Txt tone="muted" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          Practices that lower the factors currently raising your risk. Nothing here treats
          psoriasis.
        </Txt>
      </Reveal>

      <Reveal delay={70}>
        <Card level={2} style={{ marginTop: spacing.lg }}>
          <Txt variant="micro" tone="faint" style={{ textTransform: 'uppercase' }}>
            {plan.personalized ? "Today's plan · built from your top drivers" : "Today's plan · a place to start"}
          </Txt>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {plan.items.map((item, index) => (
              <PressableScale
                key={item.category}
                onPress={() =>
                  router.push({ pathname: item.pathname, params: item.params } as never)
                }
                accessibilityLabel={item.title}
                scaleTo={0.99}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Txt variant="label" tone="accent" style={{ width: 20 }}>
                    {`0${index + 1}`}
                  </Txt>
                  <View style={{ flex: 1 }}>
                    <Txt variant="label">{item.title}</Txt>
                    <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                      {item.subtitle}
                    </Txt>
                  </View>
                </View>
              </PressableScale>
            ))}
          </View>
          {!plan.personalized ? (
            <Txt variant="caption" tone="faint" style={{ marginTop: spacing.sm, lineHeight: 18 }}>
              This becomes personal once Fleur has a forecast to build it from.
            </Txt>
          ) : null}
        </Card>
      </Reveal>

      <Reveal delay={140}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: spacing.xl,
          }}
        >
          {RESET_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category.icon];
            return (
              <PressableScale
                key={category.key}
                onPress={() => router.push({ pathname: '/reset-category', params: { key: category.key } })}
                accessibilityLabel={category.name}
                scaleTo={0.97}
                style={{ flexGrow: 1, flexBasis: '46%' }}
              >
                <Card style={{ minHeight: 118 }}>
                  <IconBadge background={palette.primarySoft} size={38}>
                    <Icon size={19} color={palette.primary} />
                  </IconBadge>
                  <Txt variant="label" style={{ marginTop: spacing.md }}>
                    {category.name}
                  </Txt>
                  <Txt variant="caption" tone="faint" style={{ marginTop: 3 }} numberOfLines={1}>
                    {category.kicker}
                  </Txt>
                  <Txt variant="caption" tone="faint" style={{ marginTop: 6, fontSize: 10, letterSpacing: 0.4 }}>
                    {category.meta.toUpperCase()}
                  </Txt>
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      <Reveal delay={200}>
        <Card tone="alt" level={1} style={{ marginTop: spacing.xl, borderRadius: radius.lg }}>
          <Txt variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            Fleur never suggests starting, stopping or changing a medication. Talk to your
            dermatologist about treatment.
          </Txt>
        </Card>
      </Reveal>
    </Screen>
  );
}
