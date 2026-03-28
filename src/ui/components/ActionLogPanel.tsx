import type { CSSProperties } from 'react';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';
import type { ReplayEvent } from '../../types/replay';
import { translateHoldemText } from '../holdemText';

interface ActionLogPanelProps {
  events: ReplayEvent[];
  maxItems?: number;
  activeEventId?: string;
  style?: CSSProperties;
}

export function ActionLogPanel({ events, maxItems = 16, activeEventId, style }: ActionLogPanelProps) {
  const language = useLanguage();
  const list = events.slice(-maxItems).reverse();

  return (
    <aside className="action-log glass-panel" style={style}>
      <div className="panel-title-row">
        <h3>{t(language, 'panel.actionTimeline')}</h3>
        <span>{t(language, 'panel.recentN', { count: list.length })}</span>
      </div>
      <ul>
        {list.map((event) => (
          <li
            key={event.id}
            className={event.id === activeEventId ? 'active' : ''}
            data-action={event.type === 'action' ? event.actionType : event.type}
            data-stage={event.stage}
          >
            <span className="event-tag">{event.type}</span>
            <span className="event-note">{translateHoldemText(event.note, language)}</span>
            {event.type === 'action' && event.teachingLabel && (
              <span className={`event-teaching ${event.teachingTag ?? ''}`}>{event.teachingLabel}</span>
            )}
            {event.type === 'action' && event.teachingNote && <span className="event-teaching-note">{event.teachingNote}</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
