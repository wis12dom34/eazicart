"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";
import { ContentImage } from "../components/content-image";
import { Icon } from "../components/icon";
import { money } from "../data";
import { ordersApi } from "../../lib/api/orders";
import { useRequest } from "../hooks/use-request";
import { EmptyState, ErrorState, LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import { orderStatusLabel } from "./order-utils";
import styles from "./orders.module.css";

const filters = ["ALL", "PROCESSING", "SHIPPED", "FULFILLED"] as const;
type OrderFilter = (typeof filters)[number];
const filterLabels: Record<OrderFilter, string> = { ALL: "All", PROCESSING: "Processing", SHIPPED: "Shipped", FULFILLED: "Delivered" };

export default function OrdersPage() {
  const auth = useAuth();
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const result = useRequest(async () => auth.isAuthenticated ? ordersApi.list() : Promise.resolve(undefined), [auth.isAuthenticated]);
  const orders = result.data?.data ?? [];
  const visibleOrders = filter === "ALL" ? orders : orders.filter((order) => filter === "PROCESSING" ? order.status === "PENDING" || order.status === "CONFIRMED" : order.status === filter);
  const results = auth.loading || result.loading ? <LoadingState label="Loading orders…" /> : !auth.isAuthenticated ? <SignInState message="Sign in to see your orders." /> : result.error ? <ErrorState message={result.error} retry={() => void result.reload()} /> : !orders.length ? <EmptyState title="No orders yet" message="Your purchases will appear here." icon="bag" action={{ href: "/explore", label: "Start shopping" }} /> : !visibleOrders.length ? <section className={styles.filteredEmpty}><p>No {filterLabels[filter].toLowerCase()} orders.</p></section> : null;

  const renderOrders = (desktop = false) => visibleOrders.map((order) => {
    const firstItem = order.items[0];
    const image = firstItem?.product?.images?.[0];
    const alt = image?.altText ?? firstItem?.productName ?? "Order product";
    const sellerName = firstItem?.product?.seller?.displayName ?? "Seller";
    const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
    const orderNumber = order.orderNumber ?? order.id;
    if (!desktop) return <Link className={styles.orderCard} href={`/orders/${order.id}`} key={order.id}><div className={styles.thumb}>{image?.url ? <ContentImage src={image.url} alt={alt} width={72} height={72} /> : <Icon name="bag" size={24} />}</div><strong className={styles.productName}>{firstItem?.productName ?? "Order"}</strong>{sellerName ? <span className={styles.sellerName}>{sellerName}</span> : null}<span className={styles.orderReference}>Order #{orderNumber} · {formatOrderDate(order.createdAt)}</span><strong className={styles.price}>{money(order.total)}</strong><span className={styles.quantity}>Qty {quantity}</span><span className={`${styles.status} ${statusClass(order.status)}`}>{orderStatusLabel(order.status)}</span></Link>;
    return <article className={styles.desktopOrderCard} key={order.id}><div className={styles.desktopThumb}>{image?.url ? <ContentImage src={image.url} alt={alt} width={104} height={104} /> : <Icon name="bag" size={28} />}</div><div className={styles.desktopOrderCopy}><strong className={styles.desktopSeller}>{sellerName}</strong><span className={styles.desktopReference}>#{orderNumber}</span><span className={styles.desktopProduct}>{firstItem?.productName ?? "Order"}{quantity > 1 ? ` · ${quantity} items` : ""}</span><span className={styles.desktopProgress}>{orderProgressCopy(order.status, order.createdAt)}</span><strong className={styles.desktopPrice}>{money(order.total)}</strong></div><span className={`${styles.desktopStatus} ${statusClass(order.status)}`}>{orderStatusLabel(order.status)}</span><div className={styles.desktopOrderActions}>{order.status === "FULFILLED" ? <Link className={styles.secondaryAction} href="/reviews">Review</Link> : <Link className={styles.secondaryAction} href="/chat">Message</Link>}<Link className={styles.primaryAction} href={`/orders/${order.id}`}>{desktopPrimaryAction(order.status)}</Link></div></article>;
  });

  return <DesktopCustomerShell activeHref="/orders" rail={<CustomerDesktopRail />}><main className={styles.page}><div className={`app-shell with-nav ${styles.mobileLayout}`} data-figma-node="19:35"><div className={styles.scrollViewport}><header className={styles.heading}><h1>My Orders</h1><p>Track purchases and delivery</p></header><OrderFilters filter={filter} setFilter={setFilter} className={styles.filters} /><div className={styles.results}>{results ?? <section className={styles.orderList} aria-label="Orders">{renderOrders()}</section>}</div><div className={styles.bottomClearance} aria-hidden="true" /></div><BottomNavigation /></div><section className={styles.desktopLayout} data-figma-node="3401:20540"><header className={styles.desktopHeader}><h1>Orders</h1><p>Track purchases, delivery progress and completed orders.</p></header><OrderFilters filter={filter} setFilter={setFilter} className={styles.desktopFilters} /><div className={styles.desktopResults}>{results ?? <section className={styles.desktopOrderList} aria-label="Orders">{renderOrders(true)}</section>}</div>{auth.isAuthenticated && orders.length ? <section className={styles.desktopHelp}><div><strong>Need help with an order?</strong><p>Open the order or contact support for a delivery, payment or seller issue.</p></div><Link href="/chat">Get help</Link></section> : null}</section></main></DesktopCustomerShell>;
}

function OrderFilters({ filter, setFilter, className }: { filter: OrderFilter; setFilter: (value: OrderFilter) => void; className?: string }) { return <div className={className} role="group" aria-label="Filter orders">{filters.map((value) => <button key={value} type="button" className={filter === value ? styles.activeFilter : styles.filter} aria-pressed={filter === value} onClick={() => setFilter(value)}>{filterLabels[value]}</button>)}</div>; }
function formatOrderDate(value: string) { const date = new Date(value), today = new Date(); if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) return "Today"; return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(date); }
function orderProgressCopy(status: string, createdAt: string) { if (status === "PENDING") return "Waiting for seller confirmation"; if (status === "CONFIRMED") return "Seller confirmed your order"; if (status === "SHIPPED") return "On the way"; if (status === "FULFILLED") return `Delivered · ordered ${formatOrderDate(createdAt)}`; if (status === "CANCELLED") return "Cancelled"; return `Ordered ${formatOrderDate(createdAt)}`; }
function desktopPrimaryAction(status: string) { if (status === "SHIPPED") return "Track order"; if (status === "PENDING" || status === "CONFIRMED") return "View details"; return "View order"; }
function statusClass(status: string) { if (status === "FULFILLED") return styles.success; if (status === "CANCELLED") return styles.cancelled; if (status === "SHIPPED" || status === "CONFIRMED") return styles.info; return styles.pending; }
