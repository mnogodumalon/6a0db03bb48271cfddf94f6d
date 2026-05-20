import { useDashboardData } from '@/hooks/useDashboardData';
import type { AllgemeineEingabe } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AllgemeineEingabeDialog } from '@/components/dialogs/AllgemeineEingabeDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconSearch, IconPencil, IconTrash,
  IconFileText, IconCalendar, IconNotes, IconInbox,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0db03bb48271cfddf94f6d';
const REPAIR_ENDPOINT = '/claude/build/repair';

export default function DashboardOverview() {
  const {
    allgemeineEingabe,
    loading, error, fetchAll,
  } = useDashboardData();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AllgemeineEingabe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AllgemeineEingabe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allgemeineEingabe;
    return allgemeineEingabe.filter(e => {
      const t = (e.fields.titel ?? '').toLowerCase();
      const b = (e.fields.beschreibung ?? '').toLowerCase();
      const d = (e.fields.datum ?? '').toLowerCase();
      return t.includes(q) || b.includes(q) || d.includes(q);
    });
  }, [allgemeineEingabe, search]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = allgemeineEingabe.filter(e => e.fields.datum === today).length;
  const withDate = allgemeineEingabe.filter(e => e.fields.datum).length;
  const withDesc = allgemeineEingabe.filter(e => e.fields.beschreibung).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await LivingAppsService.deleteAllgemeineEingabeEntry(deleteTarget.record_id);
      fetchAll();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Allgemeine Erfassung</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allgemeineEingabe.length === 0
              ? 'Noch keine Einträge vorhanden'
              : `${allgemeineEingabe.length} Eintrag${allgemeineEingabe.length !== 1 ? 'e' : ''} gesamt`}
          </p>
        </div>
        <Button
          onClick={() => { setEditRecord(null); setDialogOpen(true); }}
          className="shrink-0 sm:w-auto w-full"
        >
          <IconPlus size={16} className="shrink-0 mr-2" />
          Neuer Eintrag
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Einträge gesamt"
          value={String(allgemeineEingabe.length)}
          description="Alle erfassten Einträge"
          icon={<IconFileText size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Heute"
          value={String(todayCount)}
          description="Einträge mit heutigem Datum"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            title="Mit Beschreibung"
            value={String(withDate > 0 ? Math.round((withDesc / allgemeineEingabe.length) * 100) : 0) + ' %'}
            description={`${withDesc} von ${allgemeineEingabe.length} Einträgen`}
            icon={<IconNotes size={18} className="text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
        <Input
          className="pl-9"
          placeholder="Einträge durchsuchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <IconInbox size={48} className="text-muted-foreground" stroke={1.5} />
          {search ? (
            <>
              <p className="font-medium text-foreground">Keine Ergebnisse</p>
              <p className="text-sm text-muted-foreground">Für „{search}" wurden keine Einträge gefunden.</p>
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>Suche zurücksetzen</Button>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Noch keine Einträge</p>
              <p className="text-sm text-muted-foreground">Erstelle deinen ersten Eintrag.</p>
              <Button size="sm" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1 shrink-0" />Eintrag erstellen
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(entry => (
            <EntryCard
              key={entry.record_id}
              entry={entry}
              onEdit={() => { setEditRecord(entry); setDialogOpen(true); }}
              onDelete={() => setDeleteTarget(entry)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <AllgemeineEingabeDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateAllgemeineEingabeEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createAllgemeineEingabeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['AllgemeineEingabe']}
        enablePhotoLocation={AI_PHOTO_LOCATION['AllgemeineEingabe']}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description={`Möchtest du „${deleteTarget?.fields.titel ?? 'diesen Eintrag'}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
      {deleting && null}
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: AllgemeineEingabe;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { titel, beschreibung, datum } = entry.fields;

  return (
    <div className="group bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate text-base leading-snug">
            {titel || <span className="text-muted-foreground italic font-normal">Ohne Titel</span>}
          </p>
          {datum && (
            <div className="flex items-center gap-1 mt-1">
              <IconCalendar size={12} className="shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{formatDate(datum)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Bearbeiten"
          >
            <IconPencil size={15} className="shrink-0" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Löschen"
          >
            <IconTrash size={15} className="shrink-0" />
          </Button>
        </div>
      </div>

      {beschreibung && (
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {beschreibung}
        </p>
      )}

      {!beschreibung && !datum && (
        <p className="text-xs text-muted-foreground italic">Kein weiterer Inhalt</p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
