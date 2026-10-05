import React, { useState } from 'react';
import { Alert, Share } from 'react-native';

import { ExportIcon } from '../src/components/icons';
import { Button, Screen, Txt } from '../src/components/primitives';
import { exportCsv } from '../src/db/queries';
import { useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';
import { spacing } from '../src/theme';

export default function SettingsExportScreen(): React.ReactElement {
  const { palette } = useTheme();
  const { db } = useApp();
  const [exporting, setExporting] = useState(false);

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
    <Screen aurora={false} edges={[]} contentStyle={{ paddingBottom: 100 }}>
      <Txt tone="muted" style={{ lineHeight: 22 }}>
        Save all your check-ins as a CSV file you can open in a spreadsheet.
      </Txt>
      <Button
        label={exporting ? 'Preparing…' : 'Export as CSV'}
        icon={<ExportIcon size={17} color={palette.onAccent} />}
        onPress={() => void onExport()}
        disabled={exporting}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
