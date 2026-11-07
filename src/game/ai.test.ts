import { describe, expect, it, vi } from 'vitest';
import { AiConfig, buildMessages, createAi, endpointAllowed, endpointFor, MAX_CALLS_PER_RUN, MAX_CHARS, sanitize } from './ai';

const cfg = (over: Partial<AiConfig> = {}): AiConfig => ({ enabled: true, roast: true, base: '', model: '', key: '', ...over });
const reply = (content: string) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content, reasoning: 'ignored' } }] }) }) as Response;

describe('sanitize', () => {
  it('strips quotes, markdown, emoji and em dashes', () => {
    expect(sanitize('"**Boo** is `fading` \u2014 hurry! \uD83D\uDC7B"')).toBe('Boo is fading , hurry!');
  });
  it('caps length at a sentence or word boundary', () => {
    const long = 'Spooky words keep coming and coming. '.repeat(20);
    const out = sanitize(long)!;
    expect(out.length).toBeLessThanOrEqual(MAX_CHARS + 3);
    expect(out.endsWith('.')).toBe(true);
    expect(sanitize('a'.repeat(400) + ' b'.repeat(5))!.length).toBeLessThanOrEqual(MAX_CHARS + 3);
  });
  it('rejects empty, tiny, non-string and off persona or unsafe text', () => {
    for (const bad of ['', '   ', 'ok', null, 42, 'As an AI language model I cannot do that.', 'Visit https://example.com now please',
      'This was powered by Pollinations', 'Go fuck yourself human', "I'm sorry, but I can't help with that."]) {
      expect(sanitize(bad)).toBeNull();
    }
  });
});

describe('prompt building', () => {
  it('only sends typed text for the confession kind', () => {
    const a = JSON.stringify(buildMessages('fail', { text: 'SECRET-TEXT', challenge: 'grid' }, []));
    const b = JSON.stringify(buildMessages('confession-reaction', { text: 'SECRET-TEXT', challenge: 'secret' }, []));
    expect(a).not.toContain('SECRET-TEXT');
    expect(b).toContain('SECRET-TEXT');
  });
  it('lists recent lines to avoid repeats', () => {
    expect(JSON.stringify(buildMessages('fail', {}, ['Earlier line here']))).toContain('Earlier line here');
  });
  it('builds endpoints and rejects insecure ones', () => {
    expect(endpointFor('')).toBe('https://text.pollinations.ai/openai');
    expect(endpointFor('https://api.example.com/v1/')).toBe('https://api.example.com/v1/chat/completions');
    expect(endpointAllowed('http://evil.example.com/v1')).toBe(false);
    expect(endpointAllowed('http://localhost:11434/v1')).toBe(true);
    expect(endpointAllowed('not a url')).toBe(false);
  });
});

describe('createAi', () => {
  it('returns a sanitized line and sends the key only as a bearer header', async () => {
    const f = vi.fn(async () => reply('"Hello mortal, Boo says hi."'));
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg({ key: 'k123', base: 'https://api.example.com/v1' }) });
    expect(await ai.ask('greeting')).toBe('Hello mortal, Boo says hi.');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k123');
    expect(String(init.body)).not.toContain('k123');
    expect(ai.status()).toBe('live');
  });

  it('falls back (null) on timeout', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => {
      init.signal!.addEventListener('abort', () => rej(new Error('aborted')));
    }));
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg(), timeoutMs: 40 });
    const t = Date.now();
    expect(await ai.ask('fail')).toBeNull();
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it('falls back on network errors, HTTP 429, non-JSON and unsafe output', async () => {
    const bodies: Array<() => Promise<Response>> = [
      async () => { throw new TypeError('Failed to fetch'); },
      async () => ({ ok: false, status: 429, text: async () => 'slow down' }) as Response,
      async () => ({ ok: true, status: 200, text: async () => '<html>nope</html>' }) as Response,
      async () => reply('As an AI language model I cannot help'),
    ];
    for (const b of bodies) {
      const ai = createAi({ fetch: b as unknown as typeof fetch, getConfig: () => cfg() });
      expect(await ai.ask('success')).toBeNull();
    }
  });

  it('never repeats a recent line', async () => {
    const f = vi.fn(async () => reply('Same line every time, mortal.'));
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg() });
    expect(await ai.ask('fail')).toBe('Same line every time, mortal.');
    expect(await ai.ask('fail')).toBeNull();
  });

  it('makes zero network calls when disabled', async () => {
    const f = vi.fn(async () => reply('Should not be called at all.'));
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg({ enabled: false }) });
    expect(await ai.ask('greeting')).toBeNull();
    expect(ai.take('fail')).toBeNull();
    ai.prefetch('success');
    await new Promise((r) => setTimeout(r, 20));
    expect(f).not.toHaveBeenCalled();
    expect(ai.status()).toBe('off');
  });

  it('prefetches in the background, then take() is instant', async () => {
    const f = vi.fn(async () => reply('Prefetched line for the fail kind.'));
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg() });
    expect(ai.take('success', { challenge: 'grid' })).toBeNull();   // nothing ready yet, scripted fallback used
    await new Promise((r) => setTimeout(r, 20));
    expect(ai.take('success', { challenge: 'grid' })).toBe('Prefetched line for the fail kind.');
    expect(ai.take('success', { challenge: 'grid' })).toBeNull();   // consumed
  });

  it('allows at most one request in flight', async () => {
    let active = 0, peak = 0, n = 0;
    const f = vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return reply(`Distinct generated line number ${n++}.`);
    });
    const ai = createAi({ fetch: f as unknown as typeof fetch, getConfig: () => cfg() });
    ai.prefetch('greeting'); ai.prefetch('fail'); ai.prefetch('success'); ai.prefetch('idle-hint');
    await Promise.all([ai.ask('finale'), ai.ask('humanity-verdict')]);
    await new Promise((r) => setTimeout(r, 80));
    expect(peak).toBe(1);
  });

  it('stops calling after repeated failures and caps calls per run', async () => {
    const bad = vi.fn(async () => { throw new Error('down'); });
    const a = createAi({ fetch: bad as unknown as typeof fetch, getConfig: () => cfg() });
    for (let i = 0; i < 6; i++) await a.ask('fail');
    expect(bad).toHaveBeenCalledTimes(3);
    expect(a.status()).toBe('offline');
    a.resetRun();
    await a.ask('fail');
    expect(bad).toHaveBeenCalledTimes(4);

    let n = 0;
    const good = vi.fn(async () => reply(`Line number ${n++} from the mock model.`));
    const b = createAi({ fetch: good as unknown as typeof fetch, getConfig: () => cfg() });
    for (let i = 0; i < MAX_CALLS_PER_RUN + 10; i++) await b.ask('fail');
    expect(good).toHaveBeenCalledTimes(MAX_CALLS_PER_RUN);
  });
});
