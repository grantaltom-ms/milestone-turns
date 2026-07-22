import type { Locale } from "@/lib/supabase/types";

export type { Locale };

// UI-shell message catalog. English values mirror the existing copy exactly so
// English users see no change. Spanish is the maintenance-facing translation.
// Keys use `_one`/`_other` suffixes where the string depends on a count.
type Dict = Record<string, string>;

const en: Dict = {
  // common
  "common.switchUser": "Switch user",
  "common.add": "Add",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.resume": "Resume",

  // board
  "board.title": "Unit Turns",
  "board.filter.All": "All",
  "board.filter.Mine": "My Tasks",
  "board.filter.Move-in Soon": "Move-in Soon",
  "board.filter.Office": "Office",
  "board.filter.Maintenance": "Maintenance",
  "board.filter.Ready": "Ready",
  "board.sort": "Sort",
  "board.sortHint": "orders units within a building",
  "board.sort.stage": "Stage",
  "board.sort.aging": "Oldest",
  "board.sort.target": "Due date",
  "board.sort.property": "Property",
  "board.group": "Group",
  "board.group.none": "None",
  "board.group.property": "Property",
  "board.group.stage": "Stage",
  "board.empty": "No units match this filter.",
  "board.units_one": "{n} unit",
  "board.units_other": "{n} units",
  "board.newTurn": "New turn",
  "board.admin": "Admin",
  "board.active_one": "active turn",
  "board.active_other": "active turns",
  "board.heldCount": "{n} held",

  // dashboard tiles
  "tile.inTurn": "In Turn",
  "tile.overdue": "Overdue",
  "tile.moveInSoon": "Urgent - Rented",
  "tile.ready": "Ready",
  "tile.avgDays": "Avg Days",

  // turn card
  "card.allDone": "✓ All done",
  "card.tasksLeft_one": "{n} task left",
  "card.tasksLeft_other": "{n} tasks left",
  "card.daysInStage": "{n}d in {stage}",
  "card.moveInToday": "Move-in today",
  "card.moveInTomorrow": "Move-in tomorrow",
  "card.daysToMoveIn_one": "{n} day to move-in",
  "card.daysToMoveIn_other": "{n} days to move-in",
  "card.flooringToday": "Flooring today",
  "card.flooringTomorrow": "Flooring tomorrow",
  "card.daysToFlooring_one": "{n} day to flooring",
  "card.daysToFlooring_other": "{n} days to flooring",
  "card.cleaningToday": "Cleaning today",
  "card.cleaningTomorrow": "Cleaning tomorrow",
  "card.daysToCleaning_one": "{n} day to cleaning",
  "card.daysToCleaning_other": "{n} days to cleaning",
  "status.onHold": "On Hold",
  "status.blocked": "Blocked",

  // detail
  "detail.vacated": "Vacated",
  "detail.target": "Target",
  "detail.stageOf": "Stage {i} of {n} — {name} ({team})",
  "team.office": "Office",
  "team.maintenance": "Maintenance",
  "detail.hold": "Hold",
  "detail.back": "Back",
  "detail.resumeToAdvance": "Resume turn to advance →",
  "detail.handoff": "Hand off to Maintenance →",
  "detail.advanceTo": "Advance to {stage} →",
  "detail.tasksBeforeAdvance_one": "{n} task left before advancing",
  "detail.tasksBeforeAdvance_other": "{n} tasks left before advancing",
  "detail.skip": "Skip {a} → {b}",
  "detail.addTask": "+ Add task",
  "detail.taskNamePlaceholder": "Task name…",
  "detail.emptySkipped": "Phase skipped — these tasks won't block advancing.",
  "detail.emptyStage": "No tasks for this stage.",
  "detail.addTaskPlaceholder": "Add a task…",
  "assign.allStage": "Assign all {stage} tasks",
  "assign.officeTeam": "Office team",
  "assign.maintenanceTeam": "Maintenance team",

  // stage section summaries
  "stage.skipped": "Skipped",
  "stage.complete": "Complete",
  "stage.completeN_one": "Complete · {n} task",
  "stage.completeN_other": "Complete · {n} tasks",
  "stage.queued_one": "{n} task queued",
  "stage.queued_other": "{n} tasks queued",
  "stage.progress": "{done} of {total} done",
  "stage.noTasks": "No tasks",

  // hold sheet
  "hold.putOnHold": "Put Turn on Hold",
  "hold.onHold": "On Hold",
  "hold.blocked": "Blocked",
  "hold.onHoldDesc": "Waiting on something — vendor, part, approval, etc.",
  "hold.blockedDesc": "Cannot proceed — access issue, dispute, safety concern, etc.",
  "hold.reason": "Reason",
  "hold.placeholderBlocked": "e.g. Tenant dispute — access denied until resolved",
  "hold.placeholderHold": "e.g. Waiting on HVAC vendor — ETA unknown",
  "hold.confirmBlocked": "🚫 Mark as Blocked",
  "hold.confirmHold": "⏸ Put on Hold",

  // handoff sheet
  "handoff.title": "Hand off to Maintenance",
  "handoff.subtitle": "{property} · Unit {unit} — Office work is complete. Pick who takes it from here.",
  "handoff.noMembers": "No maintenance members found. Ask your admin to set roles in Supabase.",
  "handoff.selectMember": "Select a team member",
  "handoff.confirmTo": "Hand off to {name} →",

  // revert sheet
  "revert.title": "Send Back a Stage",
  "revert.atFirst": "Already at first stage — cannot go back further.",
  "revert.reasonLabel": "Why is this being sent back?",
  "revert.placeholder": "e.g. Materials not ready — painting cannot begin yet",
  "revert.confirmTo": "Send back to {stage} →",
  "revert.cannot": "Cannot revert",

  // notes
  "notes.add": "Add Note // Picture",
  "notes.count_one": "{n} note",
  "notes.count_other": "{n} notes",
  "notes.placeholder": "Type a note…",
  "notes.you": "You",
  "notes.justNow": "just now",
  "notes.minsAgo": "{n}m ago",
  "notes.hoursAgo": "{n}h ago",
  "notes.daysAgo": "{n}d ago",
  "notes.addPhoto": "Photo",
  "notes.uploading": "Uploading…",
  "notes.photoAlt": "Task photo",
  "notes.removePhoto": "Remove photo",

  // bottom nav
  "nav.board": "Board",
  "nav.myTasks": "My Tasks",

  // my tasks screen
  "mytasks.title": "My Tasks",
  "mytasks.subtitle": "Tasks assigned to you, ready to work.",
  "mytasks.empty": "You're all caught up.",
  "mytasks.emptyHint": "No tasks are assigned to you right now.",
  "mytasks.comingUp": "Coming up",
  "mytasks.overdue": "Overdue",
  "mytasks.tasksHere_one": "{n} task",
  "mytasks.tasksHere_other": "{n} tasks",
  "mytasks.openUnit": "Open unit →",

  // language switcher
  "lang.label": "Language",
  "lang.english": "English",
  "lang.spanish": "Español",
  "lang.toEnglish": "Switch to English",
  "lang.toSpanish": "Cambiar a Español",

  // board — main-specific chrome
  "board.filter.On Hold": "On Hold",
  "board.filter.Stale - Not Ready": "Stale - Not Ready",
  "board.allBuildings": "All Buildings",
  "board.import": "Import CSV",
  "common.signOut": "Sign out",

  // detail — actions & banners
  "detail.editTurn": "Edit turn",
  "detail.putOnHoldAria": "Put on hold",
  "detail.updateHoldAria": "Update hold status",
  "detail.putOnHoldTitle": "Put on hold or block",
  "detail.updateHoldTitle": "{status} — tap to update",
  "detail.sendBackAria": "Send back a stage",
  "detail.sendBackTitle": "Send back to previous stage",
  "detail.revertBack": "Back",
  "detail.officeComplete": "Office work complete",
  "detail.handoffHint": "Tap below to assign a maintenance team member and hand off to {stage}.",
  "detail.allDoneAdvance": "All done. Tap below to advance to {stage}.",
  "detail.unitReady": "✓ This unit is Ready.",
  "detail.skipPhase": "Skip phase",
  "detail.unskip": "Un-skip",
  "detail.skipPhaseTitle": "Skip this phase — its tasks won't block advancing",
  "detail.restorePhaseTitle": "Restore this phase",
  "detail.reassignAria": "Reassign (currently {who})",
  "detail.assignedToAria": "Assigned to {who}",
  "detail.deleteTaskAria": "Delete task",
  "task.added": "Added",
  "task.na": "N/A",

  // edit turn sheet
  "edit.title": "Edit Turn",
  "edit.unit": "Unit",
  "edit.vacated": "Vacated",
  "edit.targetDate": "Target date",
  "edit.save": "Save changes",
  "edit.saving": "Saving…",
  "edit.deleteTurn": "Delete turn…",
  "edit.confirmDelete": "Delete this turn and all its tasks? This cannot be undone.",
  "edit.yesDelete": "Yes, delete",
  "edit.deleting": "Deleting…",
  "edit.saveFailed": "Save failed",
  "edit.deleteFailed": "Delete failed",

  // assignee / handoff sheets
  "assign.noMembers": "No team members found. Ask your admin to set roles in Supabase.",

  // notes — extra copy
  "notes.placeholderOptional": "Type a note… (optional if adding a photo)",
  "notes.selectedAlt": "Selected",
  "notes.addPhotoTitle": "Add photo",

  // activity log
  "activity.title": "Activity",
  "activity.showMore": "Show {n} more",
  "activity.created": "created this turn",
  "activity.advanced": "advanced to {stage}",
  "activity.handedOff": "handed off to {stage}",
  "activity.handedOffTo": "handed off to {stage} → {who}",
  "activity.blockedLabel": "blocked",
  "activity.heldLabel": "put on hold",
  "activity.withReason": "{label} — “{reason}”",
  "activity.resumed": "resumed the turn",
  "activity.assigned": "assigned turn to {who}",
  "activity.taskAssigned": "assigned “{task}” to {who}",
  "activity.edited": "edited {fields}",
  "activity.editedDetails": "edited turn details",
  "activity.taskCompleted": "checked off “{task}”",
  "activity.taskReopened": "unchecked “{task}”",
  "activity.noteAdded": "added a note on “{task}”",
  "activity.phaseSkipped": "skipped the {stage} phase",
  "activity.phaseUnskipped": "restored the {stage} phase",
  "activity.taskAdded": "added task “{task}”",
  "activity.taskRemoved": "removed task “{task}”",
  "activity.aTask": "a task",
  "activity.task": "task",

  // relative time (shared by notes + activity)
  "time.justNow": "just now",
  "time.minsAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",
  "time.weeksAgo": "{n}w ago",
};

