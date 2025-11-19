export const dynamic = 'force-dynamic';
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { openTableAction } from "./actions";
import { ClientTimer } from "./ClientTimer";

type PoolTable = {
	id: string;
	name: string;
	is_active: boolean;
	hourly_rate: number;
};

type OpenSession = {
	id: string;
	pool_table_id: string;
	opened_at: string;
	override_hourly_rate: number | null;
};

async function getData() {
	const supabase = createSupabaseServerClient();

	const [{ data: tables }, { data: sessions }] = await Promise.all([
		supabase.from("pool_tables").select("id, name, is_active, hourly_rate").order("name", { ascending: true }),
		supabase
			.from("table_sessions")
			.select("id, pool_table_id, opened_at, override_hourly_rate")
			.eq("status", "OPEN"),
	]);

	// Fetch open orders for sessions to compute current items total
	const sessionIds = (sessions ?? []).map((s) => s.id);
	const { data: orders } =
		sessionIds.length > 0
			? await supabase
					.from("orders")
					.select("id, table_session_id, subtotal, tax_total, service_charge, discount_amount")
					.in("table_session_id", sessionIds)
					.eq("status", "OPEN")
			: { data: [] as any[] };

	const sessionIdToOrderTotal = new Map<string, number>();
	for (const o of orders ?? []) {
		const totalNow = Number(o.subtotal || 0) + Number(o.tax_total || 0) + Number(o.service_charge || 0) - Number(o.discount_amount || 0);
		sessionIdToOrderTotal.set(o.table_session_id as string, Number(totalNow.toFixed(2)));
	}

	return {
		tables: (tables ?? []) as PoolTable[],
		openSessions: (sessions ?? []) as OpenSession[],
		sessionIdToOrderTotal,
	};
}

export default async function PosHome() {
	const { tables, openSessions, sessionIdToOrderTotal } = await getData();
	const tableIdToSession = new Map<string, OpenSession>();
	for (const s of openSessions) {
		tableIdToSession.set(s.pool_table_id, s);
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">Tables</h1>
					<p className="text-xs text-neutral-400">Open and manage live pool sessions seamlessly.</p>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{tables.map((t) => {
					const session = tableIdToSession.get(t.id);
					const orderItemsTotal = session ? sessionIdToOrderTotal.get(session.id) ?? 0 : 0;
					return (
						<div
							key={t.id}
							className={`group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur transition hover:border-emerald-400/60 hover:bg-white/10 ${session ? "ring-1 ring-emerald-500/40" : ""}`}
						>
							<div className="mb-3 flex items-center justify-between">
								<div className="text-sm font-medium text-neutral-50 sm:text-base">{t.name}</div>
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${session ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/60 text-neutral-200"}`}
								>
									{session ? "IN USE" : "FREE"}
								</span>
							</div>
							{session ? (
								<div className="space-y-3">
									<ClientTimer
										openedAt={session.opened_at}
										hourlyRate={Number(session.override_hourly_rate ?? t.hourly_rate)}
										itemTotal={orderItemsTotal}
									/>
									<div className="flex items-center justify-between text-xs text-neutral-400">
										<span>Items total updates in real time.</span>
										<span className="font-mono text-[11px] opacity-70">₱{orderItemsTotal.toFixed(2)}</span>
									</div>
									<div className="pt-1">
										<Link
											className="inline-flex items-center rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-900 transition group-hover:bg-emerald-400 group-hover:text-neutral-950"
											href={`/pos/${session.id}`}
										>
											View session
										</Link>
									</div>
								</div>
							) : (
								<form action={openTableAction.bind(null, t.id)}>
									<button
										type="submit"
										className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-400"
									>
										Open table
									</button>
								</form>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" }).format(n);
}


