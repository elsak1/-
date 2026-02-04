
export enum ReminderTime {
  MIN_5 = 5,
  MIN_10 = 10,
  MIN_30 = 30,
  HOUR_1 = 60,
  DAY_1 = 1440
}

export enum AlertMode {
  NORMAL = 'NORMAL',
  ALARM = 'ALARM',
  SILENT = 'SILENT'
}

export enum Priority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT'
}

export type Frequency = 'daily' | 'weekly' | 'weekdays' | 'weekends';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // HH:mm format
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate?: string;  // ISO date string (YYYY-MM-DD)
  durationMinutes: number;
  location: string;
  description: string;
  alertMode: AlertMode;
  reminderMinutes: number;
  isCompleted: boolean;
}

export interface ExtractedEventData {
  title: string;
  startTime: string;
  startDate: string;
  endDate?: string;
  durationMinutes: number;
  location: string;
  description: string;
}

export interface Habit {
  id: string;
  title: string;
  frequency: Frequency;
  startTime: string; // HH:mm format
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  durationMinutes: number;
  priority: Priority;
  alertMode: AlertMode;
  reminderMinutes: number;
  createdAt: string;
  history: Record<string, boolean>; // date string "YYYY-MM-DD" -> status
  streak: number;
  isPaused: boolean;
}

export interface ExtractedHabitData {
  title: string;
  frequency: Frequency;
  startTime: string;
  startDate: string;
  endDate?: string;
  durationMinutes: number;
}

export type CalendarViewType = 'day' | 'week' | 'month';
export type AppTab = 'calendar' | 'atomic' | 'activity' | 'settings';
