import { useEffect, useState } from "react";

/**
 * Checks whether the restaurant is currently open.
 * Open hours: 12:00 PM – 10:00 PM, every day, UK time (Europe/London).
 */
function isOpenNow(): boolean {
  const now = new Date();
  // Get current hour and minute in Europe/London timezone
  const londonTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(now);

  const [hourStr, minuteStr] = londonTime.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const totalMinutes = hour * 60 + minute;

  // Open: 12:00 (720) to 22:00 (1320) exclusive
  return totalMinutes >= 720 && totalMinutes < 1320;
}

export default function OpenClosedBadge() {
  const [open, setOpen] = useState<boolean>(isOpenNow);

  // Re-check every 30 seconds so the badge updates without a page reload
  useEffect(() => {
    const id = setInterval(() => setOpen(isOpenNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        /* ── Open/Closed floating badge ── */
        .ocb-wrap {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45));
          cursor: default;
          user-select: none;
        }

        /* Burger bun top */
        .ocb-bun-top {
          width: 68px;
          height: 22px;
          border-radius: 50% 50% 0 0 / 100% 100% 0 0;
          position: relative;
          z-index: 1;
        }

        /* Burger middle layer (sesame-seed strip) */
        .ocb-bun-mid {
          width: 72px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
        }

        /* Status text */
        .ocb-label {
          font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
          font-weight: 900;
          font-style: italic;
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #fff;
          line-height: 1;
        }

        /* Burger bun bottom */
        .ocb-bun-bot {
          width: 68px;
          height: 10px;
          border-radius: 0 0 6px 6px;
          position: relative;
          z-index: 1;
        }

        /* ── Colour themes ── */
        .ocb-open .ocb-bun-top  { background: #2e7d32; }
        .ocb-open .ocb-bun-mid  { background: #388e3c; }
        .ocb-open .ocb-bun-bot  { background: #1b5e20; }

        .ocb-closed .ocb-bun-top { background: #c62828; }
        .ocb-closed .ocb-bun-mid { background: #d32f2f; }
        .ocb-closed .ocb-bun-bot { background: #b71c1c; }

        /* Sesame seeds on top bun */
        .ocb-bun-top::before,
        .ocb-bun-top::after {
          content: '';
          position: absolute;
          width: 6px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
          top: 6px;
        }
        .ocb-bun-top::before { left: 14px; transform: rotate(-20deg); }
        .ocb-bun-top::after  { right: 14px; transform: rotate(20deg); }

        /* Pulse glow for OPEN state only */
        @keyframes ocb-pulse {
          0%   { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45)) drop-shadow(0 0 0px rgba(56,142,60,0)); }
          50%  { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45)) drop-shadow(0 0 10px rgba(56,142,60,0.8)); }
          100% { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45)) drop-shadow(0 0 0px rgba(56,142,60,0)); }
        }
        .ocb-open { animation: ocb-pulse 2.4s ease-in-out infinite; }
        .ocb-closed { animation: none; }
      `}</style>

      <div className={`ocb-wrap ${open ? "ocb-open" : "ocb-closed"}`} title={open ? "We're open!" : "We're closed"}>
        {/* Top bun */}
        <div className="ocb-bun-top" />

        {/* Middle strip with label */}
        <div className="ocb-bun-mid">
          <span className="ocb-label">{open ? "OPEN" : "CLOSED"}</span>
        </div>

        {/* Bottom bun */}
        <div className="ocb-bun-bot" />
      </div>
    </>
  );
}
