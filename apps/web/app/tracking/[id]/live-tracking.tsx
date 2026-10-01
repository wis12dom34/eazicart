"use client";
import Link from "next/link";
import type { Order } from "../../../lib/api/types";
import { BottomNavigation } from "../../components/bottom-navigation";
import { mapGeometry } from "./map-geometry";
import styles from "./live-tracking.module.css";

type Tracking = NonNullable<Order["tracking"]>;
export function LiveTracking({
  order,
  tracking,
}: {
  order: Order;
  tracking: Tracking;
}) {
  const stage = ["PICKED_UP", "ON_THE_WAY", "ARRIVING_SOON"].indexOf(
    tracking.progress,
  );
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="156:71">
      <div className={styles.map} aria-label="Delivery map">
        <div className={styles.illustration} aria-hidden="true">
          {mapGeometry.map((node) => (
            <div key={node.id} className={styles.shape} style={node.style}>
              {node.text}
            </div>
          ))}
          <object
            className={styles.route}
            type="image/svg+xml"
            data="/figma/delivery-route.svg"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={(event) => {
              const document = event.currentTarget.contentDocument;
              const svg = document?.documentElement;
              if (!document || !svg) return;
              if (tracking.animateReference) {
                const style = document.createElementNS(
                  "http://www.w3.org/2000/svg",
                  "style",
                );
                style.textContent =
                  "path { animation:trim 8s linear infinite; } @keyframes trim { from { stroke-dasharray:.12 1; } to { stroke-dasharray:1 1; } } @media(prefers-reduced-motion:reduce){path{animation:none;}}";
                svg.appendChild(style);
              }
            }}
          />
          <div className={styles.pickup}>
            <div className={styles.storyRing}>
              <span>N</span>
              <i />
            </div>
            <b>Pickup</b>
          </div>
          <div className={styles.customerAccuracy}>
            <i />
            <b />
          </div>
          <span className={styles.destination}>Your location</span>
          <i className={styles.previous} />
          <i className={styles.next} />
          <div
            className={`${styles.rider} ${tracking.animateReference ? styles.animatedRider : ""}`}
            style={{ left: tracking.rider.x, top: tracking.rider.y }}
          >
            <i
              className={
                tracking.animateReference ? styles.animatedPulse : undefined
              }
            />
            <b />
            <span className={styles.direction} />
            <strong>{tracking.rider.shortName}</strong>
          </div>
        </div>
      </div>
      <div className={styles.island} aria-hidden="true" />
      <header className={styles.header}>
        <Link
          className={styles.back}
          href={`/orders/${order.id}`}
          aria-label="Back to order details"
        >
          ‹
        </Link>
        <div>
          <h1>Live delivery</h1>
          <p>#{order.orderNumber ?? order.id.slice(-8)}</p>
        </div>
        {tracking.live ? (
          <span className={styles.live}>
            <i />
            LIVE
          </span>
        ) : null}
      </header>
      <section className={styles.card} aria-label="Delivery status">
        <div className={styles.cardTop}>
          <span className={styles.status}>
            <i />
            {tracking.statusLabel}
          </span>
          <div className={styles.eta}>
            <strong>{tracking.etaLabel ?? "—"}</strong>
            <small>ETA</small>
          </div>
        </div>
        <div className={styles.riderDetails}>
          <div className={styles.avatar}>{tracking.rider.name[0]}</div>
          <div>
            <strong>{tracking.rider.name}</strong>
            <small>{tracking.rider.vehicle} · Rider</small>
          </div>
          {tracking.distanceLabel ? (
            <span className={styles.distance}>{tracking.distanceLabel}</span>
          ) : null}
        </div>
        <div className={styles.progress} aria-label="Delivery progress">
          {["Picked up", "On the way", "Arriving soon"].map((label, index) => (
            <span
              className={
                stage >= index && stage >= 0 ? styles.complete : undefined
              }
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
        <div className={styles.actions}>
          {tracking.rider.phone ? (
            <a href={`tel:${tracking.rider.phone}`}>Call</a>
          ) : (
            <button disabled title="Rider phone number unavailable">
              Call
            </button>
          )}
          <Link href={`/orders/${order.id}`}>Order Details</Link>
        </div>
      </section>
      <BottomNavigation />
    </main>
  );
}
