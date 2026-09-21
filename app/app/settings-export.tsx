/**
 * Settings → Export as CSV — split out of the old single-page Settings.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { ExportIcon } from '../src/components/icons';
import { Button, Card, IconBadge, Screen, Txt } from '../src/components/primitives';
import { countCheckInDays, countEnvironmentDays, exportCsv } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

export default function SettingsExportScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { db } = useApp();
  const [checkinRows, setCheckinRows] = useState(0);
  const [environmentRows, setEnvironmentRows] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!db) return;
    void countCheckInDays(db).then(setCheckinRows);
    void countEnvironmentDays(db).then(setEnvironmentRows);
  }, [db]);

  const rows = [
    { key: 'checkin.csv', value: `${checkinRows} rows · every field you have logged` },
    { key: 'environment.csv', value: `${environmentRows} rows · cached weather and air quality` },
  ];

  const onExport = async (): Promise<void> => {
    if (!db) return;
    setExporting(true);
    try {
      const csv = await exportCsv(db);
      if (csv.split('\n').length <= 2) {
        Alert.alert('Nothing to export yet', 'Log a few check-ins first.');
        return;
      }
      await Share.share({ message: csv, title: 'fleur-export.csv' });
    } catch (error) {
      console.error('[fleur] CSV export failed', error);
      Alert.alert('Export failed', 'Could not build the export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted">Plain text · yours to keep</Txt>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {rows.map((row) => (
          <Card key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge background={palette.primarySoft}>
              <ExportIcon size={18} color={palette.primary} />
            </IconBadge>
            <View style={{ flex: 1 }}>
              <Txt variant="label">{row.key}</Txt>
              <Txt variant="caption" tone="faint" style={{ marginTop: 2 }}>
                {row.value}
              </Txt>
            </View>
          </Card>
        ))}
      </View>

      <Txt tone="muted" style={{ marginTop: spacing.xl, lineHeight: 21 }}>
        Column names match the database exactly, so the export is readable in a spreadsheet.
        Bring it to an appointment if it helps the conversation.
      </Txt>

      <Button
        label={exporting ? 'Preparing…' : 'Share your data'}
        icon={<ExportIcon size={17} color={palette.onAccent} />}
        onPress={() => void onExport()}
        disabled={exporting}
        style={{ marginTop: spacing.xl }}
      />
      <Txt variant="caption" tone="faint" style={{ marginTop: spacing.md, lineHeight: 18 }}>
        The share sheet is the operating system's. Fleur has no server to upload to.
      </Txt>
    </Screen>
  );
}
