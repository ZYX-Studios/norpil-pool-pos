"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/app/components/ui/Modal";

interface Log {
    id: string;
    created_at: string;
    user_id: string | null;
    action_type: string;
    entity_type: string;
    entity_id: string | null;
    details: any;
}

interface LogsTableProps {
    logs: Log[];
    staffMap: Record<string, string>;
}

export default function LogsTable({ logs, staffMap }: LogsTableProps) {
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);

    const getActionColor = (action: string) => {
        const type = action.toUpperCase();
        if (type.includes("CREATE")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (type.includes("UPDATE")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        if (type.includes("DELETE")) return "bg-red-500/10 text-red-400 border-red-500/20";
        if (type.includes("LOGIN") || type.includes("AUTH")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
        return "bg-white/10 text-neutral-300 border-white/10";
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-neutral-400">
                    <thead className="bg-white/5 text-neutral-200">
                        <tr>
                            <th className="px-4 py-3 font-medium">Time</th>
                            <th className="px-4 py-3 font-medium">User</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Entity</th>
                            <th className="px-4 py-3 font-medium">Summary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className="cursor-pointer transition-colors hover:bg-white/10"
                            >
                                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                                    {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    {log.user_id ? staffMap[log.user_id] || "Unknown" : "System/Guest"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getActionColor(log.action_type)}`}>
                                        {log.action_type}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-neutral-200">{log.entity_type}</span>
                                        {log.entity_id && (
                                            <span className="font-mono text-[10px] text-neutral-500">
                                                {log.entity_id.slice(0, 8)}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 max-w-xs truncate text-xs font-mono text-neutral-500">
                                    {log.details ? JSON.stringify(log.details) : "-"}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                                    No logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Log Details"
                description={`Recorded on ${selectedLog ? format(new Date(selectedLog.created_at), "PPP p") : ""}`}
            >
                {selectedLog && (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4 rounded-lg bg-white/5 p-4 text-sm">
                            <div>
                                <span className="block text-xs font-medium text-neutral-500">User</span>
                                <span className="text-neutral-200">
                                    {selectedLog.user_id ? staffMap[selectedLog.user_id] || "Unknown" : "System/Guest"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs font-medium text-neutral-500">Action</span>
                                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${getActionColor(selectedLog.action_type).split(" ")[1]}`}>
                                    {selectedLog.action_type}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs font-medium text-neutral-500">Entity Type</span>
                                <span className="text-neutral-200">{selectedLog.entity_type}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-medium text-neutral-500">Entity ID</span>
                                <span className="font-mono text-neutral-200">{selectedLog.entity_id || "-"}</span>
                            </div>
                        </div>

                        {selectedLog.details && (
                            <div className="space-y-2">
                                <span className="text-sm font-medium text-neutral-400">Payload Details</span>
                                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-black/50 p-4">
                                    <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap break-all">
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}
