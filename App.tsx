
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, Clock, Bell, Trash2, Edit3, X, Check, Volume2, LayoutGrid, List, Zap, Settings as SettingsIcon, Home, BarChart3 } from 'lucide-react';
import { CalendarEvent, AlertMode, ReminderTime, CalendarViewType, ExtractedEventData, AppTab, Habit, Priority, Frequency, ExtractedHabitData } from './types';
import { parseEventFromText, parseHabitFromText } from './services/geminiService';
import Calendar from './components/Calendar';
import EventInput from './components/EventInput';
import ConfirmationModal from './components/ConfirmationModal';
import HabitConfirmationModal from './components/HabitConfirmationModal';
import AlarmOverlay from './components/AlarmOverlay';
import AtomicHabits from './components/AtomicHabits';
import Settings from './components/Settings';
import ActivityPage from './components/ActivityPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [pendingEvent, setPendingEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [pendingHabit, setPendingHabit] = useState<Partial<Habit> | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [view, setView] = useState<CalendarViewType>('month');
  const [activeAlarm, setActiveAlarm] = useState<{ type: 'event' | 'habit', data: any } | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [dismissalPhrase, setDismissalPhrase] = useState('Done');

  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persistence
  useEffect(() => {
    const savedEvents = localStorage.getItem('chronos_events');
    const savedHabits = localStorage.getItem('chronos_habits');
    const savedPhrase = localStorage.getItem('chronos_phrase');
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedHabits) setHabits(JSON.parse(savedHabits));
    if (savedPhrase) setDismissalPhrase(savedPhrase);
  }, []);

  useEffect(() => {
    localStorage.setItem('chronos_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('chronos_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('chronos_phrase', dismissalPhrase);
  }, [dismissalPhrase]);

  const initAudio = () => {
    if (!isAudioInitialized) {
      alarmAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      alarmAudioRef.current.loop = true;
      setIsAudioInitialized(true);
    }
  };

  // Alarm check logic
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];
      const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      events.forEach(event => {
        if (event.startDate === todayKey && event.startTime === currentTimeStr && !activeAlarm && !event.isCompleted && event.alertMode === AlertMode.ALARM) {
          triggerAlarm('event', event);
        } else if (event.startDate === todayKey && event.startTime === currentTimeStr && !activeAlarm && !event.isCompleted && event.alertMode === AlertMode.NORMAL) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`ቀን Reminder: ${event.title}`, { body: `Scheduled for now.` });
          }
        }
      });

      habits.forEach(habit => {
        if (habit.isPaused) return;
        if (habit.history[todayKey]) return;
        
        const day = now.getDay();
        const isWeekday = day >= 1 && day <= 5;
        const isWeekend = day === 0 || day === 6;
        let isScheduledToday = false;
        
        if (habit.frequency === 'daily') isScheduledToday = true;
        else if (habit.frequency === 'weekdays' && isWeekday) isScheduledToday = true;
        else if (habit.frequency === 'weekends' && isWeekend) isScheduledToday = true;
        else if (habit.frequency === 'weekly' && new Date(habit.createdAt).getDay() === day) isScheduledToday = true;

        if (isScheduledToday && habit.startDate <= todayKey && (!habit.endDate || habit.endDate >= todayKey) && habit.startTime === currentTimeStr) {
          if (!activeAlarm && habit.alertMode === AlertMode.ALARM) {
            triggerAlarm('habit', habit);
          } else if (!activeAlarm && habit.alertMode === AlertMode.NORMAL) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`ቀን Activity: ${habit.title}`, { body: `Commitment time!` });
            }
          }
        }
      });
    };

    const triggerAlarm = (type: 'event' | 'habit', data: any) => {
      setActiveAlarm({ type, data });
      if (alarmAudioRef.current) alarmAudioRef.current.play().catch(e => console.error(e));
    };

    const interval = setInterval(checkAlarms, 30000); 
    return () => clearInterval(interval);
  }, [events, habits, activeAlarm]);

  const handleAddAnalysis = async (text: string) => {
    initAudio();
    if (activeTab === 'calendar') {
      const extracted = await parseEventFromText(text);
      if (extracted) {
        if ((extracted as any).frequency && (extracted as any).frequency !== 'none') {
           setPendingHabit({ 
             ...extracted, 
             frequency: (extracted as any).frequency,
             alertMode: AlertMode.SILENT, 
             reminderMinutes: ReminderTime.MIN_10, 
             priority: Priority.NORMAL, 
             history: {}, 
             streak: 0, 
             isPaused: false,
             createdAt: new Date().toISOString() 
           });
        } else {
           setPendingEvent({ ...extracted, alertMode: AlertMode.SILENT, reminderMinutes: ReminderTime.MIN_10, isCompleted: false });
        }
      }
    } else if (activeTab === 'atomic' || activeTab === 'activity') {
      const extracted = await parseHabitFromText(text);
      if (extracted) setPendingHabit({ 
        ...extracted, 
        alertMode: AlertMode.SILENT, 
        reminderMinutes: ReminderTime.MIN_10, 
        priority: Priority.NORMAL, 
        history: {}, 
        streak: 0, 
        isPaused: false,
        createdAt: new Date().toISOString() 
      });
    }
  };

  const confirmEvent = (finalEvent: CalendarEvent) => {
    if (editingEvent) {
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...finalEvent, id: editingEvent.id } : e));
      setEditingEvent(null);
    } else {
      setEvents(prev => [...prev, { ...finalEvent, id: crypto.randomUUID() }]);
      setPendingEvent(null);
    }
  };

  const confirmHabit = (finalHabit: Habit) => {
    if (editingHabit) {
      setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...finalHabit, id: editingHabit.id } : h));
      setEditingHabit(null);
    } else {
      setHabits(prev => [...prev, { ...finalHabit, id: crypto.randomUUID() }]);
      setPendingHabit(null);
    }
  };

  const deleteEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
  const deleteHabit = (id: string) => setHabits(prev => prev.filter(h => h.id !== id));

  const toggleHabitCompletion = (id: string) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const history = { ...h.history };
        const currentlyDone = !!history[today];
        history[today] = !currentlyDone;
        let streak = currentlyDone ? Math.max(0, h.streak - 1) : h.streak + 1;
        return { ...h, history, streak };
      }
      return h;
    }));
  };

  const toggleHabitPause = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, isPaused: !h.isPaused } : h));
  };

  const dismissAlarm = () => {
    if (alarmAudioRef.current) { alarmAudioRef.current.pause(); alarmAudioRef.current.currentTime = 0; }
    if (activeAlarm?.type === 'event') {
      setEvents(prev => prev.map(e => e.id === activeAlarm.data.id ? { ...e, isCompleted: true } : e));
    } else if (activeAlarm?.type === 'habit') {
      toggleHabitCompletion(activeAlarm.data.id);
    }
    setActiveAlarm(null);
  };

  const snoozeAlarm = (minutes: number) => {
    if (alarmAudioRef.current) { alarmAudioRef.current.pause(); alarmAudioRef.current.currentTime = 0; }
    setActiveAlarm(null);
  };

  const handleWipeData = () => {
    if (confirm("Are you sure you want to delete all data? This cannot be undone.")) {
      setEvents([]);
      setHabits([]);
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-24 md:pb-28">
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-900 uppercase tracking-tighter">ቀን</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {(activeTab === 'calendar' || activeTab === 'atomic') && (
          <section className="bg-white p-6 rounded-[48px] shadow-sm border border-gray-100">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-800 uppercase tracking-widest text-xs opacity-40">
              {activeTab === 'calendar' ? <CalendarIcon className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              Create Entry
            </h2>
            <EventInput 
              onAdd={handleAddAnalysis} 
              placeholder={activeTab === 'calendar' ? "e.g., 'Flight to Paris on July 10th' or 'I did it every day'" : "e.g., 'Go to gym every day at 6:30 AM'"}
            />
          </section>
        )}

        {activeTab === 'calendar' ? (
          <Calendar view={view} setView={setView} events={events} onDelete={deleteEvent} onEdit={setEditingEvent} />
        ) : activeTab === 'atomic' ? (
          <AtomicHabits 
            habits={habits} 
            onToggle={toggleHabitCompletion} 
            onDelete={deleteHabit} 
            onTogglePause={toggleHabitPause} 
            onEdit={setEditingHabit}
          />
        ) : activeTab === 'activity' ? (
          <ActivityPage 
            habits={habits} 
            events={events} 
            onToggleHabit={toggleHabitCompletion}
            onEditHabit={setEditingHabit}
            onEditEvent={setEditingEvent}
          />
        ) : (
          <Settings 
            dismissalPhrase={dismissalPhrase} 
            setDismissalPhrase={setDismissalPhrase} 
            onWipeData={handleWipeData}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex justify-around items-center z-50 pb-safe">
        <NavButton active={activeTab === 'calendar'} icon={<CalendarIcon />} label="Schedule" onClick={() => setActiveTab('calendar')} />
        <NavButton active={activeTab === 'activity'} icon={<BarChart3 />} label="Activity" onClick={() => setActiveTab('activity')} />
        <NavButton active={activeTab === 'atomic'} icon={<Zap />} label="Atomic" onClick={() => setActiveTab('atomic')} />
        <NavButton active={activeTab === 'settings'} icon={<SettingsIcon />} label="Settings" onClick={() => setActiveTab('settings')} />
      </nav>

      {(pendingEvent || editingEvent) && (
        <ConfirmationModal 
          event={(pendingEvent || editingEvent) as any} 
          onConfirm={confirmEvent} 
          onCancel={() => { setPendingEvent(null); setEditingEvent(null); }} 
          isEditing={!!editingEvent}
        />
      )}
      {(pendingHabit || editingHabit) && (
        <HabitConfirmationModal 
          habit={(pendingHabit || editingHabit) as any} 
          onConfirm={confirmHabit} 
          onCancel={() => { setPendingHabit(null); setEditingHabit(null); }} 
          isEditing={!!editingHabit}
        />
      )}
      {activeAlarm && (
        <AlarmOverlay 
          event={activeAlarm.data} 
          onDismiss={dismissAlarm} 
          onSnooze={snoozeAlarm} 
          dismissalPhrase={dismissalPhrase}
        />
      )}
    </div>
  );
};

const NavButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all flex-1 py-2 ${active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
    <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-indigo-50' : 'bg-transparent'}`}>
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
