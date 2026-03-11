import type { ReplayEvent } from '../../types/replay';

interface ActionLogPanelProps {
  events: ReplayEvent[];
  maxItems?: number;
  activeEventId?: string;
}

export function ActionLogPanel({ events, maxItems = 16, activeEventId }: ActionLogPanelProps) {
  const list = events.slice(-maxItems).reverse();

  return (
    <aside className="action-log glass-panel">
      <h3>行动时间线</h3>
      <ul>
        {list.map((event) => (
          <li key={event.id} className={event.id === activeEventId ? 'active' : ''}>
            <span className="event-tag">{event.type}</span>
            <span className="event-note">{event.note}</span>
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
