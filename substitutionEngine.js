function generateSubstituteTimetable(timetable, teachers, leaves, isPreview = false) {
  const draft = JSON.parse(JSON.stringify(timetable));

  // Initialize teacher occupied map (ensure every teacher has a Set)
  const teacherOccupied = {};
  teachers.forEach(t => teacherOccupied[t['Teachers Name']] = new Set());
  draft.forEach(c => {
    if (c.teacher) {
      if (!teacherOccupied[c.teacher]) teacherOccupied[c.teacher] = new Set();
      teacherOccupied[c.teacher].add(`${c.day}||${c.period}`);
    }
  });

  // Build a quick lookup of "teacher is on leave for this day" from original leaves
  // This ensures applied/declared day leaves are respected even if date fields were messy.
  const leaveSet = new Set(); // entries: "TeacherName||DayName"
  for (const lv of leaves) {
    const name = lv.Teacher;
    const dayNames = lv.DayNames || [];
    for (const d of dayNames) {
      leaveSet.add(`${name}||${d}`);
    }
  }

  // Helper: is teacher free at day+period?
  function isFree(name, day, period) {
    if (!teacherOccupied[name]) return true;
    return !teacherOccupied[name].has(`${day}||${period}`);
  }

  // Helper: is teacher on leave that day? (uses leaveSet)
  function isOnLeave(name, day) {
    return leaveSet.has(`${name}||${day}`);
  }

  const audit = [];

  // Filter only current or upcoming leaves (which teachers we will attempt to cover).
  const today = new Date();
  const validLeaves = leaves.filter(lv => {
    const end = new Date(lv.EndDate || lv.date || today);
    return end >= today;
  });

  // Track which substitute(s) have already been used for a particular absent teacher on a particular day.
  // Key: "AbsentName||Day", value: Set of substitute names already used for that absent on that day
  const subUsedFor = {};

  for (const leave of validLeaves) {
    const absent = leave.Teacher;
    const dayNames = leave.DayNames || [];

    for (const day of dayNames) {
      // ensure map exists for this absent+day
      const absentDayKey = `${absent}||${day}`;
      if (!subUsedFor[absentDayKey]) subUsedFor[absentDayKey] = new Set();

      for (const cell of draft) {
        if (cell.teacher !== absent) continue;
        if (cell.day !== day) continue;
        if (cell._substituted) continue;

        let substitute = null;

        // ======= SELECTION RULES (with added constraint: a teacher who already substituted
        // for this absent teacher on this day will be skipped) =======

        // Step 1: same-class teacher
        for (const t of teachers) {
          const cand = t['Teachers Name'];
          if (cand === absent) continue;
          if (isOnLeave(cand, day)) continue;
          if (subUsedFor[absentDayKey].has(cand)) continue; // NEW: skip if already used for this absent+day

          const classes = (t.Class || '').toString().split(',').map(x => x.trim().toUpperCase());
          if (!classes.includes((cell.class || '').toUpperCase())) continue;
          if (isFree(cand, cell.day, cell.period)) { substitute = cand; break; }
        }

        // Step 2: extracurricular teacher
        if (!substitute) {
          for (const t of teachers) {
            const cand = t['Teachers Name'];
            if (cand === absent) continue;
            if (isOnLeave(cand, day)) continue;
            if (subUsedFor[absentDayKey].has(cand)) continue; // NEW
            if ((t.Type || '').toString().toLowerCase() === 'extracurricular' &&
                isFree(cand, cell.day, cell.period)) { substitute = cand; break; }
          }
        }

        // Step 3: any free (least load), but skip if already used for this absent+day
        if (!substitute) {
          const sorted = teachers
            .map(t => ({ name: t['Teachers Name'], load: (teacherOccupied[t['Teachers Name']] || new Set()).size }))
            .sort((a, b) => a.load - b.load);
          for (const s of sorted) {
            if (s.name === absent) continue;
            if (isOnLeave(s.name, day)) continue;
            if (subUsedFor[absentDayKey].has(s.name)) continue; // NEW
            if (isFree(s.name, cell.day, cell.period)) { substitute = s.name; break; }
          }
        }

        // ======= Assign substitute & update trackers =======
        cell._orig_teacher = cell.teacher;
        cell._substituted = true;
        cell.sub_reason = 'Leave';
        cell.substitute_for = cell._orig_teacher;

        if (substitute) {
          cell.teacher = substitute;
          if (isPreview) cell._preview = true;
          // mark this substitute as now occupied for that period
          if (!teacherOccupied[substitute]) teacherOccupied[substitute] = new Set();
          teacherOccupied[substitute].add(`${cell.day}||${cell.period}`);

          // record that this substitute has been used for this absent teacher on this day
          subUsedFor[absentDayKey].add(substitute);

          audit.push({
            class: cell.class,
            day: cell.day,
            period: cell.period,
            original: cell._orig_teacher,
            substitute,
            sub_reason: 'Leave',
            preview: isPreview
          });
        } else {
          // No substitute found
          cell.teacher = 'UNASSIGNED';
          if (isPreview) cell._preview = true;
          audit.push({
            class: cell.class,
            day: cell.day,
            period: cell.period,
            original: cell._orig_teacher,
            substitute: null,
            sub_reason: 'Leave',
            preview: isPreview
          });
        }
      } // end for each cell
    } // end for each day
  } // end for each leave

  return { draft, audit };
}

module.exports = { generateSubstituteTimetable };
