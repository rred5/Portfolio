// Card content per item kind (spec §11.2).
import { useState } from 'react';
import { profile } from '../content/query';
import type { Item, SkillLevel } from '../content/types';
import { formatRange } from '../lib/dates';
import { CodeIcon, CopyIcon, DownloadIcon, LinkIcon, MailIcon, PhoneIcon } from './icons';

export function cardHeader(item: Item): { title: string; subtitle?: string; meta?: string } {
  switch (item.kind) {
    case 'project':
      return { title: item.name, subtitle: item.summary, meta: item.dates ? formatRange(item.dates) : undefined };
    case 'experience':
      return {
        title: item.role,
        subtitle: item.company,
        meta: [formatRange(item.dates), item.location].filter(Boolean).join(' · '),
      };
    case 'skills':
      return { title: item.name, subtitle: `${item.skills.length} skills` };
    case 'about':
      return { title: item.heading };
    case 'contact':
      return { title: item.heading, subtitle: profile.location };
  }
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

function Chips({ list, label = 'Technologies' }: { list: string[]; label?: string }) {
  return (
    <ul className="chips" aria-label={label}>
      {list.map((t) => (
        <li key={t} className="chip">
          {t}
        </li>
      ))}
    </ul>
  );
}

const LEVEL: Record<SkillLevel, number> = { familiar: 1, proficient: 2, expert: 3 };

function Level({ level }: { level: SkillLevel }) {
  const n = LEVEL[level];
  return (
    <span className="level" role="img" aria-label={level}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="level__dot" data-on={i <= n ? '1' : '0'} />
      ))}
    </span>
  );
}

function LinkButton({ href, children, download }: { href: string; children: React.ReactNode; download?: boolean }) {
  const external = /^https?:/.test(href);
  return (
    <a className="link-btn" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...(download ? { download: true } : {})}>
      {children}
    </a>
  );
}

function CopyEmail() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="email-row">
      <a className="link-btn link-btn--wide" href={`mailto:${profile.email}`}>
        <MailIcon />
        <span>{profile.email}</span>
      </a>
      <button
        type="button"
        className="icon-btn"
        aria-label={copied ? 'Email copied' : 'Copy email address'}
        onClick={() => {
          void navigator.clipboard?.writeText(profile.email).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <span className="icon-btn__done">Copied</span> : <CopyIcon />}
      </button>
    </div>
  );
}

/** `preview`: the hover card is view-only (D22), so link buttons that cannot be clicked are left out. */
export function CardBody({ item, preview = false }: { item: Item; preview?: boolean }) {
  switch (item.kind) {
    case 'project':
      return (
        <>
          {item.image && <img className="card__image" src={item.image.src} alt={item.image.alt} loading="lazy" />}
          <Paragraphs text={item.description} />
          {item.highlights?.length ? (
            <>
              <h3 className="card__h">Highlights</h3>
              <ul className="card__list">
                {item.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          ) : null}
          {item.tech.length > 0 && (
            <>
              <h3 className="card__h">Tech</h3>
              <Chips list={item.tech} />
            </>
          )}
          {!preview && (item.links?.github || item.links?.demo || item.links?.other?.length) && (
            <div className="card__links">
              {item.links?.github && (
                <LinkButton href={item.links.github}>
                  <CodeIcon />
                  <span>GitHub</span>
                </LinkButton>
              )}
              {item.links?.demo && (
                <LinkButton href={item.links.demo}>
                  <LinkIcon />
                  <span>Demo</span>
                </LinkButton>
              )}
              {item.links?.other?.map((l) => (
                <LinkButton key={l.url} href={l.url}>
                  <LinkIcon />
                  <span>{l.label}</span>
                </LinkButton>
              ))}
            </div>
          )}
        </>
      );
    case 'experience':
      return (
        <>
          <p>{item.summary}</p>
          {item.bullets.length > 0 && (
            <ul className="card__list">
              {item.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {item.tech?.length ? (
            <>
              <h3 className="card__h">Tech</h3>
              <Chips list={item.tech} />
            </>
          ) : null}
          {!preview && item.link && (
            <div className="card__links">
              <LinkButton href={item.link.url}>
                <LinkIcon />
                <span>{item.link.label}</span>
              </LinkButton>
            </div>
          )}
        </>
      );
    case 'skills':
      return (
        <>
          {item.skills.some((s) => s.level) ? (
            <ul className="skills">
              {item.skills.map((s) => (
                <li key={s.name} className="skill">
                  <span>{s.name}</span>
                  {s.level && <Level level={s.level} />}
                </li>
              ))}
            </ul>
          ) : (
            <Chips list={item.skills.map((s) => s.name)} label="Skills" />
          )}
          {item.note && <p className="card__note">{item.note}</p>}
        </>
      );
    case 'about':
      return (
        <>
          {item.image && <img className="card__image" src={item.image.src} alt={item.image.alt} loading="lazy" />}
          <Paragraphs text={item.body} />
          {item.bullets?.length ? (
            <ul className="card__list">
              {item.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </>
      );
    case 'contact':
      return (
        <>
          <CopyEmail />
          <div className="card__links">
            {profile.phone && (
              <LinkButton href={`tel:+1${profile.phone.replace(/\D/g, '')}`}>
                <PhoneIcon />
                <span>{profile.phone}</span>
              </LinkButton>
            )}
            {profile.links.map((l) => (
              <LinkButton key={l.url} href={l.url}>
                <LinkIcon />
                <span>{l.label}</span>
              </LinkButton>
            ))}
            {profile.resumeUrl && (
              <LinkButton href={profile.resumeUrl} download>
                <DownloadIcon />
                <span>Resume</span>
              </LinkButton>
            )}
          </div>
        </>
      );
  }
}
