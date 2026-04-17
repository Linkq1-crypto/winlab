/**
 * VirtualTicketList — Prevents scroll jank on long ticket lists
 * Only renders visible rows + small overscan buffer
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

const ROW_HEIGHT = 88; // px per ticket row
const HEADER_HEIGHT = 80; // px for top bar
const OVERSCAN = 5; // extra rows above/below viewport

export default function VirtualTicketList({
  tickets,
  selectedIndex,
  onSelect,
  searchQuery,
  topBar,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const containerRef = useRef(null);

  // Measure viewport
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Filter tickets
  const filtered = useMemo(() => {
    if (!searchQuery) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(t =>
      t.subject.toLowerCase().includes(q) ||
      t.from.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  const totalHeight = filtered.length * ROW_HEIGHT;

  // Calculate visible range
  const { startIndex, endIndex, offsetTop } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const end = Math.min(filtered.length, start + visibleCount + OVERSCAN * 2);
    return { startIndex: start, endIndex: end, offsetTop: start * ROW_HEIGHT };
  }, [scrollTop, viewportHeight, filtered.length]);

  const visibleTickets = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar (non-scrolling) */}
      {topBar}

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto virtual-list-container"
        onScroll={handleScroll}
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
      >
        {/* Spacer for total height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items positioned absolutely */}
          <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
            {visibleTickets.map((ticket, idx) => {
              const realIndex = startIndex + idx;
              const isSelected = selectedIndex === realIndex;

              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelect(realIndex)}
                  className={`px-3 border-b border-slate-800 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-800/70' : 'hover:bg-slate-900/60'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Ticket row content */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 truncate">{ticket.senderName || ticket.from}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {ticket.trust && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          ticket.trust.level === 'high' ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                          ticket.trust.level === 'low' ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                          'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                        }`}>
                          {ticket.trust.level === 'high' ? '🟢' : ticket.trust.level === 'low' ? '🔴' : '🟡'} {ticket.trust.score}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm truncate mb-1">{ticket.subject}</div>
                  <div className="flex items-center gap-2">
                    {ticket.ai?.team && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {ticket.ai.team}
                      </span>
                    )}
                    {ticket.action && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        ticket.action === 'auto' ? 'bg-green-600/20 text-green-400' :
                        ticket.action === 'draft' ? 'bg-yellow-600/20 text-yellow-400' :
                        ticket.action === 'blocked' ? 'bg-red-600/20 text-red-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {ticket.action.toUpperCase()}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600 ml-auto">
                      ⏱ {Math.floor((Date.now() - ticket.createdAt) / 60000)}m
                    </span>
                  </div>
                  {ticket.ai?.confidence != null && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ticket.ai.confidence >= 0.8 ? 'bg-green-500' :
                            ticket.ai.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.round(ticket.ai.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono w-7 text-right">
                        {Math.round(ticket.ai.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
