document.addEventListener('DOMContentLoaded', () => {
    cargarDatosDesdeLaNube();
    aplicarTemaGuardado();
    actualizarDisplayTimer();
});

// --- ESTRUCTURA DE DATOS ---
let plantillaCompleta = [];
let jugadoresConvocados = [];
let historialDePartidos = [];
let proximoPartido = { fecha: "A definir", rival: "A definir" };
let indiceJugadorAEliminar = null;
let timerInterval = null;
let segundosRestantes = 40 * 60;
let etapaActual = 1;
let rendimientoChart = null;

// --- LÓGICA DE BASE DE DATOS ---
async function cargarDatosDesdeLaNube() {
    try {
        const response = await fetch('/.netlify/functions/get-all-data');
        if (!response.ok) throw new Error('No se pudo conectar al servidor.');
        const data = await response.json();
        plantillaCompleta = data.jugadores || [];
        historialDePartidos = data.historial || [];
        const proximoPartidoGuardado = localStorage.getItem('proximoPartido');
        if (proximoPartidoGuardado) {
            proximoPartido = JSON.parse(proximoPartidoGuardado);
        }
        actualizarVista();
    } catch (error) {
        console.error('Error fatal al cargar datos:', error);
        mostrarAlerta('Error de Conexión', 'No se pudieron cargar los datos desde la base de datos. Revisa tu conexión a internet.');
    }
}

async function finalizarPartido() {
    if (proximoPartido.rival === 'A definir' || proximoPartido.fecha === 'A definir') {
        mostrarAlerta('Acción no permitida', 'Primero debes programar un partido.');
        return;
    }
    reproducirSilbato();
    resetTimer(true);
    const golesRival = parseInt(document.getElementById('rival-score-input').value);
    if (isNaN(golesRival) || golesRival < 0) {
        mostrarAlerta('Dato Inválido', 'Introduce un número válido de goles para el rival.');
        return;
    }
    const golesNuestros = jugadoresConvocados.reduce((total, j) => total + j.statsPartido.goles, 0);
    const resultado = golesNuestros > golesRival ? 'victoria' : golesNuestros < golesRival ? 'derrota' : 'empate';
    const partido = {
        fecha: new Date().toISOString().split('T')[0],
        rival: proximoPartido.rival,
        goles_nuestros: golesNuestros,
        goles_rival: golesRival,
        resultado,
    };
    try {
        const response = await fetch('/.netlify/functions/finalize-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partido, jugadoresDelPartido: jugadoresConvocados }),
        });
        if (!response.ok) throw new Error('El servidor no pudo guardar el partido.');
        jugadoresConvocados = [];
        proximoPartido = { fecha: "A definir", rival: "A definir" };
        localStorage.removeItem('proximoPartido');
        document.getElementById('rival-score-input').value = '0';
        mostrarAlerta('¡Éxito!', 'El partido y las estadísticas se han guardado en la nube.');
        cargarDatosDesdeLaNube();
    } catch (error) {
        console.error('Error al finalizar el partido:', error);
        mostrarAlerta('Error', 'No se pudo guardar el partido en la base de datos.');
    }
}

// --- GESTIÓN DE JUGADORES ---
function convocarJugador() {
    const selector = document.getElementById('jugador-select');
    if (!selector.value) {
        mostrarAlerta('Error', 'No hay ningún jugador seleccionado.');
        return;
    }
    const jugadorInfo = plantillaCompleta.find(j => j.nombre === selector.value);
    jugadoresConvocados.push({
        ...jugadorInfo,
        statsPartido: { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }
    });
    actualizarVista();
}

function confirmarEliminacion() {
    if (indiceJugadorAEliminar !== null) {
        jugadoresConvocados.splice(indiceJugadorAEliminar, 1);
        cerrarModal('modal-confirmacion');
        actualizarVista();
    }
}

// --- ACTUALIZACIÓN DE VISTA ---
function actualizarVista() {
    const partidosGanados = historialDePartidos.filter(p => p.resultado === 'victoria').length;
    const partidosEmpatados = historialDePartidos.filter(p => p.resultado === 'empate').length;
    const partidosPerdidos = historialDePartidos.filter(p => p.resultado === 'derrota').length;
    document.getElementById('partidos-ganados').textContent = partidosGanados;
    document.getElementById('partidos-empatados').textContent = partidosEmpatados;
    document.getElementById('partidos-perdidos').textContent = partidosPerdidos;
    actualizarTablaLideres();
    actualizarTablaHistorial();
    actualizarGraficoRendimiento(partidosGanados, partidosEmpatados, partidosPerdidos);
    document.getElementById('fecha-proximo').textContent = proximoPartido.fecha;
    document.getElementById('rival-proximo').textContent = proximoPartido.rival;
    document.getElementById('rival-actual').textContent = proximoPartido.rival || 'Rival';
    const golesNuestros = jugadoresConvocados.reduce((total, j) => total + j.statsPartido.goles, 0);
    document.getElementById('nuestros-goles').textContent = golesNuestros;
    popularSelectorJugadores();
    actualizarTablaJugadoresConvocados();
    actualizarEventosDelPartido();
}

