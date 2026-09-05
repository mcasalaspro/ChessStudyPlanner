/* ===== Side panel contents ===== */
const Panel = {
  /* ---- Block (session) editor: changes apply immediately, with validation and undo ---- */
  editSession(id, { closing = false } = {}) {
    const s = sessionById(id); if (!s) return;
    const key = 'session:' + id;
    const body = h('div', { class: 'stack' });
    const errBox = h('div', { class: 'errors', hidden: true });
    let noteTa = null;
    const build = () => {
      const s = sessionById(id); if (!s || s.deleted_at) { Drawer.close(); return; }
      const tm = sessionTimes(s); const live = !s.ended_at;
      const summary = h('div', { class: 'summary' },
        h('div', null, h('b', null, fmtClock(tm.net)), h('span', null, 'líquido')),
        h('div', null, h('b', null, fmtClock(tm.gross)), h('span', null, 'bruto')),
        h('div', null, h('b', null, fmtClock(tm.pauseMs)), h('span', null, 'pausas')));
      const chips = themeChips(s.theme, (v) => apply({ theme: v }), { small: true, allowNone: false });
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
        else { end = start + Math.max(1, +durIn.value || 1) * MIN; }
        return { start, end };
      };
      const applyTimes = (anchor) => {
        const c = compute(anchor); if (!c) return;
        const shift = c.start - tm.start; const s0 = sessionById(id);
        let pauses;
        if (live) pauses = s0.pauses;
        else {
          const totalPause = Math.max(0, +pauseIn.value || 0) * MIN; const curPause = tm.pauseMs;
          if (Math.abs(totalPause - curPause) >= MIN * 0.5) { // user edited pause total → one synthetic pause in the middle
            pauses = totalPause > 0 ? [{ start: iso(c.start + (c.end - c.start - totalPause) / 2), end: iso(c.start + (c.end - c.start + totalPause) / 2) }] : [];
          } else pauses = (s0.pauses || []).map((p) => ({ start: iso(clamp(ms(p.start) + shift, c.start, c.end)), end: p.end ? iso(clamp(ms(p.end) + shift, c.start, c.end)) : null })).filter((p) => !p.end || ms(p.end) > ms(p.start));
        }
        const patch = { started_at: iso(c.start), ended_at: live ? null : iso(c.end), pauses };
        const errs = validateSession({ ...s0, ...patch }, id);
        if (errs.length) { showErrors(errs); build(); return; }
        errBox.hidden = true; updateSession(id, patch); toastUndo(closing ? 'Ajustado' : 'Bloco atualizado');
      };
      dateIn.addEventListener('change', () => applyTimes('dur')); startIn.addEventListener('change', () => applyTimes('dur'));
      endIn.addEventListener('change', () => applyTimes('end')); durIn.addEventListener('change', () => applyTimes('dur')); pauseIn.addEventListener('change', () => applyTimes('dur'));
      const note = noteEditor(s.note_md, { onChange: debounce((v) => { const cur = sessionById(id); if (cur && cur.note_md !== v) updateSession(id, { note_md: v }, { undoable: false }); }, 500) });
      noteTa = note.ta;
      const shortHint = closing && tm.net < 60000 ? h('p', { class: 'hint warn' }, 'Menos de 1 minuto líquido — quer descartar este bloco?') : null;
      const actions = h('div', { class: 'row', style: { marginTop: '6px' } },
        closing ? h('button', { class: 'btn primary', onClick: () => Drawer.close() }, 'Salvar') : null,
        closing ? h('button', { class: 'btn', onClick: () => { Drawer.close(); try { Timer.start(s.theme); } catch (e) { toast(e.message, { error: true }); } } }, 'Salvar e iniciar outro') : null,
        !live && !closing ? h('button', { class: 'btn', onClick: () => { const r = duplicateSessionTomorrow(id); if (r?.errors) showErrors(r.errors); else toastUndo('Bloco duplicado para amanhã'); } }, 'Duplicar p/ amanhã') : null,
        live ? h('button', { class: 'btn', onClick: () => { Drawer.close(); const st = Timer.stop(); if (st) Panel.closeSession(st.id); } }, '■ Encerrar agora') : null,
        h('button', { class: 'btn danger', onClick: async () => { if (closing && tm.net < 60000 || await confirmDialog('Apagar este bloco?', { danger: true, okLabel: 'Apagar' })) { deleteSession(id); Drawer.close(); toastUndo(closing ? 'Bloco descartado' : 'Bloco apagado'); } } }, closing ? 'Descartar' : 'Apagar'));
      setKids(body, summary, shortHint,
        h('div', { class: 'field' }, h('span', null, 'Tema'), chips),
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, h('span', null, 'Data'), dateIn), h('label', { class: 'field' }, h('span', null, 'Início'), startIn),
          h('label', { class: 'field' }, h('span', null, live ? 'Fim (em andamento)' : 'Fim'), endIn), h('label', { class: 'field' }, h('span', null, 'Duração (min)'), durIn),
          h('label', { class: 'field' }, h('span', null, 'Pausas (min)'), pauseIn),
          h('div', { class: 'field' }, h('span', null, 'Origem'), h('div', { class: 'muted small', style: { paddingTop: '8px' } }, s.source === 'timer' ? '⏱ cronômetro' : '✎ manual', s.meta?.autoclosed ? ' · ⚠ encerrado automaticamente' : ''))),
        h('div', { class: 'field' }, h('span', null, 'Comentário'), note.el),
        errBox, actions);
    };
    const showErrors = (errs) => { errBox.hidden = false; setKids(errBox, ...errs.map((e) => h('div', null, e.message, ' ', e.conflict ? h('a', { href: '#', onClick: (ev) => { ev.preventDefault(); Panel.editSession(e.conflict.id); } }, 'Ver bloco') : null))); };
    build();
    Drawer.open(closing ? 'Bloco encerrado' : (!s.ended_at ? 'Bloco em andamento' : 'Editar bloco'), body, key);
    // refresh when the block changes elsewhere (drag in the calendar, timer ticks)
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
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, list.length ? `${list.length} bloco${list.length > 1 ? 's' : ''}` : 'Nenhum bloco neste dia'), h('b', null, fmtHM(total / MIN))),
        ...list.map((s) => { const tm = sessionTimes(s); return h('button', { class: 'block-row', style: { '--c': themeColor(s.theme) }, onClick: () => Panel.editSession(s.id) }, h('i', { class: 'bar' }), h('span', { class: 'grow' }, h('b', null, themeName(s.theme)), s.note_md ? noteIcon() : null, h('span', { class: 'muted small' }, ' ', s.ended_at ? fmtRange(tm.start, tm.end) : `${hm(tm.start)} – em andamento`)), h('span', { class: 'num' }, fmtHM(tm.net / MIN))); }),
        h('button', { class: 'btn', onClick: () => { const now = new Date(nowMs()); const start = dayMs(key, key === todayKey() ? Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15 : 19 * 60); Calendar.createAt(start, state.settings.default_len_min); } }, '+ Novo bloco neste dia'));
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
    const save = () => { updateMission(id, { name: nameIn.value.trim() || themeName(themeSel.value), theme: themeSel.value, goal_hours: +goalSel.value, start_date: startIn.value || m.start_date, deadline: deadIn.value || null, status: doneCb.checked ? 'done' : 'active' }); toast('Missão salva'); Drawer.close(); };
    Drawer.open('Editar missão', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Nome'), nameIn),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Tema'), themeSel), h('label', { class: 'field' }, h('span', null, 'Meta'), goalSel),
        h('label', { class: 'field' }, h('span', null, 'Conta a partir de'), startIn), h('label', { class: 'field' }, h('span', null, 'Prazo'), deadIn)),
      h('label', { class: 'field inline' }, h('span', null, 'Concluída'), doneCb),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: save }, 'Salvar'), h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog(`Apagar a missão "${m.name}"? Os blocos ficam.`, { danger: true, okLabel: 'Apagar' })) { deleteMission(id); Drawer.close(); toast('Missão apagada', { action: 'Desfazer', onAction: () => restoreMission(id) }); } } }, 'Apagar'))), 'mission:' + id);
  },

  /* ---- Settings ---- */
  settings() {
    const s = state.settings;
    const num = (label, key, min, max) => h('label', { class: 'field inline' }, h('span', null, label), h('input', { type: 'number', min, max, value: s[key], style: { width: '90px' }, onChange: (e) => updateSettings({ [key]: clamp(+e.target.value || min, min, max) }) }));
    const themeList = h('div', { class: 'stack sm' });
    const renderThemes = () => setKids(themeList, ...themes().map((th) => h('div', { class: 'theme-row' },
      h('input', { type: 'color', value: th.color, 'aria-label': 'Cor', onChange: (e) => upsertTheme({ id: th.id, color: e.target.value }) }),
      h('input', { type: 'text', value: th.name, maxlength: 40, 'aria-label': 'Nome do tema', onChange: (e) => { if (e.target.value.trim()) upsertTheme({ id: th.id, name: e.target.value.trim() }); } }),
      h('button', { class: 'btn ghost icon sm', 'aria-label': 'Remover tema', onClick: async () => { if (await confirmDialog(`Remover o tema "${th.name}"? Blocos existentes continuam com a cor cinza.`, { danger: true, okLabel: 'Remover' })) { if (!removeTheme(th.id)) toast('Mantenha ao menos um tema', { error: true }); renderThemes(); } } }, '✕'))));
    renderThemes();
    const newName = h('input', { type: 'text', placeholder: 'Novo tema', maxlength: 40 });
    const addTheme = () => { const n = newName.value.trim(); if (!n) return; upsertTheme({ id: uid().slice(0, 8), name: n, color: THEME_PALETTE[themes().length % THEME_PALETTE.length] }); newName.value = ''; renderThemes(); };
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTheme(); } });
    const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = importJson(JSON.parse(await f.text())); toast(`Importado: ${r.n} novos, ${r.u} atualizados, ${r.c} mantidos`, { duration: 8000 }); } catch (err) { console.error(err); toast('Arquivo inválido', { error: true }); } e.target.value = ''; } });
    const notifRow = h('div', { class: 'field inline' }, h('span', null, 'Notificações do navegador'), !('Notification' in window) ? h('span', { class: 'muted small' }, 'indisponível') : Notification.permission === 'granted' ? h('span', { class: 'muted small' }, 'ativadas') : Notification.permission === 'denied' ? h('span', { class: 'muted small' }, 'bloqueadas') : h('button', { class: 'btn sm', onClick: async () => { try { await Notification.requestPermission(); } catch { /* */ } Panel.settings(); } }, 'Permitir'));
    Drawer.open('Configurações', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Seu nome (aparece no relatório)'), h('input', { type: 'text', value: s.name, maxlength: 60, onChange: (e) => updateSettings({ name: e.target.value.trim() }) })),
      h('h3', null, 'Temas de estudo'), themeList, h('div', { class: 'row' }, newName, h('button', { class: 'btn sm', onClick: addTheme }, '+ Adicionar')),
      h('h3', null, 'Cronômetro'),
      num('Encerrar pausa esquecida após (min)', 'pause_autostop_min', 5, 600), num('Mínimo diário para a sequência (min)', 'streak_min_min', 1, 600),
      h('label', { class: 'field inline' }, h('span', null, 'Som ao encerrar / avisar'), h('input', { type: 'checkbox', class: 'switch', checked: !!s.sound, onChange: (e) => updateSettings({ sound: e.target.checked }) })), notifRow,
      h('h3', null, 'Calendário'),
      num('Duração ao clicar num espaço vazio (min)', 'default_len_min', 5, 480),
      h('label', { class: 'field inline' }, h('span', null, 'Encaixe (min)'), h('select', { style: { width: 'auto' }, onChange: (e) => updateSettings({ snap_min: +e.target.value }) }, ...[5, 10, 15, 30].map((v) => h('option', { value: v, selected: v === s.snap_min }, v)))),
      h('h3', null, 'Modo foco'),
      h('label', { class: 'field inline' }, h('span', null, 'Animação de fundo'), h('select', { style: { width: 'auto' }, onChange: (e) => updateSettings({ focus_anim: e.target.value }) }, ...[['aurora', 'Aurora'], ['ondas', 'Ondas'], ['estrelas', 'Estrelas'], ['nenhuma', 'Nenhuma']].map(([v, l]) => h('option', { value: v, selected: v === s.focus_anim }, l)))),
      h('h3', null, 'Seus dados'),
      h('p', { class: 'muted small' }, Sync.enabled ? `Sincronizado com a nuvem para a conta ${Auth.user?.email || ''}. Só você vê seus blocos.` : 'Modo local: os dados ficam apenas neste navegador.'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => exportCsv(activeSessions()) }, '⬇ CSV'), h('button', { class: 'btn sm', onClick: () => exportJson() }, '⬇ Backup JSON'), h('button', { class: 'btn sm', onClick: () => importInput.click() }, '⬆ Importar JSON'), importInput),
      h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm ghost', onClick: async () => { if (await confirmDialog('Adicionar dados de exemplo (35 dias de blocos fictícios)? Você pode apagá-los depois.')) { seedSampleData(); toast('Dados de exemplo adicionados'); } } }, 'Dados de exemplo'),
        h('button', { class: 'btn sm danger', onClick: async () => { if (await confirmDialog('Apagar TODOS os blocos e missões desta conta?', { danger: true, okLabel: 'Apagar tudo', twice: 'Confirmação final: isto não pode ser desfeito.' })) { const now = iso(Date.now()); state.sessions.forEach((x) => { if (!x.deleted_at) { x.deleted_at = now; x.updated_at = now; dirty('session', x.id); } }); state.missions.forEach((x) => { if (!x.deleted_at) { x.deleted_at = now; x.updated_at = now; dirty('mission', x.id); } }); commit('sessions'); toast('Tudo apagado'); } } }, 'Apagar tudo')),
      Sync.enabled ? h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn', onClick: () => Auth.signOut() }, 'Sair da conta')) : null,
      h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Chess Study Planner · atalhos: Espaço pausa/retoma · F modo foco · N nota rápida · Ctrl+Z desfaz')), 'settings');
  },
};
const GOAL_OPTIONS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
