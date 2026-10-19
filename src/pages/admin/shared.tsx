/** Building blocks shared by the administration sections. */
import { AlertTriangle, CheckCircle2, CircleDashed, CirclePause, PlugZap, Unplug } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApiMutation } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import type { Permission } from '@shared/rbac';
import { Badge, Button, Field, Input, Modal, useToast } from '@/components/ui';

export type ConnStatus = 'connected' | 'disconnected' | 'degraded' | 'paused' | 'not_configured' | 'demo';

/** The six connection states, always shown with an icon and a label (never colour alone). */
export function ConnectionStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<ConnStatus, { tone: 'pos' | 'neg' | 'warn' | 'neutral' | 'info'; icon: ReactNode }> = {
    connected: { tone: 'pos', icon: <CheckCircle2 className="size-3" aria-hidden /> },
    disconnected: { tone: 'neg', icon: <Unplug className="size-3" aria-hidden /> },
    degraded: { tone: 'warn', icon: <AlertTriangle className="size-3" aria-hidden /> },
    paused: { tone: 'neutral', icon: <CirclePause className="size-3" aria-hidden /> },
    not_configured: { tone: 'neutral', icon: <CircleDashed className="size-3" aria-hidden /> },
    demo: { tone: 'warn', icon: <PlugZap className="size-3" aria-hidden /> },
  };
  const m = map[status as ConnStatus] ?? map.not_configured;
  return (
    <Badge tone={m.tone}>
      {m.icon} {t(`admin.conn_${status}`)}
    </Badge>
  );
}

/** Mutation with a success/failure toast; returns the response or undefined on error. */
export function useAction<TBody = unknown, TRes = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string | ((b: TBody) => string), invalidate: string[] = []) {
  const m = useApiMutation<TBody, TRes>(method, path, invalidate);
  const toast = useToast();
  const { t } = useI18n();
  const run = async (b: TBody, okMessage: string | null = t('common.saved')): Promise<TRes | undefined> => {
    try {
      const r = await m.mutateAsync(b);
      if (okMessage) toast(okMessage, 'pos');
      return r;
    } catch (e) {
      toast((e as Error).message, 'neg');
      return undefined;
    }
  };
  return { run, pending: m.isPending, variables: m.variables };
}

/** Explicit confirmation by typing a word (used for authorisations with external effects). */
export function TypedConfirm({ open, onClose, title, body, word, onConfirm, pending }: { open: boolean; onClose: () => void; title: string; body: ReactNode; word: string; onConfirm: (typed: string) => void; pending?: boolean }) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => (setTyped(''), onClose())}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={() => (setTyped(''), onClose())}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={typed !== word} loading={pending} onClick={() => onConfirm(typed)}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="text-[13.5px] text-t2">{body}</div>
      <div className="mt-3">
        <Field label={t('admin.typeToConfirm', { word })} htmlFor="typed-confirm">
          <Input id="typed-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}

/** Note shown when the current role can view a section but not change it. */
export function ReadOnlyNote({ permission }: { permission: Permission }) {
  const { t } = useI18n();
  const { can } = useSession();
  if (can(permission)) return null;
  return <p className="rounded-lg border border-brd bg-card2 px-3 py-2 text-[12.5px] text-t2">{t('admin.readOnlySection')}</p>;
}

export const splitList = (v: string) =>
  v
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
