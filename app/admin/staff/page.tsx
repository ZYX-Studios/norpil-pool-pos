import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateStaffAction } from "./actions";

export const dynamic = "force-dynamic";

type StaffRow = {
	id: string;
	user_id: string;
	name: string;
	role: "ADMIN" | "CASHIER" | "WAITER";
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const supabase = createSupabaseServerClient();
	const { data } = await supabase
		.from("staff")
		.select("id, user_id, name, role")
		.order("name", { ascending: true });

	const staff = (data ?? []) as StaffRow[];
	const sp = await searchParams;
	const ok = sp?.ok;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">Staff</h1>
					<p className="text-xs text-neutral-400">Manage who can use Norpil Billiards POS and who has admin access.</p>
				</div>
			</div>

			{ok && (
				<div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
					Staff updated.
				</div>
			)}

			{/* 
				Make staff table scroll horizontally on very small screens.
				This keeps all columns accessible on phones without breaking the layout.
			*/}
			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur overflow-x-auto">
				<table className="w-full min-w-[480px] text-xs text-neutral-100">
					<thead className="text-left text-neutral-400">
						<tr>
							<th className="py-2">Name / Identifier</th>
							<th>Role</th>
							<th className="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{staff.map((s) => (
							<tr key={s.id} className="border-t border-white/10">
								<td className="py-2">
									<div className="text-xs font-medium text-neutral-50">{s.name}</div>
									<div className="text-[10px] text-neutral-500">{s.user_id}</div>
								</td>
								<td className="align-middle">
									<span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-200">
										{s.role}
									</span>
								</td>
								<td className="text-right">
									<details className="inline-block">
										<summary className="cursor-pointer select-none rounded-full border border-white/15 px-3 py-1 text-[11px] hover:bg-white/10">
											Edit
										</summary>
										<form action={updateStaffAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
											<input type="hidden" name="id" value={s.id} />
											<input
												name="name"
												defaultValue={s.name}
												className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-50 sm:col-span-2"
												required
											/>
											<select
												name="role"
												defaultValue={s.role}
												className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-50 sm:col-span-1"
											>
												<option value="ADMIN">ADMIN</option>
												<option value="CASHIER">CASHIER</option>
												<option value="WAITER">WAITER</option>
											</select>
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
								</td>
							</tr>
						))}
						{staff.length === 0 && (
							<tr>
								<td colSpan={3} className="py-4 text-center text-neutral-500">
									No staff yet. Users are auto-created after their first login.
								</td>
							</tr>
						)}
					</tbody>
				</table>
				<p className="mt-3 text-[11px] text-neutral-500">
					New staff appear here automatically after their first successful login. You can then promote them to ADMIN or change
					their role.
				</p>
			</div>
		</div>
	);
}


