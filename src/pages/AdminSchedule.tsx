import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { handleFirestoreError, OperationType } from "@/src/lib/errorHandlers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ArrowRight,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  FileText,
  Users,
  ShieldCheck,
  ClipboardList,
  Pill,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/src/lib/AuthContext";

const AdminSchedule: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState("active");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [allFlocks, setAllFlocks] = useState<any[]>([]);
  const [selectedFarmerFlocks, setSelectedFarmerFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<
    "list" | "template-editor" | "assign-editor" | "progress"
  >("list");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    type: "schedule" | "template";
  } | null>(null);
  const [overwriteConfirmation, setOverwriteConfirmation] = useState<{
    existingId: string;
    form: any;
  } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    days: [] as any[],
    visibilityDaysBefore: 7,
  });

  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);

  const [assignForm, setAssignForm] = useState({
    userId: "",
    flockId: "",
    templateId: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    visibilityDaysBefore: 7,
  });

  useEffect(() => {
    if (!profile) return;

    // 1. Fetch Users (Farmers)
    const farmersQuery = isManager
      ? query(
          collection(db, "users"),
          where("role", "==", "farmer"),
          where("managerId", "==", profile.uid),
        )
      : query(collection(db, "users"), where("role", "==", "farmer"));

    const unsubUsers = onSnapshot(farmersQuery, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach((doc) => (map[doc.id] = { id: doc.id, ...doc.data() }));
      setUsers(map);
    });

    // 2. Fetch Templates
    const unsubTemplates = onSnapshot(
      collection(db, "scheduleTemplates"),
      (snap) => {
        setTemplates(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, "scheduleTemplates"),
    );

    // 3. Fetch Active Schedules
    const unsubSchedules = onSnapshot(
      collection(db, "schedules"),
      (snap) => {
        setSchedules(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, "schedules"),
    );

    // 4. Fetch All Flocks
    const unsubFlocks = onSnapshot(
      collection(db, "flocks"),
      (snap) => {
        setAllFlocks(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, "flocks"),
    );

    return () => {
      unsubUsers();
      unsubTemplates();
      unsubSchedules();
      unsubFlocks();
    };
  }, [profile, isManager]);

  useEffect(() => {
    if (assignForm.userId) {
      const farmerFlocks = allFlocks.filter(
        (f) => f.userId === assignForm.userId && f.status === "Active",
      );
      setSelectedFarmerFlocks(farmerFlocks);
    } else {
      setSelectedFarmerFlocks([]);
    }
  }, [assignForm.userId, allFlocks]);

  const handleSaveTemplate = async () => {
    if (!templateForm.name) {
      toast.error("Template name is required");
      return;
    }

    try {
      if (editingTemplate) {
        await updateDoc(
          doc(db, "scheduleTemplates", editingTemplate.id),
          templateForm,
        );
        toast.success("Template updated");
      } else {
        await addDoc(collection(db, "scheduleTemplates"), {
          ...templateForm,
          createdAt: new Date().toISOString(),
        });
        toast.success("Template created");
      }
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        description: "",
        days: [],
        visibilityDaysBefore: 7,
      });
      return true;
    } catch (err) {
      toast.error("Failed to save template");
      handleFirestoreError(
        err,
        editingTemplate ? OperationType.UPDATE : OperationType.CREATE,
        "scheduleTemplates",
      );
      return false;
    }
  };

  const handleAddTask = () => {
    setTemplateForm((prev) => ({
      ...prev,
      days: [
        ...prev.days,
        {
          day: prev.days.length + 1,
          title: "",
          description: "",
          category: "Vaccination",
          videoUrl: "",
        },
      ],
    }));
  };

  const removeTask = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== index),
    }));
  };

  const updateTask = (index: number, updates: any) => {
    setTemplateForm((prev) => ({
      ...prev,
      days: prev.days.map((task, i) =>
        i === index ? { ...task, ...updates } : task,
      ),
    }));
  };

  const processOverwrite = async () => {
    if (!overwriteConfirmation) return;
    try {
      await updateDoc(doc(db, "schedules", overwriteConfirmation.existingId), {
        ...overwriteConfirmation.form,
        status: "active",
        updatedAt: new Date().toISOString(),
        completedDays: [],
        watchedVideos: [],
      });
      toast.success("Schedule overwritten successfully");
      setOverwriteConfirmation(null);
      setViewMode("list");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "schedules");
    }
  };

  const handleAssignSchedule = async () => {
    if (!assignForm.userId || !assignForm.templateId || !assignForm.flockId) {
      toast.error("Please select farmer, batch, and template");
      return false;
    }

    try {
      // If we are explicitly editing a specific schedule ID
      if (editingSchedule) {
        await updateDoc(doc(db, "schedules", editingSchedule.id), {
          ...assignForm,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Schedule updated successfully");
        setEditingSchedule(null);
        return true;
      }

      // Check if this batch already has a schedule assigned (for creation flow)
      const existing = schedules.find(
        (s) =>
          s.userId === assignForm.userId && s.flockId === assignForm.flockId,
      );

      if (existing) {
        setOverwriteConfirmation({
          existingId: existing.id,
          form: { ...assignForm },
        });
        return false; // Exit to show confirmation dialog
      } else {
        await addDoc(collection(db, "schedules"), {
          ...assignForm,
          completedDays: [],
          watchedVideos: [],
          status: "active",
          createdAt: new Date().toISOString(),
        });
        toast.success("Schedule assigned and deployed");
      }
      return true;
    } catch (err) {
      handleFirestoreError(
        err,
        editingSchedule ? OperationType.UPDATE : OperationType.CREATE,
        "schedules",
      );
      return false;
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteDoc(doc(db, "schedules", id));
      toast.success("Schedule cancelled and removed");
      setDeleteConfirmation(null);
    } catch (err) {
      toast.error("Failed to delete schedule");
      handleFirestoreError(err, OperationType.DELETE, "schedules");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, "scheduleTemplates", id));
      toast.success("Strategy template deleted");
      setDeleteConfirmation(null);
    } catch (err) {
      toast.error("Failed to delete template");
      handleFirestoreError(err, OperationType.DELETE, "scheduleTemplates");
    }
  };

  const getFarmerName = (uid: string) => users[uid]?.name || "Unknown Farmer";

  const displaySchedules = schedules.filter((s) => !!users[s.userId]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">
            Batch Scheduling
          </h1>
          <p className="text-slate-500 font-medium italic">
            Manage vaccination & medicine roadmaps for your farmers.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            className="rounded-2xl bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 font-bold px-6 h-12 shadow-sm"
            onClick={() => {
              setEditingTemplate(null);
              setTemplateForm({
                name: "",
                description: "",
                days: [],
                visibilityDaysBefore: 7,
              });
              setViewMode("template-editor");
            }}
          >
            <Plus size={18} className="mr-2" />
            New Template
          </Button>
          <Button
            className="rounded-2xl bg-[#122B21] text-white hover:bg-[#1a3d2e] font-bold px-6 h-12 shadow-lg shadow-emerald-900/20"
            onClick={() => {
              setAssignForm({
                userId: "",
                flockId: "",
                templateId: "",
                startDate: format(new Date(), "yyyy-MM-dd"),
                visibilityDaysBefore: 7,
              });
              setViewMode("assign-editor");
            }}
          >
            <Calendar size={18} className="mr-2" />
            Assign Schedule
          </Button>
        </div>
      </div>

      {viewMode === "assign-editor" ? (
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
            <div>
              <h2 className="text-2xl font-black text-slate-900 italic">
                Assign Batch Roadmap
              </h2>
              <p className="text-sm font-medium text-slate-400 italic">
                Deploy a standardized strategy to a farmer's batch.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setViewMode("list")}
              className="rounded-xl font-bold text-slate-400"
            >
              Back to Overview
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    1. Choose Farmer
                  </label>
                  <select
                    value={assignForm.userId}
                    onChange={(e) =>
                      setAssignForm({
                        ...assignForm,
                        userId: e.target.value,
                        flockId: "",
                      })
                    }
                    className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-sm font-black text-slate-900 px-6 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a farmer...</option>
                    {Object.values(users).map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    2. Select Active Batch
                  </label>
                  <select
                    value={assignForm.flockId}
                    disabled={!assignForm.userId}
                    onChange={(e) => {
                      const flock = selectedFarmerFlocks.find(
                        (f) => f.id === e.target.value,
                      );
                      setAssignForm({
                        ...assignForm,
                        flockId: e.target.value,
                        startDate: flock
                          ? flock.placementDate
                          : assignForm.startDate,
                      });
                    }}
                    className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-sm font-black text-slate-900 px-6 transition-all appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {assignForm.userId
                        ? "Choose batch..."
                        : "Select farmer first"}
                    </option>
                    {selectedFarmerFlocks.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.flockId} - {f.breed}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    3. Select Roadmap Template
                  </label>
                  <select
                    value={assignForm.templateId}
                    onChange={(e) => {
                      const template = templates.find(
                        (t) => t.id === e.target.value,
                      );
                      setAssignForm({
                        ...assignForm,
                        templateId: e.target.value,
                        visibilityDaysBefore:
                          template?.visibilityDaysBefore ??
                          assignForm.visibilityDaysBefore,
                      });
                    }}
                    className="w-full h-14 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-sm font-black text-slate-900 px-6 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choose a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    4. Deployment Date
                  </label>
                  <Input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) =>
                      setAssignForm({
                        ...assignForm,
                        startDate: e.target.value,
                      })
                    }
                    className="h-14 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-sm font-black text-slate-900 px-6 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    5. Visibility Window
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={assignForm.visibilityDaysBefore}
                      onChange={(e) =>
                        setAssignForm({
                          ...assignForm,
                          visibilityDaysBefore: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-14 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl text-sm font-black text-slate-900 px-6 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">
                      DAYS BEFORE
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold italic px-2">
                    Farmers only see tasks starting this many days in advance.
                  </p>
                </div>
              </div>

              <div className="pt-10 flex gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setViewMode("list")}
                  className="rounded-2xl font-bold px-10 h-14 uppercase tracking-widest text-[10px] text-slate-400"
                >
                  Discard
                </Button>
                <Button
                  onClick={async () => {
                    const success = await handleAssignSchedule();
                    if (success) setViewMode("list");
                  }}
                  className="rounded-2xl bg-[#122B21] text-white hover:bg-black font-black flex-1 h-14 shadow-2xl shadow-emerald-900/20 uppercase tracking-widest text-[10px]"
                >
                  {editingSchedule
                    ? "Update & Re-deploy Schedule"
                    : "Confirm & Deploy Schedule"}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-5 border-l border-slate-50 pl-12">
              <div className="bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100 h-full">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">
                  Validation Summary
                </h4>

                {!assignForm.userId ||
                !assignForm.flockId ||
                !assignForm.templateId ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 opacity-20">
                    <ClipboardList size={48} className="text-slate-400 mb-4" />
                    <p className="font-bold text-slate-400 text-center">
                      Incomplete Logic
                      <br />
                      <span className="text-[10px] uppercase font-black">
                        Fill all fields to verify
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
                        Batch Context
                      </p>
                      {(() => {
                        const flock = selectedFarmerFlocks.find(
                          (f) => f.id === assignForm.flockId,
                        );
                        if (!flock) return null;
                        const age = Math.ceil(
                          (new Date().getTime() -
                            new Date(flock.placementDate).getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                        return (
                          <div className="grid grid-cols-2 gap-y-4">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Breed
                              </p>
                              <p className="font-black text-slate-900">
                                {flock.breed}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Population
                              </p>
                              <p className="font-black text-slate-900">
                                {flock.chickCount} Birds
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Current Age
                              </p>
                              <p className="font-black text-slate-900">
                                {age} Days Old
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Placement
                              </p>
                              <p className="font-black text-slate-900 italic text-xs">
                                {format(
                                  new Date(flock.placementDate),
                                  "dd MMM yyyy",
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-[#122B21] p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/10">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">
                        Strategy Details
                      </p>
                      {(() => {
                        const template = templates.find(
                          (t) => t.id === assignForm.templateId,
                        );
                        if (!template) return null;
                        return (
                          <div className="space-y-3">
                            <h5 className="text-lg font-black italic">
                              {template.name}
                            </h5>
                            <p className="text-xs text-white/60 font-medium leading-relaxed">
                              {template.description}
                            </p>
                            <div className="pt-3 flex items-center justify-between border-t border-white/10">
                              <span className="text-[10px] font-black uppercase text-emerald-400">
                                {template.days?.length || 0} Action Steps
                              </span>
                              <ShieldCheck
                                size={16}
                                className="text-emerald-400"
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <p className="text-[10px] text-slate-400 font-bold italic px-4 leading-relaxed">
                      * Deploying this roadmap will automatically populate the
                      farmer's schedule based on the Day offsets defined in the
                      template.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === "progress" ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-[700px]">
          <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 rounded-t-[2.5rem]">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-[#122B21] flex items-center justify-center text-emerald-400">
                <TrendingUp size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 italic">
                  Batch Roadmap Progress
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px]">
                    {getFarmerName(viewingSchedule?.userId)}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400">
                    •
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Strategy: {viewingSchedule?.template?.name}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setViewMode("list")}
              className="rounded-xl font-bold border-slate-200 text-slate-600 h-12 px-6"
            >
              Back to Overview
            </Button>
          </div>

          <div className="flex-1 p-10 overflow-y-auto max-h-[650px] custom-scrollbar">
            <div className="grid grid-cols-1 gap-6">
              {viewingSchedule?.template?.days
                ?.sort((a: any, b: any) => a.day - b.day)
                .map((task: any, idx: number) => {
                  const taskDate = new Date(viewingSchedule.startDate);
                  taskDate.setDate(taskDate.getDate() + (task.day - 1));
                  const isPast =
                    taskDate < new Date(new Date().setHours(0, 0, 0, 0));
                  const isToday =
                    format(new Date(), "yyyy-MM-dd") ===
                    format(taskDate, "yyyy-MM-dd");
                  const isCompleted = viewingSchedule.completedDays?.includes(
                    task.day,
                  );
                  const hasWatchedVideo =
                    viewingSchedule.watchedVideos?.includes(task.day);

                  // Find specific logs
                  const completionLog = viewingSchedule.completionLogs?.find(
                    (l: any) => l.day === task.day,
                  );
                  const watchLog = viewingSchedule.videoWatchLogs?.find(
                    (l: any) => l.day === task.day,
                  );

                  return (
                    <Card
                      key={idx}
                      className={`border-none shadow-none rounded-[1.5rem] transition-all ${
                        isToday
                          ? "bg-emerald-50/50 border-2 border-emerald-100 shadow-sm"
                          : isCompleted
                            ? "bg-slate-50/50 border border-slate-100 opacity-80"
                            : "bg-white border border-slate-100"
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                          <div className="flex items-center gap-6 lg:w-1/3">
                            <div className="flex flex-col items-center shrink-0 w-14 h-14 rounded-2xl bg-white border border-slate-100 justify-center shadow-sm">
                              <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">
                                Day
                              </p>
                              <p
                                className={`text-xl font-black ${isToday ? "text-emerald-700" : "text-slate-900"}`}
                              >
                                {task.day}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                                {format(taskDate, "EEEE, MMM dd, yyyy")}
                              </p>
                              <h5 className="font-black text-slate-900 text-lg leading-tight">
                                {task.title}
                              </h5>
                              <Badge
                                className={`mt-2 text-[8px] border-none font-black ${
                                  task.category === "Vaccination"
                                    ? "bg-amber-100 text-amber-600"
                                    : task.category === "Medicine Plan"
                                      ? "bg-indigo-100 text-indigo-600"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {task.category}
                              </Badge>
                            </div>
                          </div>

                          <div className="hidden lg:block h-12 w-px bg-slate-100"></div>

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Video Engagement
                              </p>
                              {task.videoUrl ? (
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasWatchedVideo ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-300"}`}
                                  >
                                    {hasWatchedVideo ? (
                                      <CheckCircle2 size={16} />
                                    ) : (
                                      <Clock size={16} />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-800">
                                      {hasWatchedVideo
                                        ? "VIDEO WATCHED"
                                        : "NOT WATCHED"}
                                    </p>
                                    {watchLog && (
                                      <p className="text-[10px] font-medium text-slate-500 italic">
                                        at{" "}
                                        {format(
                                          new Date(watchLog.timestamp),
                                          "HH:mm • dd MMM",
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-300 font-bold italic">
                                  No video guide provided
                                </p>
                              )}
                            </div>

                            <div className="space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Task Completion
                              </p>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 size={16} />
                                  ) : (
                                    <Clock size={16} />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-800">
                                    {isCompleted ? "MARKED AS DONE" : "PENDING"}
                                  </p>
                                  {completionLog && (
                                    <p className="text-[10px] font-medium text-slate-500 italic">
                                      at{" "}
                                      {format(
                                        new Date(completionLog.timestamp),
                                        "HH:mm • dd MMM",
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        </div>
      ) : viewMode === "template-editor" ? (
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
            <div>
              <h2 className="text-2xl font-black text-slate-900 italic">
                {editingTemplate ? "Edit Roadmap" : "Configure New Roadmap"}
              </h2>
              <p className="text-sm font-medium text-slate-400 italic">
                Design the sequence of vaccinations and milestones.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setViewMode("list")}
              className="rounded-xl font-bold text-slate-400"
            >
              Cancel & Return
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Strategy Name (Breeds/Method)
              </label>
              <Input
                placeholder="e.g., Broiler Path - standard"
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, name: e.target.value })
                }
                className="rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white h-14 text-sm font-black text-slate-900 px-6 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Plan Objective
              </label>
              <Input
                placeholder="e.g., Summer optimized vaccination cycle"
                value={templateForm.description}
                onChange={(e) =>
                  setTemplateForm({
                    ...templateForm,
                    description: e.target.value,
                  })
                }
                className="rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white h-14 text-sm font-black text-slate-900 px-6 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Default Visibility Window
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="7"
                  value={templateForm.visibilityDaysBefore}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      visibilityDaysBefore: parseInt(e.target.value) || 0,
                    })
                  }
                  className="rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white h-14 text-sm font-black text-slate-900 px-6 transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">
                  DAYS
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                Roadmap Steps ({templateForm.days.length})
              </h4>
              <Button
                onClick={handleAddTask}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold h-11 rounded-2xl px-6 border-none shadow-none"
              >
                <Plus size={18} className="mr-2" /> Add Next Step
              </Button>
            </div>

            <div className="space-y-4">
              {templateForm.days.map((task, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8 grid grid-cols-12 gap-8 items-start hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all"
                >
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                      Day No.
                    </label>
                    <Input
                      type="number"
                      value={task.day}
                      onChange={(e) =>
                        updateTask(idx, { day: parseInt(e.target.value) })
                      }
                      className="h-14 bg-white border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-900 text-center"
                    />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                      Step Category
                    </label>
                    <select
                      value={task.category}
                      onChange={(e) =>
                        updateTask(idx, { category: e.target.value })
                      }
                      className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl text-[11px] font-black text-slate-900 px-4 focus:ring-2 focus:ring-slate-900 outline-none appearance-none cursor-pointer"
                    >
                      <option value="Vaccination">Vaccination</option>
                      <option value="Medicine Plan">Medicine Plan</option>
                      <option value="Special Feed">Feed Change</option>
                      <option value="General Checkup">Daily Stats</option>
                    </select>
                  </div>
                  <div className="col-span-6 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                      Task Title
                    </label>
                    <Input
                      value={task.title}
                      placeholder="Enter description..."
                      onChange={(e) =>
                        updateTask(idx, { title: e.target.value })
                      }
                      className="h-14 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 px-6"
                    />
                  </div>
                  <div className="col-span-1 pt-8 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl"
                      onClick={() => removeTask(idx)}
                    >
                      <Trash2 size={20} />
                    </Button>
                  </div>
                  <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">
                        Instructions for Farmer
                      </label>
                      <Textarea
                        value={task.description}
                        placeholder="Provide specific dosage or handling instructions..."
                        onChange={(e) =>
                          updateTask(idx, { description: e.target.value })
                        }
                        className="bg-white border-2 border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-600 min-h-[100px] p-6 focus:border-slate-900 transition-all resize-none leading-relaxed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">
                        Video Guide Link (YouTube/Drive)
                      </label>
                      <div className="relative group/input">
                        <Input
                          value={task.videoUrl || ""}
                          placeholder="Paste link here..."
                          onChange={(e) =>
                            updateTask(idx, { videoUrl: e.target.value })
                          }
                          className="h-14 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 px-6 pr-12"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-emerald-500">
                          <Plus size={18} />
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold italic ml-1 leading-tight">
                        Farmers will see a direct button to watch this guide
                        when they view their daily roadmap.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {templateForm.days.length === 0 && (
                <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold italic">
                    Start adding steps to build your roadmap.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-10 border-t border-slate-50 mt-12">
              <Button
                variant="ghost"
                onClick={() => setViewMode("list")}
                className="rounded-2xl font-bold px-10 h-14 uppercase tracking-widest text-[10px] text-slate-400"
              >
                Discard
              </Button>
              <Button
                onClick={async () => {
                  await handleSaveTemplate();
                  setViewMode("list");
                }}
                className="rounded-2xl bg-[#122B21] text-white hover:bg-black font-black px-16 h-14 shadow-2xl shadow-emerald-900/20 uppercase tracking-widest text-[10px]"
              >
                Finalize Roadmap
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-8 h-12">
            <TabsTrigger
              value="active"
              className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-[#122B21] data-[state=active]:text-white h-full"
            >
              Active Schedules
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-[#122B21] data-[state=active]:text-white h-full"
            >
              Templates Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="grid grid-cols-1 gap-4">
              {displaySchedules.map((schedule) => {
                const template = templates.find(
                  (t) => t.id === schedule.templateId,
                );
                const farmer = users[schedule.userId];

                return (
                  <Card
                    key={schedule.id}
                    className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group"
                  >
                    <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Users size={32} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900">
                            {farmer?.name || "Anonymous"}
                          </h3>
                          <p className="text-sm font-medium text-slate-500">
                            {farmer?.email}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] uppercase tracking-tighter">
                              Active Batch
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400">
                              Started:{" "}
                              {format(
                                new Date(schedule.startDate),
                                "MMM dd, yyyy",
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="h-12 w-px bg-slate-100 hidden md:block"></div>

                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Assigned Plan
                        </p>
                        <h4 className="font-bold text-slate-900">
                          {template?.name || "Loading Template..."}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {template?.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          onClick={() => {
                            setEditingSchedule(schedule);
                            setAssignForm({
                              userId: schedule.userId,
                              flockId: schedule.flockId,
                              templateId: schedule.templateId,
                              startDate: schedule.startDate,
                              visibilityDaysBefore:
                                schedule.visibilityDaysBefore ?? 7,
                            });
                            setViewMode("assign-editor");
                          }}
                        >
                          <Edit2 size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation({
                              id: schedule.id,
                              type: "schedule",
                            });
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                        <Button
                          className="rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold border-none px-4 text-xs h-10"
                          onClick={() => {
                            setViewingSchedule({ ...schedule, template });
                            setViewMode("progress");
                          }}
                        >
                          View Progress
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {displaySchedules.length === 0 && !loading && (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold italic">
                    No active farmer schedules assigned yet.
                  </p>
                  <Button
                    variant="link"
                    className="text-emerald-600 font-bold mt-2"
                    onClick={() => setViewMode("assign-editor")}
                  >
                    Assign First Schedule
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500 border border-transparent hover:border-emerald-100"
                >
                  <div className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                        <FileText size={24} />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setEditingTemplate(template);
                            setTemplateForm({
                              name: template.name,
                              description: template.description || "",
                              days: template.days || [],
                              visibilityDaysBefore: template.visibilityDaysBefore || 7,
                            });
                            setViewMode("template-editor");
                          }}
                        >
                          <Edit2 size={14} className="text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full w-8 h-8 opacity-40 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation({
                              id: template.id,
                              type: "template",
                            });
                          }}
                        >
                          <Trash2 size={16} className="text-rose-400" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 h-8">
                      {template.description}
                    </p>
                  </div>

                  <div className="px-8 pb-8 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-50">
                      <Clock size={12} />
                      {template.days?.length || 0} Scheduled Events
                    </div>

                    <div className="space-y-2">
                      {template.days
                        ?.slice(0, 3)
                        .map((day: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 text-xs"
                          >
                            <span className="w-8 font-black text-slate-300">
                              D{day.day}
                            </span>
                            <span className="text-slate-600 font-medium truncate">
                              {day.title}
                            </span>
                            <Badge
                              className={`ml-auto text-[8px] border-none ${day.category === "Vaccination" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"}`}
                            >
                              {day.category === "Vaccination" ? "V" : "M"}
                            </Badge>
                          </div>
                        ))}
                      {template.days?.length > 3 && (
                        <p className="text-[10px] text-slate-400 font-bold italic ml-11">
                          +{template.days.length - 3} more days scheduled
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Custom Overwrite Confirmation Dialog */}
      <Dialog
        open={!!overwriteConfirmation}
        onOpenChange={(open) => !open && setOverwriteConfirmation(null)}
      >
        <DialogContent className="max-w-md rounded-[2rem] p-8 border-none overflow-hidden text-center">
          <DialogHeader className="mb-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 text-amber-500">
              <Clock size={32} />
            </div>
            <DialogTitle className="text-2xl font-black italic">
              Overwrite Schedule?
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 italic">
              This batch already has a roadmap assigned. Overwriting will reset
              the farmer's progress. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => setOverwriteConfirmation(null)}
              className="flex-1 rounded-2xl font-bold h-12 text-slate-400"
            >
              Keep Current
            </Button>
            <Button
              className="flex-1 rounded-2xl bg-[#122B21] hover:bg-black text-white font-black h-12 shadow-xl shadow-emerald-900/10"
              onClick={processOverwrite}
            >
              OVERWRITE
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmation}
        onOpenChange={(open) => !open && setDeleteConfirmation(null)}
      >
        <DialogContent className="max-w-md rounded-[2rem] p-8 border-none overflow-hidden">
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4 text-red-500">
              <Trash2 size={32} />
            </div>
            <DialogTitle className="text-2xl font-black italic">
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 italic">
              {deleteConfirmation?.type === "schedule"
                ? "Are you sure you want to cancel this batch schedule? This will stop all tracking for the farmer."
                : "Are you sure you want to delete this template strategy? Assigned schedules will remain unaffected."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmation(null)}
              className="flex-1 rounded-2xl font-bold h-12 text-slate-400"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black h-12 shadow-xl shadow-red-900/10"
              onClick={() => {
                if (deleteConfirmation?.type === "schedule") {
                  handleDeleteSchedule(deleteConfirmation.id);
                } else if (deleteConfirmation?.type === "template") {
                  handleDeleteTemplate(deleteConfirmation.id);
                }
              }}
            >
              DELETE
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={isProgressModalOpen} onOpenChange={setIsProgressModalOpen}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-8 border-none overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0 mb-6">
            <DialogTitle className="text-2xl font-black italic">
              Batch Roadmap Progress
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 italic">
              Tracking for {getFarmerName(viewingSchedule?.userId)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {viewingSchedule?.template?.days
              ?.sort((a: any, b: any) => a.day - b.day)
              .map((task: any, idx: number) => {
                const taskDate = new Date(viewingSchedule.startDate);
                taskDate.setDate(taskDate.getDate() + (task.day - 1));
                const isPast =
                  taskDate < new Date(new Date().setHours(0, 0, 0, 0));
                const isToday =
                  format(new Date(), "yyyy-MM-dd") ===
                  format(taskDate, "yyyy-MM-dd");
                const isCompleted = viewingSchedule.completedDays?.includes(
                  task.day,
                );
                const hasWatchedVideo = viewingSchedule.watchedVideos?.includes(
                  task.day,
                );

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border flex items-center gap-4 transition-all ${
                      isToday
                        ? "bg-emerald-50 border-emerald-200 shadow-sm"
                        : isCompleted
                          ? "bg-slate-50 border-slate-100 opacity-60"
                          : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col items-center shrink-0 w-12">
                      <p className="text-[9px] font-black text-slate-400 uppercase">
                        Day
                      </p>
                      <p
                        className={`text-xl font-black ${isToday ? "text-emerald-700" : "text-slate-900"}`}
                      >
                        {task.day}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-slate-200 mx-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          {format(taskDate, "MMM dd, yyyy")}
                        </p>
                        {isToday && (
                          <Badge className="bg-emerald-500 text-white border-none text-[8px] h-4">
                            TODAY
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] h-4">
                            DONE
                          </Badge>
                        )}
                        {hasWatchedVideo && (
                          <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] h-4">
                            WATCHED VIDEO
                          </Badge>
                        )}
                      </div>
                      <h5 className="font-bold text-slate-900">{task.title}</h5>
                      <p className="text-xs text-slate-500">
                        {task.description}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className="text-[8px] border-slate-200 font-bold"
                      >
                        {task.category}
                      </Badge>
                      {isCompleted && (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <DialogFooter className="mt-8 border-t border-slate-50 pt-6">
            <Button
              onClick={() => setIsProgressModalOpen(false)}
              className="rounded-xl font-bold bg-slate-900 text-white"
            >
              Close Progress View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSchedule;
