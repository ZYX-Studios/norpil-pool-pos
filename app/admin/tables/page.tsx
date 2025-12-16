import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTableAction, updateTableAction, toggleTableActiveAction } from "./actions";
import { TableDeleteButton } from "./TableDeleteButton";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PoolTable = {
	id: string;
	name: string;
	hourly_rate: number;
	is_active: boolean;
};

export default async function TablesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const { staff: currentStaff } = await getCurrentUserWithStaff();
	if (currentStaff?.role !== "ADMIN") redirect("/admin");

	const supabase = createSupabaseServerClient();

	const { data } = await supabase
		.from("pool_tables")
		.select("id, name, hourly_rate, is_active")
		.is("deleted_at", null)
		.order("name", { ascending: true });

	const tables = (data ?? []) as PoolTable[];
	const sp = await searchParams;
	const ok = sp?.ok;

	return (
		<div className="space-y-4">
			<h1 className="text-3xl font-semibold">Tables</h1>

			{ok && (
				<div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
					Changes saved.
				</div>
			)}

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur">
				<h2 className="mb-3 text-lg font-semibold">Add Table</h2>
				<form action={createTableAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
					<input name="name" placeholder="Table Name" className="rounded border border-white/10 bg-black/40 px-4 py-3 text-base text-neutral-50 sm:col-span-2" required />
					<input name="hourly_rate" placeholder="Hourly Rate" type="number" step="0.01" min="0" className="rounded border border-white/10 bg-black/40 px-4 py-3 text-base text-neutral-50" required />
					<div className="sm:col-span-1">
						<button type="submit" className="h-full w-full rounded-full bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-900 hover:bg-neutral-200">
							Add table
						</button>
					</div>
				</form>
			</div>

			{/* 
				Allow the tables list to scroll horizontally on mobile.
				This avoids layout breakage when there are many columns on narrow screens.
			*/}
			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur overflow-x-auto">
				<table className="w-full min-w-[520px] text-base text-neutral-100">
					<thead className="text-left text-neutral-600">
						<tr>
							<th className="py-3">Name</th>
							<th className="text-right">Hourly rate</th>
							<th className="text-center">Status</th>
							<th className="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{tables.map((t) => (
							<tr key={t.id} className="border-t border-white/10">
								<td className="py-3">{t.name}</td>
								<td className="text-right">₱{Number(t.hourly_rate).toFixed(2)}/hr</td>
								<td className="text-center">
									<span
										className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${t.is_active ? "bg-emerald-500/20 text-emerald-200" : "bg-neutral-700/50 text-neutral-300"
											}`}
									>
										{t.is_active ? "ACTIVE" : "HIDDEN"}
									</span>
								</td>
								<td className="text-right">
									<div className="flex justify-end gap-2">
										<form action={toggleTableActiveAction} className="inline">
											<input type="hidden" name="id" value={t.id} />
											<input type="hidden" name="is_active" value={String(t.is_active)} />
											<button
												type="submit"
												className="rounded-full border border-white/15 px-3 py-1 text-[11px] hover:bg-white/10"
											>
												{t.is_active ? "Hide" : "Show"}
											</button>
										</form>
										<details className="inline-block">
											<summary className="cursor-pointer select-none rounded-full border border-white/15 px-3 py-1 text-[11px] hover:bg-white/10">
												Edit
											</summary>
											<form action={updateTableAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
												<input type="hidden" name="id" value={t.id} />
												<input
													name="name"
													defaultValue={t.name}
													className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-50 sm:col-span-2"
													required
												/>
												<input
													name="hourly_rate"
													type="number"
													step="0.01"
													min="0"
													defaultValue={String(t.hourly_rate)}
													className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-50 sm:col-span-1"
													required
												/>
												<div className="sm:col-span-3">
													<button
														type="submit"
														className="rounded-full bg-neutral-50 px-3 py-1 text-[11px] font-medium text-neutral-900 hover:bg-neutral-200"
													>
														Save
													</button>
												</div>
											</form>
										</details>
										<TableDeleteButton id={t.id} name={t.name} />
									</div>
								</td>
							</tr>
						))}
						{tables.length === 0 && (
							<tr>
								<td colSpan={4} className="py-4 text-center text-neutral-500">
									No tables yet. Add your first table above.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}