const es: Dict = {
  // common
  "common.switchUser": "Cambiar usuario",
  "common.add": "Agregar",
  "common.cancel": "Cancelar",
  "common.save": "Guardar",
  "common.resume": "Reanudar",

  // board
  "board.title": "Rotación de Unidades",
  "board.filter.All": "Todas",
  "board.filter.Mine": "Mías",
  "board.filter.Move-in Soon": "Mudanza próxima",
  "board.filter.Office": "Oficina",
  "board.filter.Maintenance": "Mantenimiento",
  "board.filter.Ready": "Listas",
  "board.sort": "Ordenar",
  "board.sortHint": "ordena las unidades dentro de un edificio",
  "board.sort.stage": "Etapa",
  "board.sort.aging": "Más antiguas",
  "board.sort.target": "Fecha límite",
  "board.sort.property": "Propiedad",
  "board.group": "Agrupar",
  "board.group.none": "Ninguno",
  "board.group.property": "Propiedad",
  "board.group.stage": "Etapa",
  "board.empty": "Ninguna unidad coincide con este filtro.",
  "board.units_one": "{n} unidad",
  "board.units_other": "{n} unidades",
  "board.newTurn": "Nueva rotación",
  "board.admin": "Admin",
  "board.active_one": "turno activo",
  "board.active_other": "turnos activos",
  "board.heldCount": "{n} en pausa",

  // dashboard tiles
  "tile.inTurn": "En rotación",
  "tile.overdue": "Atrasadas",
  "tile.moveInSoon": "Urgente - Rentado",
  "tile.ready": "Listas",
  "tile.avgDays": "Días prom.",

  // turn card
  "card.allDone": "✓ Todo listo",
  "card.tasksLeft_one": "{n} tarea restante",
  "card.tasksLeft_other": "{n} tareas restantes",
  "card.daysInStage": "{n}d en {stage}",
  "card.moveInToday": "Mudanza hoy",
  "card.moveInTomorrow": "Mudanza mañana",
  "card.daysToMoveIn_one": "{n} día p/mudanza",
  "card.daysToMoveIn_other": "{n} días p/mudanza",
  "card.flooringToday": "Piso hoy",
  "card.flooringTomorrow": "Piso mañana",
  "card.daysToFlooring_one": "{n} día p/piso",
  "card.daysToFlooring_other": "{n} días p/piso",
  "card.cleaningToday": "Limpieza hoy",
  "card.cleaningTomorrow": "Limpieza mañana",
  "card.daysToCleaning_one": "{n} día p/limpieza",
  "card.daysToCleaning_other": "{n} días p/limpieza",
  "status.onHold": "En pausa",
  "status.blocked": "Bloqueada",

  // detail
  "detail.vacated": "Desocupada",
  "detail.target": "Meta",
  "detail.stageOf": "Etapa {i} de {n} — {name} ({team})",
  "team.office": "Oficina",
  "team.maintenance": "Mantenimiento",
  "detail.hold": "Pausar",
  "detail.back": "Atrás",
  "detail.resumeToAdvance": "Reanudar para avanzar →",
  "detail.handoff": "Entregar a Mantenimiento →",
  "detail.advanceTo": "Avanzar a {stage} →",
  "detail.tasksBeforeAdvance_one": "{n} tarea antes de avanzar",
  "detail.tasksBeforeAdvance_other": "{n} tareas antes de avanzar",
  "detail.skip": "Omitir {a} → {b}",
  "detail.addTask": "+ Agregar tarea",
  "detail.taskNamePlaceholder": "Nombre de la tarea…",
  "detail.emptySkipped": "Etapa omitida — estas tareas no bloquean el avance.",
  "detail.emptyStage": "Sin tareas para esta etapa.",
  "detail.addTaskPlaceholder": "Agregar una tarea…",
  "assign.allStage": "Asignar todas las tareas de {stage}",
  "assign.officeTeam": "Equipo de oficina",
  "assign.maintenanceTeam": "Equipo de mantenimiento",

  // stage section summaries
  "stage.skipped": "Omitida",
  "stage.complete": "Completada",
  "stage.completeN_one": "Completada · {n} tarea",
  "stage.completeN_other": "Completada · {n} tareas",
  "stage.queued_one": "{n} tarea en cola",
  "stage.queued_other": "{n} tareas en cola",
  "stage.progress": "{done} de {total} hechas",
  "stage.noTasks": "Sin tareas",

  // hold sheet
  "hold.putOnHold": "Poner la rotación en pausa",
  "hold.onHold": "En pausa",
  "hold.blocked": "Bloqueada",
  "hold.onHoldDesc": "Esperando algo — proveedor, pieza, aprobación, etc.",
  "hold.blockedDesc": "No se puede continuar — problema de acceso, disputa, seguridad, etc.",
  "hold.reason": "Motivo",
  "hold.placeholderBlocked": "ej. Disputa con inquilino — acceso denegado hasta resolver",
  "hold.placeholderHold": "ej. Esperando al proveedor de HVAC — sin fecha estimada",
  "hold.confirmBlocked": "🚫 Marcar como bloqueada",
  "hold.confirmHold": "⏸ Poner en pausa",

  // handoff sheet
  "handoff.title": "Entregar a Mantenimiento",
  "handoff.subtitle": "{property} · Unidad {unit} — El trabajo de oficina está completo. Elige quién continúa.",
  "handoff.noMembers": "No se encontraron miembros de mantenimiento. Pide a tu admin que asigne roles en Supabase.",
  "handoff.selectMember": "Selecciona un miembro del equipo",
  "handoff.confirmTo": "Entregar a {name} →",

  // revert sheet
  "revert.title": "Regresar una etapa",
  "revert.atFirst": "Ya está en la primera etapa — no se puede retroceder más.",
  "revert.reasonLabel": "¿Por qué se regresa?",
  "revert.placeholder": "ej. Materiales no listos — la pintura aún no puede comenzar",
  "revert.confirmTo": "Regresar a {stage} →",
  "revert.cannot": "No se puede regresar",

  // notes
  "notes.add": "Agregar nota // foto",
  "notes.count_one": "{n} nota",
  "notes.count_other": "{n} notas",
  "notes.placeholder": "Escribe una nota…",
  "notes.you": "Tú",
  "notes.justNow": "ahora",
  "notes.minsAgo": "hace {n}m",
  "notes.hoursAgo": "hace {n}h",
  "notes.daysAgo": "hace {n}d",
  "notes.addPhoto": "Foto",
  "notes.uploading": "Subiendo…",
  "notes.photoAlt": "Foto de la tarea",
  "notes.removePhoto": "Quitar foto",

  // bottom nav
  "nav.board": "Tablero",
  "nav.myTasks": "Mis Tareas",

  // my tasks screen
  "mytasks.title": "Mis Tareas",
  "mytasks.subtitle": "Tareas asignadas a ti, listas para trabajar.",
  "mytasks.empty": "Estás al día.",
  "mytasks.emptyHint": "No tienes tareas asignadas por ahora.",
  "mytasks.comingUp": "Próximas",
  "mytasks.overdue": "Atrasada",
  "mytasks.tasksHere_one": "{n} tarea",
  "mytasks.tasksHere_other": "{n} tareas",
  "mytasks.openUnit": "Abrir unidad →",

  // language switcher
  "lang.label": "Idioma",
  "lang.english": "English",
  "lang.spanish": "Español",
  "lang.toEnglish": "Switch to English",
  "lang.toSpanish": "Cambiar a Español",

  // board — main-specific chrome
  "board.filter.On Hold": "En pausa",
  "board.filter.Stale - Not Ready": "Estancado - No listo",
  "board.allBuildings": "Todos los edificios",
  "board.import": "Importar CSV",
  "common.signOut": "Salir",

  // detail — actions & banners
  "detail.editTurn": "Editar rotación",
  "detail.putOnHoldAria": "Poner en pausa",
  "detail.updateHoldAria": "Actualizar estado de pausa",
  "detail.putOnHoldTitle": "Poner en pausa o bloquear",
  "detail.updateHoldTitle": "{status} — toca para actualizar",
  "detail.sendBackAria": "Regresar una etapa",
  "detail.sendBackTitle": "Regresar a la etapa anterior",
  "detail.revertBack": "Atrás",
  "detail.officeComplete": "Trabajo de oficina completo",
  "detail.handoffHint": "Toca abajo para asignar a un miembro de mantenimiento y entregar a {stage}.",
  "detail.allDoneAdvance": "Todo listo. Toca abajo para avanzar a {stage}.",
  "detail.unitReady": "✓ Esta unidad está lista.",
  "detail.skipPhase": "Omitir etapa",
  "detail.unskip": "Restaurar",
  "detail.skipPhaseTitle": "Omitir esta etapa — sus tareas no bloquean el avance",
  "detail.restorePhaseTitle": "Restaurar esta etapa",
  "detail.reassignAria": "Reasignar (actualmente {who})",
  "detail.assignedToAria": "Asignada a {who}",
  "detail.deleteTaskAria": "Eliminar tarea",
  "task.added": "Agregada",
  "task.na": "N/A",

  // edit turn sheet
  "edit.title": "Editar rotación",
  "edit.unit": "Unidad",
  "edit.vacated": "Desocupada",
  "edit.targetDate": "Fecha meta",
  "edit.save": "Guardar cambios",
  "edit.saving": "Guardando…",
  "edit.deleteTurn": "Eliminar rotación…",
  "edit.confirmDelete": "¿Eliminar esta rotación y todas sus tareas? Esto no se puede deshacer.",
  "edit.yesDelete": "Sí, eliminar",
  "edit.deleting": "Eliminando…",
  "edit.saveFailed": "Error al guardar",
  "edit.deleteFailed": "Error al eliminar",

  // assignee / handoff sheets
  "assign.noMembers": "No se encontraron miembros del equipo. Pide a tu admin que asigne roles en Supabase.",

  // notes — extra copy
  "notes.placeholderOptional": "Escribe una nota… (opcional si agregas una foto)",
  "notes.selectedAlt": "Seleccionada",
  "notes.addPhotoTitle": "Agregar foto",

  // activity log
  "activity.title": "Actividad",
  "activity.showMore": "Ver {n} más",
  "activity.created": "creó esta rotación",
  "activity.advanced": "avanzó a {stage}",
  "activity.handedOff": "entregó a {stage}",
  "activity.handedOffTo": "entregó a {stage} → {who}",
  "activity.blockedLabel": "bloqueada",
  "activity.heldLabel": "puesta en pausa",
  "activity.withReason": "{label} — “{reason}”",
  "activity.resumed": "reanudó la rotación",
  "activity.assigned": "asignó la rotación a {who}",
  "activity.taskAssigned": "asignó “{task}” a {who}",
  "activity.edited": "editó {fields}",
  "activity.editedDetails": "editó los detalles de la rotación",
  "activity.taskCompleted": "marcó “{task}”",
  "activity.taskReopened": "desmarcó “{task}”",
  "activity.noteAdded": "agregó una nota en “{task}”",
  "activity.phaseSkipped": "omitió la etapa {stage}",
  "activity.phaseUnskipped": "restauró la etapa {stage}",
  "activity.taskAdded": "agregó la tarea “{task}”",
  "activity.taskRemoved": "eliminó la tarea “{task}”",
  "activity.aTask": "una tarea",
  "activity.task": "tarea",

  // relative time (shared by notes + activity)
  "time.justNow": "ahora",
  "time.minsAgo": "hace {n}m",
  "time.hoursAgo": "hace {n}h",
  "time.daysAgo": "hace {n}d",
  "time.weeksAgo": "hace {n}sem",
};

