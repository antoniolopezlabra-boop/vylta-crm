import { Fragment, type ReactNode } from 'react';

// Los agentes contestan con un markdown sencillo (**negritas**, listas con
// "-" o "1.", `código`). Aquí se pinta bien en vez de mostrar los asteriscos.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**')
      ? <strong key={`${key}-${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>
      : <code key={`${key}-${i++}`} className="rounded bg-black/20 px-1 py-px font-mono text-[.92em]">{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? 'my-1 list-decimal space-y-1 pl-5' : 'my-1 space-y-1'}>
        {list.items.map((it, n) => (
          <li key={n} className={list!.ordered ? '' : 'flex gap-2'}>
            {!list!.ordered && <span className="mt-[.55em] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />}
            <span>{inline(it, `li${blocks.length}-${n}`)}</span>
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num && !bullet;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet ?? num)![1]);
      return;
    }
    flush();
    if (!line.trim()) { if (blocks.length) blocks.push(<span key={`s${n}`} className="block h-2" />); return; }
    const h = /^#{1,3}\s+(.*)$/.exec(line);
    blocks.push(h
      ? <p key={`p${n}`} className="font-semibold">{inline(h[1], `h${n}`)}</p>
      : <p key={`p${n}`}>{inline(line, `p${n}`)}</p>);
  });
  flush();
  return <Fragment>{blocks}</Fragment>;
}
