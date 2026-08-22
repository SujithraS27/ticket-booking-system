import type { Seat } from '../types';
import { money } from '../types';

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-slate-700 hover:bg-emerald-600 cursor-pointer',
  HELD_BY_ME: 'bg-indigo-500 ring-2 ring-indigo-300 cursor-pointer',
  HELD: 'bg-amber-600/70 cursor-not-allowed',
  BOOKED: 'bg-slate-800 text-slate-600 cursor-not-allowed',
  OFFERED: 'bg-fuchsia-700/70 cursor-not-allowed',
};

function styleFor(seat: Seat): string {
  if (seat.status === 'HELD' && seat.heldByMe) return STATUS_STYLES.HELD_BY_ME;
  return STATUS_STYLES[seat.status] ?? '';
}

interface Props {
  seats: Seat[];
  selected: Set<string>;
  onToggle: (seat: Seat) => void;
}

/** Visual seat grid grouped by row with live statuses. */
export function SeatMap({ seats, selected, onToggle }: Props) {
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <Legend cls="bg-slate-700" label="Available" />
        <Legend cls="bg-indigo-500" label="Selected by you" />
        <Legend cls="bg-amber-600/70" label="Held by others" />
        <Legend cls="bg-fuchsia-700/70" label="Waitlist offer pending" />
        <Legend cls="bg-slate-800 border border-slate-700" label="Booked" />
      </div>

      <div className="mx-auto mb-6 h-2 w-3/4 rounded-full bg-gradient-to-r from-transparent via-slate-400 to-transparent opacity-40" />
      <p className="mb-4 text-center text-xs uppercase tracking-widest text-slate-500">Screen</p>

      <div className="space-y-1.5 overflow-x-auto pb-2">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-500">
              {String.fromCharCode(64 + row)}
            </span>
            {seats
              .filter((s) => s.row === row)
              .sort((a, b) => a.col - b.col)
              .map((seat) => (
                <button
                  key={seat.id}
                  disabled={!(seat.status === 'AVAILABLE' || (seat.status === 'HELD' && seat.heldByMe))}
                  onClick={() => onToggle(seat)}
                  title={`${seat.label} · ${seat.category} · ${money(seat.priceCents)} · ${seat.status}`}
                  className={`h-7 w-7 shrink-0 rounded-t-md rounded-b-sm text-[9px] transition ${styleFor(seat)} ${
                    selected.has(seat.id) ? '!bg-emerald-500 !ring-2 !ring-white' : ''
                  }`}
                >
                  {seat.col}
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded ${cls}`} /> {label}
    </span>
  );
}