function actualizarEventosDelPartido() {
    const renderizarEventos = (tipo, icono, nombreSingular) => {
        const div = document.getElementById(`lista-${tipo}`);
        if (!div) return;
        const jugadoresConEvento = jugadoresConvocados
            .filter(j => j.statsPartido[tipo] > 0)
            .map(j => `${j.nombre} (${j.statsPartido[tipo]})`);
        if (jugadoresConEvento.length > 0) {
            div.innerHTML = `<p>${icono} <strong>${nombreSingular}:</strong> ${jugadoresConEvento.join(', ')}</p>`;
        } else {
            div.innerHTML = '';
        }
    };
    renderizarEventos('goles', '⚽', 'Goles');
    renderizarEventos('asistencias', '🤝', 'Asistencias');
    renderizarEventos('amarillas', '<i class="fa-solid fa-square-full yellow"></i>', 'Amarillas');
    renderizarEventos('rojas', '<i class="fa-solid fa-square-full red"></i>', 'Rojas');
}

function actualizarTablaLideres() {
    const lideres = [...plantillaCompleta].sort((a, b) => (b.goles_totales || 0) - (a.goles_totales || 0) || (b.asistencias_totales || 0) - (a.asistencias_totales || 0));
    const tbody = document.querySelector('#tabla-lideres tbody');
    tbody.innerHTML = '';
    lideres.slice(0, 10).forEach(j => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${j.nombre}</td><td>${j.goles_totales || 0}</td><td>${j.asistencias_totales || 0}</td>`;
        tbody.appendChild(fila);
    });
}

function actualizarTablaHistorial() {
    const tbody = document.querySelector('#tabla-historial tbody');
    tbody.innerHTML = '';
    historialDePartidos.forEach(p => {
        const fila = document.createElement('tr');
        const fechaFormateada = new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-ES');
        fila.innerHTML = `<td>${fechaFormateada}</td><td>${p.rival}</td><td>${p.goles_nuestros} - ${p.goles_rival}</td><td><span class="resultado-historial ${p.resultado}">${p.resultado.charAt(0).toUpperCase() + p.resultado.slice(1)}</span></td>`;
        tbody.appendChild(fila);
    });
}

function actualizarTablaJugadoresConvocados() {
    const tbody = document.querySelector('#tabla-jugadores tbody');
    tbody.innerHTML = '';
    const iconosPosicion = {'POR':'<i class="fa-solid fa-mitten"></i>','DEF':'<i class="fa-solid fa-shield-halved"></i>','LAT':'<i class="fa-solid fa-arrows-left-right"></i>','MCD':'<i class="fa-solid fa-anchor"></i>','VOL':'<i class="fa-solid fa-arrows-up-down"></i>','EXT':'<i class="fa-solid fa-plane"></i>','DEL':'<i class="fa-solid fa-person-running"></i>'};
    jugadoresConvocados.forEach((j, i) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${iconosPosicion[j.posicion] || ''}</td><td>${j.nombre}</td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'goles','restar')">-</button><span class="stat-value">${j.statsPartido.goles}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'goles','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'asistencias','restar')">-</button><span class="stat-value">${j.statsPartido.asistencias}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'asistencias','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'amarillas','restar')">-</button><span class="stat-value">${j.statsPartido.amarillas}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'amarillas','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'rojas','restar')">-</button><span class="stat-value">${j.statsPartido.rojas}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'rojas','sumar')">+</button></div></td><td><button class="btn-eliminar" onclick="abrirModalConfirmacion(${i},'${j.nombre.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(fila);
    });
}

function popularSelectorJugadores() {
    const selector = document.getElementById('jugador-select');
    const nombresConvocados = jugadoresConvocados.map(j => j.nombre);
    const jugadoresDisponibles = plantillaCompleta.filter(j => !nombresConvocados.includes(j.nombre));
    selector.innerHTML = '';
    if (jugadoresDisponibles.length === 0) {
        selector.innerHTML = '<option value="">-- No hay más jugadores --</option>';
        selector.disabled = true;
    } else {
        jugadoresDisponibles.forEach(j => {
            const opcion = document.createElement('option');
            opcion.value = j.nombre;
            opcion.textContent = `${j.nombre} (${j.posicion})`;
            selector.appendChild(opcion);
        });
        selector.disabled = false;
    }
}

function actualizarGraficoRendimiento(ganados, empatados, perdidos) {
    if (!document.getElementById('vista-estadisticas').classList.contains('vista-oculta')) {
        const ctx = document.getElementById('rendimiento-chart').getContext('2d');
        const style = getComputedStyle(document.documentElement);
        const colores = ['--color-victoria', '--color-empate', '--color-derrota'].map(c => style.getPropertyValue(c).trim());
        const bordeColor = style.getPropertyValue('--color-superficie').trim();
        const labelColor = style.getPropertyValue('--color-texto-secundario').trim();
        if (rendimientoChart) { rendimientoChart.destroy(); }
        rendimientoChart = new Chart(ctx, { type: 'pie', data: { labels: ['Ganados', 'Empatados', 'Perdidos'], datasets: [{ data: [ganados, empatados, perdidos], backgroundColor: colores, borderColor: bordeColor, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: labelColor } } } } });
    }
}

// --- FUNCIONES BÁSICAS ---
function cambiarVista(vistaActivaId) { const vistaPartido = document.getElementById('vista-partido'); const vistaEstadisticas = document.getElementById('vista-estadisticas'); const btnPartido = document.getElementById('btn-vista-partido'); const btnEstadisticas = document.getElementById('btn-vista-estadisticas'); if (vistaActivaId === 'vista-partido') { vistaPartido.classList.remove('vista-oculta'); vistaEstadisticas.classList.add('vista-oculta'); btnPartido.classList.add('active'); btnEstadisticas.classList.remove('active'); } else { vistaPartido.classList.add('vista-oculta'); vistaEstadisticas.classList.remove('vista-oculta'); btnPartido.classList.remove('active'); btnEstadisticas.classList.add('active'); } actualizarVista(); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('tema', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); actualizarVista(); }
function aplicarTemaGuardado() { if (localStorage.getItem('tema') === 'dark') { document.body.classList.add('dark-mode'); document.getElementById('checkbox').checked = true; } }
function iniciarTimer() { if (!timerInterval) { timerInterval = setInterval(() => { if (segundosRestantes > 0) { segundosRestantes--; } else { pausarTimer(); reproducirSilbato(); if (etapaActual === 1) { mostrarAlerta("Fin del Tiempo", "¡Ha finalizado el primer tiempo!"); etapaActual = 2; resetTimer(false); } else { mostrarAlerta("Fin del Partido", "¡El partido ha terminado!"); } } actualizarDisplayTimer(); }, 1000); } }
function pausarTimer() { clearInterval(timerInterval); timerInterval = null; }
function resetTimer(resetearEtapa = true) { pausarTimer(); segundosRestantes = 40 * 60; if (resetearEtapa) { etapaActual = 1; } actualizarDisplayTimer(); }
function actualizarDisplayTimer() { const m = Math.floor(segundosRestantes / 60); const s = segundosRestantes % 60; document.getElementById('cronometro').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; document.getElementById('etapa-tiempo').textContent = etapaActual === 1 ? '1er Tiempo' : '2do Tiempo'; }
function reproducirSilbato() { document.getElementById('sonido-silbato').play(); }
function abrirModal(id) { document.getElementById(id).classList.remove('modal-oculto'); }
function cerrarModal(id) { document.getElementById(id).classList.add('modal-oculto'); }
function mostrarAlerta(titulo, mensaje) { document.getElementById('alerta-titulo').textContent = titulo; document.getElementById('alerta-mensaje').textContent = mensaje; abrirModal('modal-alerta'); }
function abrirModalConfirmacion(index, nombre) { indiceJugadorAEliminar = index; document.getElementById('nombre-jugador-modal').textContent = nombre; abrirModal('modal-confirmacion'); }
function actualizarEstadistica(index, tipo, accion) { const j = jugadoresConvocados[index]; if (accion === 'sumar') j.statsPartido[tipo]++; else if (accion === 'restar' && j.statsPartido[tipo] > 0) j.statsPartido[tipo]--; actualizarVista(); }
function actualizarProximoPartido() { const f = document.getElementById('input-fecha'), r = document.getElementById('input-rival'); if (f.value && r.value.trim()) { proximoPartido.fecha = new Date(f.value + 'T00:00:00').toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); proximoPartido.rival = r.value.trim(); f.value = ''; r.value = ''; localStorage.setItem('proximoPartido', JSON.stringify(proximoPartido)); actualizarVista(); } else { mostrarAlerta('Datos incompletos', 'Por favor, completa la fecha y el nombre del rival.'); } }
function abrirModalReset() { mostrarAlerta('Función Deshabilitada', 'La opción de reinicio total está en mantenimiento para proteger los datos de la nube.'); }