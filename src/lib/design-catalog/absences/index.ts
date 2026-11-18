export { default as AbsenceCalendarMonth } from "./AbsenceCalendarMonth.svelte";
export { default as AbsenceCalendarYear } from "./AbsenceCalendarYear.svelte";
export { default as AbsenceCalendarEmployee } from "./AbsenceCalendarEmployee.svelte";
export { default as AbsenceLegend } from "./AbsenceLegend.svelte";
export { default as AbsenceRangeCalendar } from "./AbsenceRangeCalendar.svelte";

export type { AbsenceEntry, AbsenceType, CoverageNotice } from "./types.js";
export { computeWeekLayout } from "./laneLayout.js";
export type { LanePlacement, WeekLayout } from "./laneLayout.js";
export { nextFocusedDay, clampToYear } from "./yearGridKeyboard.js";
export { employeeInitials } from "./identity.js";
export type { AbsenceIcon } from "./identity.js";
