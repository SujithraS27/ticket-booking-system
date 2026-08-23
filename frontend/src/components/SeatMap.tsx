import type { Seat } from '../types';
import { money } from '../types';

/**
 * Seat styling — the four states the brief requires to be visually distinct:
 * available / selected / held / booked. Seats that are part of a waitlist
 * offer get their own fuchsia treatment so nothing falls back to an
 * ambiguous colour.
 */
const BASE_SEAT =
  'h-7 w-7 shrink-0 rounded-t-lg rounded-b-sm text-[9px] font-semibold transition-all duration-150 sm:h-8 sm:w-8';

function seatClass(seat: Seat, selected: Set<string>): string {
  // Selection state wins visually (still clickable it's ours).
  if (selected.has(seat.id)) {
    return `${BASE_SEAT} cursor-pointer bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white`;
  }
  if (seat.status === 'AVAILABLE') {
    return `${BASE_SEAT} cursor-pointer border border-slate-600 bg-slate-700/80 text-slate-300 hover:border-emerald-400 hover:bg-emerald-600 hover:text-white`;
  }
  if (seat.status === 'HELD') {
    if (seat.heldByMe) {
      return `${BASE_SEAT} cursor-pointer bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-300`;
    }
    return `${BASE_SEAT} cursor-not-allowed bg-amber-600/70 text-amber-100`;
  }
  if (seat.status === 'OFFERED') {
    return `${BASE_SEAT} cursor-not-allowed bg-fuchsia-600/70 text-fuchsia-100`;
  }
  // BOOKED
  return `${BASE_SEAT} cursor-not-allowed border border-slate-700 bg-slate-800/60 text-slate-600`;
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
      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-300">
        <LegendSwatch className="border border-slate-600 bg-slate-700/80" label="Available" />
        <LegendSwatch className="bg-emerald-500 shadow-lg shadow-emerald-500/40" label="Selected" />
        <LegendSwatch className="bg-indigo-500 shadow-lg shadow-indigo-500/40" label="Held by you" />
        <LegendSwatch className="bg-amber-600/70" label="Held by others" />
        <LegendSwatch className="bg-fuchsia-600/70" label="Offer pending" />
        <LegendSwatch className="border border-slate-700 bg-slate-800/60" label="Booked" />
      </div>

      {/* Stage */}
      <div className="relative mx-auto mb-8 max-w-md overflow-hidden rounded-t-2xl border border-slate-700/70 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 px-6 pb-3 pt-2 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400">Stage</p>
        <div className="mt-1 h-1 rounded-full bg-slate-700/70" />
      </div>

      {/* Seat rows */}
      <div className="space-y-1.5 overflow-x-auto pb-2">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 pr-1 text-right text-[10px] font-bold uppercase text-slate-500">
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
                  className={seatClass(seat, selected)}
                >
                  {seat.col}
                </button>
              ))}
            <span className="w-7 shrink-0 pl-1 text-left text-[10px] font-bold uppercase text-slate-500">
              {String.fromCharCode(64 + row)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LegendProps {
  className: string;
  label: string;
}

function LegendSwatch({ className, label }: LegendProps) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 rounded-md ${className}`} />
      <span className="font-medium">{label}</span>
    </span>
  );
}