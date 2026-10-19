import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { Button, Checkbox, Drawer, Field, Select, useToast } from '@/components/ui';

/** The editable classification of one content item (web page, social post or video). */
export interface Classifiable {
  key: string;
  text: string;
  topic: string | null;
  pillar: string | null;
  objective: string | null;
  audience: string | null;
  campaign: string | null;
  tags: string[];
}

type Form = Partial<Pick<Classifiable, 'topic' | 'pillar' | 'objective' | 'audience' | 'campaign' | 'tags'>>;

/** Editor drawer for taxonomy fields. Values are limited to terms defined in Administration; the server re-validates them. */
export function ClassifyDrawer({ item, onClose }: { item: Classifiable | null; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Form>({});
  const [saving, setSaving] = useState(false);
  if (!item) return null;
  const terms = (kind: string) => meta.data?.taxonomy.filter((x) => x.kind === kind) ?? [];
  const cur = { ...item, ...form };
  const close = () => {
    setForm({});
    onClose();
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.send('PUT', `/api/content/items/${encodeURIComponent(item.key)}/classification`, {
        topic: cur.topic,
        pillar: cur.pillar,
        objective: cur.objective,
        audience: cur.audience,
        campaign: cur.campaign,
        tags: cur.tags,
      });
      await qc.invalidateQueries({ predicate: (q) => ['/api/social', '/api/content', '/api/analytics'].some((p) => String(q.queryKey[0]).startsWith(p)) });
      toast(t('content.saved'), 'pos');
      close();
    } catch (e) {
      toast((e as Error).message, 'neg');
    } finally {
      setSaving(false);
    }
  };
  const sel = (kind: 'topic' | 'pillar' | 'objective' | 'audience') => (
    <Field label={t(`content.${kind}`)} htmlFor={`c-${kind}`}>
      <Select id={`c-${kind}`} value={cur[kind] ?? ''} onChange={(e) => setForm({ ...form, [kind]: e.target.value || null })}>
        <option value="">—</option>
        {terms(kind).map((x) => (
          <option key={x.key} value={x.key}>
            {L(x.label)}
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <Drawer
      open
      onClose={close}
      title={t('content.classifyTitle')}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-card2 p-3 text-[13.5px] break-words">{item.text}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sel('topic')}
        {sel('pillar')}
        {sel('objective')}
        {sel('audience')}
        <Field label={t('content.campaign')} htmlFor="c-campaign">
          <Select id="c-campaign" value={cur.campaign ?? ''} onChange={(e) => setForm({ ...form, campaign: e.target.value || null })}>
            <option value="">—</option>
            {meta.data?.campaigns.map((c) => (
              <option key={c.key} value={c.key}>
                {L(c.name)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-1 text-[13px] font-medium">{t('content.tags')}</legend>
        {terms('tag').length === 0 && <p className="text-[12.5px] text-t3">{t('content.noTags')}</p>}
        {terms('tag').map((tg) => (
          <Checkbox
            key={tg.key}
            checked={cur.tags.includes(tg.key)}
            onChange={(c) => setForm({ ...form, tags: c ? [...cur.tags, tg.key] : cur.tags.filter((x) => x !== tg.key) })}
            label={L(tg.label)}
          />
        ))}
      </fieldset>
      <p className="mt-4 text-[12px] text-t3">{t('content.classifyHint')}</p>
    </Drawer>
  );
}
