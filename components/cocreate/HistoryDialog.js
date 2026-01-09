import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Clock, Calendar, ArrowRight } from "lucide-react";
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

const HistoryDialog = ({ isOpen, onClose, onLoadSession }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { fetchHistory, deleteSession } = useCanvasStore();
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const history = await fetchHistory();
            setSessions(history || []);
        } catch (error) {
            console.error("Failed to load history:", error);
            toast({
                title: "Error loading history",
                description: "Could not fetch past sessions.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e, sessionId) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this session?")) return;

        try {
            const success = await deleteSession(sessionId);
            if (success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                toast({
                    title: "Session deleted",
                    description: "The session has been removed from history."
                });
            }
        } catch (error) {
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-2xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        Session History
                    </DialogTitle>
                    <DialogDescription>
                        Restore your past co-creation sessions.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] pr-4 mt-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p>Loading your creative history...</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                            <Clock className="w-10 h-10 opacity-20" />
                            <p>No saved sessions found yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => onLoadSession(session)}
                                    className="group relative flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all cursor-pointer"
                                >
                                    <div className="flex flex-col gap-1">
                                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                            {session.name || "Untitled Session"}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(session.last_accessed).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDistanceToNow(new Date(session.last_accessed), { addSuffix: true })}
                                            </span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-600 border border-gray-200">
                                                {Array.isArray(session.nodes) ? session.nodes.length : 0} blocks
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => handleDelete(e, session.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default HistoryDialog;
