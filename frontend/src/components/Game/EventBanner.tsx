import { motion, AnimatePresence } from 'framer-motion';
import type { GameEvent } from '../../types';

interface Props {
  events: GameEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  TRAFFIC_JAM: '🚨',
  RAIN: '🌧️',
  STADIUM_EVENT: '🏟️',
  DRIVER_QUIT: '👋',
};

const EVENT_COLORS: Record<string, string> = {
  TRAFFIC_JAM: '#b84c4c',
  RAIN: '#6b8cad',
  STADIUM_EVENT: '#d4a843',
  DRIVER_QUIT: '#7a6855',
};

export default function EventBanner({ events }: Props) {
  return (
    <div className="flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 260 }}>
      <AnimatePresence mode="popLayout">
        {events.map(event => (
          <motion.div
            key={event.id}
            initial={{ x: 60, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 60, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="clay-card-sm px-3.5 py-2.5 flex items-center gap-2.5 pointer-events-auto"
            style={{
              borderLeft: `3px solid ${EVENT_COLORS[event.type] ?? '#7a6855'}`,
            }}
          >
            <span className="text-lg leading-none shrink-0">
              {EVENT_ICONS[event.type] ?? '⚡'}
            </span>
            <div className="min-w-0">
              <p
                className="text-xs font-semibold truncate"
                style={{ color: '#3d2c1e', fontFamily: "'Nunito', system-ui, sans-serif" }}
              >
                {event.message}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#a39585' }}>
                Active event
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
