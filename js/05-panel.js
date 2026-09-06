/* ===== Side panel contents ===== */
const DURATION_PRESETS = [[30, '30 min'], [60, '1 h'], [120, '2 h']];
const GOAL_OPTIONS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const Panel = {
  /* ---- Block (session) editor: changes apply immediately, with validation and undo ---- */
  editSession(id, { closing = false } = {}) {
    const s0 = sessionById(id); if (!s0) return;
    const idOf = id;
    const key = 'session:' + id;
    const body = h('div', { class: 'stack' });
    const errBox = h('div', { class: 'errors', hidden: true });
    let noteTa = null;
    const showErrors = (errs) => { errBox.hidden = false; setKids(errBox, ...errs.map((e) => h('div', null, e.message, ' ', e.conflict ? h('a', { href: '#', onClick: (ev) => { ev.preventDefault(); Panel.editSession(e.conflict.id); } }, 'Open it') : null))); };
    const build = () => {
      const s = sessionById(id); if (!s || s.deleted_at) { Drawer.close(); return; }
      const tm = sessionTimes(s); const live = !s.ended_at;
      const summary = h('div', { class: 'summary' },
        h('div', null, h('b', null, fmtClock(tm.net)), h('span', null, 'net')),
        h('div', null, h('b', null, fmtClock(tm.gross)), h('span', null, 'gross')),
        h('div', null, h('b', null, fmtClock(tm.pauseMs)), h('span', null, 'breaks')));
      const chips = themeChips(s.theme, (v) => { updateSession(id, { theme: v }); toastUndo('Theme changed'); }, { small: true });
      const dateIn = h('input', { type: 'date', value: ymd(new Date(tm.start)) });
      const startIn = h('input', { type: 'time', value: hm(tm.start), step: 60 });
      const endIn = h('input', { type: 'time', value: hm(tm.end), step: 60, disabled: live });
      const durIn = h('input', { type: 'number', min: 1, max: 960, value: Math.round(tm.gross / MIN), disabled: live });
      const pauseIn = h('input', { type: 'number', min: 0, max: 900, value: Math.round(tm.pauseMs / MIN), disabled: live });
      const compute = (anchor) => {
        const [y, m, d] = dateIn.value.split('-').map(Number); const [sh, sm] = startIn.value.split(':').map(Number);
        if (!y || Number.isNaN(sh)) return null;
        const start = new Date(y, m - 1, d, sh, sm).getTime();
        let end;
        if (live) end = null;
        else if (anchor === 'end') { const [eh, em] = endIn.value.split(':').map(Number); end = new Date(y, m - 1, d, eh, em).getTime(); if (end <= start) end += DAY; }
        else end = start + Math.max(1, +durIn.value || 1) * MIN;
        return { start, end };
      };
      const applyTimes = (anchor) => {
        const c = compute(anchor); if (!c) return;
        const shift = c.start - tm.start; const cur = sessionById(id);
        let pauses;
        if (live) pauses = cur.pauses;
        else {
          const totalPause = Math.max(0, +pauseIn.value || 0) * MIN; const curPause = tm.pauseMs;
          if (Math.abs(totalPause - curPause) >= MIN * 0.5) pauses = totalPause > 0 ? [{ start: iso(c.start + (c.end - c.start - totalPause) / 2), end: iso(c.start + (c.end - c.start + totalPause) / 2) }] : [];
          else pauses = (cur.pauses || []).map((p) => ({ start: iso(clamp(ms(p.start) + shift, c.start, c.end)), end: p.end ? iso(clamp(ms(p.end) + shift, c.start, c.end)) : null })).filter((p) => !p.end || ms(p.end) > ms(p.start));
        }
        const patch = { started_at: iso(c.start), ended_at: live ? null : iso(c.end), pauses };
        const errs = validateSession({ ...cur, ...patch }, id);
        if (errs.length) { showErrors(errs); build(); return; }
        errBox.hidden = true; updateSession(id, patch); toastUndo(closing ? 'Adjusted' : 'Block updated');
      };
      dateIn.addEventListener('change', () => applyTimes('dur')); startIn.addEventListener('change', () => applyTimes('dur'));
      endIn.addEventListener('change', () => applyTimes('end')); durIn.addEventListener('change', () => applyTimes('dur')); pauseIn.addEventListener('change', () => applyTimes('dur'));
      const presets = live ? null : h('div', { class: 'row preset-row' }, h('span', { class: 'muted small' }, 'Set length:'),
        ...DURATION_PRESETS.map(([mins, label]) => h('button', { class: 'btn sm', type: 'button', onClick: () => { durIn.value = mins; applyTimes('dur'); } }, label)));
      const note = noteEditor(s.note_md, { onChange: debounce((v) => { const cur = sessionById(id); if (cur && cur.note_md !== v) updateSession(id, { note_md: v }, { undoable: false }); }, 500) });
      noteTa = note.ta;
      const shortHint = closing && tm.net < 60000 ? h('p', { class: 'hint warn' }, 'Less than 1 minute of net study — discard this block?') : null;
      const rating = s.meta?.rating || null;
      const rateBtn = ([rid, label, color]) => h('button', {
        class: 'rate' + (rating === rid ? ' on' : ''), type: 'button', style: { '--c': color },
        onClick: () => { const sess = sessionById(idOf); if (!sess) return; const meta = { ...(sess.meta || {}) }; if (rating === rid) delete meta.rating; else meta.rating = rid; updateSession(idOf, { meta }, { undoable: false }); },
      }, label);
      const rateRow = h('div', { class: 'field' }, h('span', null, 'How did it go?'), h('div', { class: 'rate-row' }, ...RATINGS.map(rateBtn)));
      const actions = h('div', { class: 'row', style: { marginTop: '6px' } },
        closing ? h('button', { class: 'btn primary', onClick: () => Drawer.close() }, 'Save') : null,
        closing ? h('button', { class: 'btn', onClick: () => { Drawer.close(); try { Timer.start(s.theme); } catch (e) { toast(e.message, { error: true }); } } }, 'Save and start another') : null,
        !live && !closing ? h('button', { class: 'btn', onClick: () => { const r = duplicateSessionTomorrow(id); if (r?.errors) showErrors(r.errors); else toastUndo('Block duplicated to tomorrow'); } }, 'Duplicate to tomorrow') : null,
        live ? h('button', { class: 'btn', onClick: () => { Drawer.close(); const st = Timer.stop(); if (st) Panel.closeSession(st.id); } }, '■ Stop now') : null,
        h('button', { class: 'btn danger', onClick: async () => { if ((closing && tm.net < 60000) || await confirmDialog('Delete this block?', { danger: true, okLabel: 'Delete' })) { deleteSession(id); Drawer.close(); toastUndo(closing ? 'Block discarded' : 'Block deleted'); } } }, closing ? 'Discard' : 'Delete'));
      setKids(body, summary, shortHint,
        h('div', { class: 'field' }, h('span', null, 'Theme'), chips),
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, h('span', null, 'Date'), dateIn), h('label', { class: 'field' }, h('span', null, 'Start'), startIn),
          h('label', { class: 'field' }, h('span', null, live ? 'End (running)' : 'End'), endIn), h('label', { class: 'field' }, h('span', null, 'Length (min)'), durIn),
          h('label', { class: 'field' }, h('span', null, 'Breaks (min)'), pauseIn),
          h('div', { class: 'field' }, h('span', null, 'Source'), h('div', { class: 'muted small', style: { paddingTop: '8px' } }, s.source === 'timer' ? '⏱ timer' : '✎ manual', s.meta?.autoclosed ? ' · ⚠ closed automatically' : ''))),
        presets, rateRow,
        h('div', { class: 'field' }, h('span', null, 'Note'), note.el),
        errBox, actions);
    };
    build();
    Drawer.open(closing ? 'Block finished' : (!s0.ended_at ? 'Running block' : 'Edit block'), body, key);
    const off = on('change', () => { if (!Drawer.isOpen(key)) { off(); return; } if (document.activeElement && body.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return; build(); });
    if (closing) setTimeout(() => noteTa && noteTa.focus(), 40);
    emit('select', { id });
  },
  closeSession(id) { this.editSession(id, { closing: true }); },

  /* ---- Day detail ---- */
  day(key) {
    const body = h('div', { class: 'stack' });
    const build = () => {
      const list = state.sessions.filter((s) => isLive(s) && sliceSession(s).some((sl) => sl.day === key)).sort((a, b) => a.started_at.localeCompare(b.started_at));
      const total = netByDay(key, key).get(key)?.net || 0;
      setKids(body,
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, list.length ? `${list.length} block${list.length > 1 ? 's' : ''}` : 'No blocks on this day'), h('b', null, fmtHM(total / MIN))),
        ...list.map((s) => { const tm = sessionTimes(s); return h('button', { class: 'block-row', style: { '--c': themeColor(s.theme) }, onClick: () => Panel.editSession(s.id) }, h('i', { class: 'bar' }), h('span', { class: 'grow' }, h('b', null, themeName(s.theme)), s.note_md ? noteIcon() : null, h('span', { class: 'muted small' }, ' ', s.ended_at ? fmtRange(tm.start, tm.end) : `${hm(tm.start)} – running`)), h('span', { class: 'num' }, fmtHM(tm.net / MIN))); }),
        h('div', { class: 'row preset-row' }, h('span', { class: 'muted small' }, 'Add block:'),
          ...DURATION_PRESETS.map(([mins, label]) => h('button', { class: 'btn sm', onClick: () => { const now = new Date(nowMs()); const start = dayMs(key, key === todayKey() ? Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15 : 19 * 60); Calendar.createAt(start, mins); } }, label))));
    };
    build(); Drawer.open(fmtDayLong(key), body, 'day:' + key);
    const off = on('change', () => { if (!Drawer.isOpen('day:' + key)) { off(); return; } build(); });
  },

  /* ---- Mission editor ---- */
  mission(id) {
    const m = missionById(id); if (!m) return;
    const nameIn = h('input', { type: 'text', value: m.name, maxlength: 80 });
    const themeSel = themeSelect(m.theme);
    const goalSel = h('select', null, ...GOAL_OPTIONS.map((g) => h('option', { value: g, selected: g === m.goal_hours }, `${g}h`)));
    const startIn = h('input', { type: 'date', value: m.start_date || ymd(new Date(ms(m.created_at))) });
    const deadIn = h('input', { type: 'date', value: m.deadline || '' });
    const doneCb = h('input', { type: 'checkbox', class: 'switch', checked: m.status === 'done' });
    const save = () => { updateMission(id, { name: nameIn.value.trim() || themeName(themeSel.value), theme: themeSel.value, goal_hours: +goalSel.value, start_date: startIn.value || m.start_date, deadline: deadIn.value || null, status: doneCb.checked ? 'done' : 'active' }); toast('Mission saved'); Drawer.close(); };
    Drawer.open('Edit mission', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Theme'), themeSel), h('label', { class: 'field' }, h('span', null, 'Goal'), goalSel),
        h('label', { class: 'field' }, h('span', null, 'Counts from'), startIn), h('label', { class: 'field' }, h('span', null, 'Deadline'), deadIn)),
      h('label', { class: 'field inline' }, h('span', null, 'Completed'), doneCb),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: save }, 'Save'), h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog(`Delete the mission "${m.name}"? Its blocks stay.`, { danger: true, okLabel: 'Delete' })) { deleteMission(id); Drawer.close(); toast('Mission deleted', { action: 'Undo', onAction: () => restoreMission(id) }); } } }, 'Delete'))), 'mission:' + id);
  },

  /* ---- Settings ---- */
  settings() {
    const s = state.settings;
    const num = (label, key, min, max) => h('label', { class: 'field inline' }, h('span', null, label), h('input', { type: 'number', min, max, value: s[key], style: { width: '90px' }, onChange: (e) => updateSettings({ [key]: clamp(+e.target.value || min, min, max) }) }));
    const themeList = h('div', { class: 'stack sm' });
    const renderThemes = () => setKids(themeList, ...themes().map((th) => h('div', { class: 'theme-row' },
      h('input', { type: 'color', value: th.color, 'aria-label': 'Colour', onChange: (e) => upsertTheme({ id: th.id, color: e.target.value }) }),
      h('input', { type: 'text', value: th.name, maxlength: 40, 'aria-label': 'Theme name', onChange: (e) => { if (e.target.value.trim()) upsertTheme({ id: th.id, name: e.target.value.trim() }); } }),
      h('button', { class: 'btn ghost icon sm', 'aria-label': 'Remove theme', onClick: async () => { if (await confirmDialog(`Remove the theme "${th.name}"? Existing blocks stay, shown in grey.`, { danger: true, okLabel: 'Remove' })) { if (!removeTheme(th.id)) toast('Keep at least one theme', { error: true }); renderThemes(); } } }, '✕'))));
    renderThemes();
    const newName = h('input', { type: 'text', placeholder: 'New theme', maxlength: 40 });
    const addTheme = () => { const n = newName.value.trim(); if (!n) return; upsertTheme({ id: uid().slice(0, 8), name: n, color: THEME_PALETTE[themes().length % THEME_PALETTE.length] }); newName.value = ''; renderThemes(); };
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTheme(); } });
    const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = importJson(JSON.parse(await f.text())); toast(`Imported: ${r.n} new, ${r.u} updated, ${r.c} kept`, { duration: 8000 }); } catch (err) { console.error(err); toast('Invalid file', { error: true }); } e.target.value = ''; } });
    const notifRow = h('div', { class: 'field inline' }, h('span', null, 'Browser notifications'), !('Notification' in window) ? h('span', { class: 'muted small' }, 'unavailable') : Notification.permission === 'granted' ? h('span', { class: 'muted small' }, 'enabled') : Notification.permission === 'denied' ? h('span', { class: 'muted small' }, 'blocked') : h('button', { class: 'btn sm', onClick: async () => { try { await Notification.requestPermission(); } catch { /* */ } Panel.settings(); } }, 'Allow'));
    Drawer.open('Settings', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Your name (shown on the report)'), h('input', { type: 'text', value: s.name, maxlength: 60, onChange: (e) => updateSettings({ name: e.target.value.trim() }) })),
      h('h3', null, 'Study themes'), themeList, h('div', { class: 'row' }, newName, h('button', { class: 'btn sm', onClick: addTheme }, '+ Add')),
      h('label', { class: 'field inline' }, h('span', null, 'Weekly goal (hours, 0 = none)'), h('input', { type: 'number', min: 0, max: 80, value: s.weekly_goal_hours || 0, style: { width: '90px' }, onChange: (e) => updateSettings({ weekly_goal_hours: clamp(+e.target.value || 0, 0, 80) }) })),
      h('div', { class: 'row' }, h('a', { class: 'btn sm', href: '#/achievements', onClick: () => Drawer.close() }, '🏆 Achievements & books'), h('a', { class: 'btn sm', href: '#/week', onClick: () => Drawer.close() }, '📈 Weekly review')),
      h('h3', null, 'Timer'),
      h('label', { class: 'field inline' }, h('span', null, 'Guided breaks (pause and resume by themselves)'), h('input', { type: 'checkbox', class: 'switch', checked: s.guided_breaks !== false, onChange: (e) => updateSettings({ guided_breaks: e.target.checked }) })),
      h('label', { class: 'field inline' }, h('span', null, 'Break length (min)'), h('select', { style: { width: 'auto' }, onChange: (e) => updateSettings({ break_len_min: +e.target.value }) }, ...[10, 15, 30].map((v) => h('option', { value: v, selected: v === (s.break_len_min || 15) }, v)))),
      num('Close a forgotten break after (min)', 'pause_autostop_min', 5, 600), num('Daily minimum for the streak (min)', 'streak_min_min', 1, 600),
      h('label', { class: 'field inline' }, h('span', null, 'Sound on break reminder and stop'), h('input', { type: 'checkbox', class: 'switch', checked: !!s.sound, onChange: (e) => updateSettings({ sound: e.target.checked }) })), notifRow,
      h('h3', null, 'Calendar'),
      num('Length when clicking an empty slot (min)', 'default_len_min', 5, 480),
      h('label', { class: 'field inline' }, h('span', null, 'Freeze night hours (bedtime)'), h('input', { type: 'checkbox', class: 'switch', checked: !!s.night_freeze, onChange: (e) => { updateSettings({ night_freeze: e.target.checked }); Panel.settings(); } })),
      s.night_freeze ? h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '6px' } }, h('span', { class: 'muted small' }, 'from'),
        h('input', { type: 'time', value: s.night_from || '23:00', step: 900, onChange: (e) => updateSettings({ night_from: e.target.value || '23:00' }) }), h('span', { class: 'muted small' }, 'to'),
        h('input', { type: 'time', value: s.night_to || '07:00', step: 900, onChange: (e) => updateSettings({ night_to: e.target.value || '07:00' }) })) : null,
      s.night_freeze ? h('p', { class: 'muted small' }, 'Those hours are greyed out on the timeline and no new block can be created there.') : null,
      h('label', { class: 'field inline' }, h('span', null, 'Snap (min)'), h('select', { style: { width: 'auto' }, onChange: (e) => updateSettings({ snap_min: +e.target.value }) }, ...[5, 10, 15, 30].map((v) => h('option', { value: v, selected: v === s.snap_min }, v)))),
      h('label', { class: 'field inline' }, h('span', null, 'Announce new achievements'), h('input', { type: 'checkbox', class: 'switch', checked: s.ach_feedback !== false, onChange: (e) => updateSettings({ ach_feedback: e.target.checked }) })),
      h('h3', null, 'Appearance'),
      h('label', { class: 'field inline' }, h('span', null, 'Background picture'), h('select', { style: { width: 'auto' }, onChange: (e) => { updateSettings({ bg_strength: e.target.value }); Background.strength(); } }, ...[['soft', 'Discreet'], ['medium', 'Medium'], ['strong', 'Strong']].map(([v, l]) => h('option', { value: v, selected: v === (s.bg_strength || 'medium') }, l)))),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => Background.next() }, '🖼 Next picture'), h('button', { class: 'btn sm ghost', onClick: () => Background.useDaily() }, "Day's pick")),
      h('p', { class: 'muted small' }, 'Pictures live in assets/bg/ (named 1, 2, 3… with .webp/.jpg/.png). One is drawn per day; the picture you choose here lasts until tomorrow.'),
      h('h3', null, 'Focus mode'),
      h('label', { class: 'field inline' }, h('span', null, 'Background animation'), h('select', { style: { width: 'auto' }, onChange: (e) => updateSettings({ focus_anim: e.target.value }) }, ...[['aurora', 'Aurora'], ['ondas', 'Waves'], ['estrelas', 'Stars'], ['nenhuma', 'None']].map(([v, l]) => h('option', { value: v, selected: v === s.focus_anim }, l)))),
      h('h3', null, 'Your data'),
      h('p', { class: 'muted small' }, `Synced to your account (${Auth.user?.email || ''}). Only you can see your blocks.`),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => exportCsv(activeSessions()) }, '⬇ CSV'), h('button', { class: 'btn sm', onClick: () => exportJson() }, '⬇ JSON backup'), h('button', { class: 'btn sm', onClick: () => importInput.click() }, '⬆ Import JSON'), importInput),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn sm ghost', onClick: async () => { if (await confirmDialog('Add sample data (35 days of fictitious blocks)? You can delete it afterwards.')) { seedSampleData(); toast('Sample data added'); } } }, 'Sample data'),
        h('button', { class: 'btn sm danger', onClick: async () => { if (await confirmDialog('Delete ALL blocks and missions in this account?', { danger: true, okLabel: 'Delete everything', twice: 'Final confirmation: this cannot be undone.' })) { const now = iso(Date.now()); state.sessions.forEach((x) => { if (!x.deleted_at) { x.deleted_at = now; x.updated_at = now; dirty('session', x.id); } }); state.missions.forEach((x) => { if (!x.deleted_at) { x.deleted_at = now; x.updated_at = now; dirty('mission', x.id); } }); commit('sessions'); toast('Everything deleted'); } } }, 'Delete everything')),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn', onClick: () => Auth.signOut() }, 'Sign out')),
      h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Shortcuts: Space pause/resume · F focus mode · N quick note · Ctrl+Z undo')), 'settings');
  },
};
