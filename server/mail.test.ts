import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from './context';
import { sendMail } from './mail';

/** Minimal local SMTP server that accepts messages and keeps them in memory. */
function fakeSmtp(): Promise<{ port: number; messages: Array<{ from: string; to: string[]; data: string }>; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const messages: Array<{ from: string; to: string[]; data: string }> = [];
    const server = net.createServer((sock) => {
      let buf = '';
      let inData = false;
      let cur = { from: '', to: [] as string[], data: '' };
      sock.write('220 test ESMTP\r\n');
      sock.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        let i: number;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              messages.push(cur);
              cur = { from: '', to: [], data: '' };
              sock.write('250 OK queued\r\n');
            } else cur.data += `${line}\n`;
            continue;
          }
          const cmd = line.slice(0, 4).toUpperCase();
          if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-test\r\n250 8BITMIME\r\n');
          else if (cmd === 'MAIL') (cur.from = line.slice(10).trim()), sock.write('250 OK\r\n');
          else if (cmd === 'RCPT') cur.to.push(line.slice(8).trim()), sock.write('250 OK\r\n');
          else if (cmd === 'DATA') (inData = true), sock.write('354 go ahead\r\n');
          else if (cmd === 'QUIT') sock.end('221 bye\r\n');
          else sock.write('250 OK\r\n');
        }
      });
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: (server.address() as net.AddressInfo).port, messages, close: () => new Promise((r) => server.close(() => r())) }),
    );
  });
}

const appWith = (env: Record<string, unknown>) => ({ env: { SMTP_FROM: 'reports@veolia.example', SMTP_USER: '', SMTP_PASSWORD: '', ...env } }) as unknown as AppContext;

describe('e-mail delivery', () => {
  let smtp: Awaited<ReturnType<typeof fakeSmtp>>;
  beforeAll(async () => {
    smtp = await fakeSmtp();
  });
  afterAll(async () => {
    await smtp.close();
  });

  it('records "not sent" without a configured relay and sends nothing', async () => {
    expect(await sendMail(appWith({ smtpConfigured: false }), { to: ['a@veolia.example'], subject: 'x', text: 'x' })).toEqual({ status: 'not_sent_no_provider' });
    expect(smtp.messages).toHaveLength(0);
  });

  it('delivers through a configured relay, with the attachment', async () => {
    const res = await sendMail(appWith({ smtpConfigured: true, SMTP_HOST: '127.0.0.1', SMTP_PORT: smtp.port }), {
      to: ['comex@veolia.example', 'digital@veolia.example'],
      subject: 'Monthly executive report',
      text: 'Report attached.',
      attachments: [{ filename: 'report.csv', content: Buffer.from('a,b\n1,2\n'), contentType: 'text/csv' }],
    });
    expect(res).toEqual({ status: 'sent' });
    expect(smtp.messages).toHaveLength(1);
    const m = smtp.messages[0];
    expect(m.from).toContain('reports@veolia.example');
    expect(m.to).toEqual(['<comex@veolia.example>', '<digital@veolia.example>']);
    expect(m.data).toContain('Subject: Monthly executive report');
    expect(m.data).toContain('filename=report.csv');
  });

  it('reports a failure when the relay cannot be reached', async () => {
    const closed = await fakeSmtp();
    await closed.close();
    const res = await sendMail(appWith({ smtpConfigured: true, SMTP_HOST: '127.0.0.1', SMTP_PORT: closed.port }), { to: ['a@veolia.example'], subject: 'x', text: 'x' });
    expect(res.status).toBe('failed');
  });
});
