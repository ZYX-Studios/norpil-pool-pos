import Link from "next/link";
import { Logo } from "@/app/components/ui/Logo";
import { redirect } from "next/navigation";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { getGlobalShiftState } from "@/lib/shifts/actions";
import { TerminalLocked } from "@/app/components/shifts/TerminalLocked";
import { StartShiftOverlay } from "@/app/components/shifts/StartShiftOverlay";
import { HeaderActions } from "@/app/components/pos/HeaderActions";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
	const { user, staff, authError } = await getCurrentUserWithStaff();

	// If Supabase auth is reachable and there is no user, we treat this as a normal
	// unauthenticated state and send the person to login.
	if (!user && authError !== "supabase_unreachable") {
		redirect("/auth/login");
	}

	const shiftState = user && authError !== "supabase_unreachable"
		? await getGlobalShiftState()
		: { status: "NO_SHIFT" as const, activeShift: null, lastShift: null, lockedBy: undefined };

	// 1. Check if terminal is locked by someone else
	const isDev = process.env.NODE_ENV === "development";
	const isLocked = shiftState.status === "LOCKED_BY_OTHER" && shiftState.lockedBy;

	if (isLocked && !isDev) {
		return <TerminalLocked lockerName={shiftState.lockedBy!.name} />;
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-neutral-50 relative">
			{/* DEV BYPASS BANNER */}
			{isLocked && isDev && (
				<div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center">
					<p className="text-xs font-bold text-amber-500 tracking-wider">
						🚧 DEV MODE: POS LOCK BYPASSED ({shiftState.lockedBy!.name}) 🚧
					</p>
				</div>
			)}

			{/* 2. Blocking Start Shift Overlay if valid user but no active shift */}
			{shiftState.status === "NO_SHIFT" && authError !== "supabase_unreachable" && (
				<StartShiftOverlay />
			)}

			<div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4">
				<header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/50 backdrop-blur">
					<div className="flex items-center gap-3">
						<Logo className="h-10 w-10 text-white" />
						<div>
							<div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
								Norpil Billiards
							</div>
							<div className="text-sm sm:text-base font-semibold text-neutral-50">POS · Tables</div>
						</div>
					</div>
					{/* 
						Keep POS header controls readable on phones by allowing buttons to wrap.
						This is a simple mobile-friendly adjustment without adding a complex menu.
					*/}
					<HeaderActions
						user={user}
						staff={staff}
						authError={authError || undefined}
						activeShift={shiftState.activeShift}
					/>
				</header>
				<main className="flex-1 rounded-2xl border border-white/10 bg-neutral-950/60 p-4 shadow-inner shadow-black/60">
					{children}
				</main>
			</div>
		</div>
	);
}