const CATALOG: Record<Locale, Dict> = { en, es };

// Localized stage names, indexed by stage_idx (0–5). Keep in sync with STAGES.
const STAGE_NAMES: Record<Locale, string[]> = {
  en: ["Inspection", "Materials", "Painting", "Repairs", "Cleaning", "Ready"],
  es: ["Inspección", "Materiales", "Pintura", "Reparaciones", "Limpieza", "Lista"],
};

export function stageName(locale: Locale, stageIdx: number): string {
  return STAGE_NAMES[locale]?.[stageIdx] ?? STAGE_NAMES.en[stageIdx] ?? "";
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate a key. Falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const str = CATALOG[locale]?.[key] ?? CATALOG.en[key] ?? key;
  return interpolate(str, vars);
}

/** Pluralized translate: picks `${key}_one` / `${key}_other` by count and passes {n}. */
export function translatePlural(locale: Locale, key: string, count: number, vars?: Record<string, string | number>): string {
  const suffix = count === 1 ? "_one" : "_other";
  return translate(locale, key + suffix, { n: count, ...vars });
}

/** Convenience: bind a locale to get a `t` function. */
export function tFor(locale: Locale) {
  return {
    t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    tp: (key: string, count: number, vars?: Record<string, string | number>) => translatePlural(locale, key, count, vars),
    stage: (idx: number) => stageName(locale, idx),
  };
}
