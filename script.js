document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    aplicarTemaGuardado();
    actualizarVista();
    actualizarDisplayTimer();
    popularSelectorJugadores(); 
});

// --- ESTRUCTURA DE DATOS ---
let datosDelEquipo = {};
let baseDeDatosJugadores = [];
let indiceJugadorAEliminar = null;
let timerInterval = null;
let segundosRestantes = 40 * 60;
let etapaActual = 1;
let rendimientoChart = null;

const datosPorDefecto = {
    partidos: { ganados: 0, empatados: 0, perdidos: 0 },
    proximoPartido: { fecha: "A definir", rival: "A definir" },
    jugadores: [],
    historial: [],
    rachas: { rachaVictorias: 0, rachaSinPerder: 0, rachaEmpates: 0, rachaDerrotas: 0, rachaSinGanar: 0 }
};

// --- LÓGICA DE BASE DE DATOS Y SERVIDOR ---
async function popularSelectorJugadores() {
    const selector = document.getElementById('jugador-select');
    selector.innerHTML = '<option value="">Cargando plantilla...</option>';
    selector.disabled = true;

    try {
        const response = await fetch('/.netlify/functions/get-jugadores');
        if (!response.ok) throw new Error('Error de red al obtener jugadores.');
        
        baseDeDatosJugadores = await response.json();
        const nombresEnPartido = datosDelEquipo.jugadores.map(j => j.nombre);
        const jugadoresDisponibles = baseDeDatosJugadores.filter(j => !nombresEnPartido.includes(j.nombre));
        
        selector.innerHTML = '';
        if (jugadoresDisponibles.length === 0) {
            selector.innerHTML = '<option value="">-- No hay más jugadores --</option>';
            selector.disabled = true;
        } else {
            jugadoresDisponibles.forEach(j => {
                const opcion = document.createElement('option');
                opcion.value = j.nombre;
                opcion.dataset.posicion = j.posicion;
                opcion.textContent = `${j.nombre} (${j.posicion})`;
                selector.appendChild(opcion);
            });
            selector.disabled = false;
        }
    } catch (error) {
        console.error('Error al cargar jugadores:', error);
        selector.innerHTML = '<option value="">Error al cargar plantilla</option>';
        mostrarAlerta('Error de Conexión', 'No se pudo cargar la lista de jugadores desde la base de datos.');
    }
}

async function crearNuevoJugador() {
    const nombreInput = document.getElementById('nuevo-jugador-nombre');
    const posicionSelect = document.getElementById('nuevo-jugador-posicion');
    const nombre = nombreInput.value.trim();
    const posicion = posicionSelect.value;

    if (!nombre) {
        mostrarAlerta('Campo Vacío', 'Por favor, introduce el nombre del jugador.');
        return;
    }

    try {
        const response = await fetch('/.netlify/functions/add-jugador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, posicion }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'El servidor rechazó la solicitud.');

        nombreInput.value = '';
        mostrarAlerta('Éxito', `¡Jugador "${result.nombre}" guardado en la base de datos!`);
        popularSelectorJugadores();

    } catch (error) {
        console.error('Error al crear jugador:', error);
        mostrarAlerta('Error', `No se pudo guardar el jugador. Razón: ${error.message}`);
    }
}

function convocarJugador() {
    const selector = document.getElementById('jugador-select');
    if (!selector.value) {
        mostrarAlerta('Error', 'No hay ningún jugador seleccionado.');
        return;
    }

    const opcionSeleccionada = selector.options[selector.selectedIndex];
    const nombre = opcionSeleccionada.value;
    const posicion = opcionSeleccionada.dataset.posicion;

    const jugadorConvocado = {
        nombre,
        posicion,
        statsTotales: { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }, // Estos datos se recalcularán
        statsPartido: { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }
    };
    
    // Aquí puedes decidir si quieres cargar sus stats totales de otra tabla en el futuro. Por ahora, empiezan de cero.
    datosDelEquipo.jugadores.push(jugadorConvocado);
    actualizarVista();
    guardarDatos();
}

// --- GESTIÓN DE VISTAS Y TEMA ---
function cambiarVista(vistaActivaId) {
    document.getElementById('vista-partido').classList.add('vista-oculta');
    document.getElementById('vista-estadisticas').classList.add('vista-oculta');
    document.getElementById('btn-vista-partido').classList.remove('active');
    document.getElementById('btn-vista-estadisticas').classList.remove('active');
    document.getElementById(vistaActivaId).classList.remove('vista-oculta');
    document.getElementById(`btn-${vistaActivaId}`).classList.add('active');
    if (vistaActivaId === 'vista-estadisticas') { actualizarGraficoRendimiento(); }
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('tema', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); actualizarGraficoRendimiento(); }
function aplicarTemaGuardado() { if (localStorage.getItem('tema') === 'dark') { document.body.classList.add('dark-mode'); document.getElementById('checkbox').checked = true; } }

// --- CRONÓMETRO ---
function iniciarTimer() { if (!timerInterval) { timerInterval = setInterval(() => { if (segundosRestantes > 0) { segundosRestantes--; } else { pausarTimer(); reproducirSilbato(); if (etapaActual === 1) { mostrarAlerta("Fin del Tiempo", "¡Ha finalizado el primer tiempo!"); etapaActual = 2; resetTimer(false); } else { mostrarAlerta("Fin del Partido", "¡El partido ha terminado!"); } } actualizarDisplayTimer(); }, 1000); } }
function pausarTimer() { clearInterval(timerInterval); timerInterval = null; }
function resetTimer(resetearEtapa = true) { pausarTimer(); segundosRestantes = 40 * 60; if (resetearEtapa) { etapaActual = 1; } actualizarDisplayTimer(); }
function actualizarDisplayTimer() { const m = Math.floor(segundosRestantes / 60); const s = segundosRestantes % 60; document.getElementById('cronometro').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; document.getElementById('etapa-tiempo').textContent = etapaActual === 1 ? '1er Tiempo' : '2do Tiempo'; }
function reproducirSilbato() { document.getElementById('sonido-silbato').play(); }

// --- MODALES ---
function abrirModal(id) { document.getElementById(id).classList.remove('modal-oculto'); }
function cerrarModal(id) { document.getElementById(id).classList.add('modal-oculto'); }
function mostrarAlerta(titulo, mensaje) { document.getElementById('alerta-titulo').textContent = titulo; document.getElementById('alerta-mensaje').textContent = mensaje; abrirModal('modal-alerta'); }
function abrirModalConfirmacion(index, nombre) { indiceJugadorAEliminar = index; document.getElementById('nombre-jugador-modal').textContent = nombre; abrirModal('modal-confirmacion'); }
function abrirModalReset() { abrirModal('modal-reset'); }

// --- LÓGICA DEL PARTIDO ---
function confirmarEliminacion() { if (indiceJugadorAEliminar !== null) { datosDelEquipo.jugadores.splice(indiceJugadorAEliminar, 1); cerrarModal('modal-confirmacion'); actualizarVista(); guardarDatos(); } }
function confirmarResetTotal() { localStorage.removeItem('datosDelEquipoArsenalFC'); location.reload(); }
function finalizarPartido() { if (datosDelEquipo.proximoPartido.rival === 'A definir' || datosDelEquipo.proximoPartido.fecha === 'A definir') { mostrarAlerta('Acción no permitida', 'Primero debes programar un partido (fecha y rival) antes de poder finalizarlo.'); return; } reproducirSilbato(); resetTimer(true); const golesRival = parseInt(document.getElementById('rival-score-input').value); if (isNaN(golesRival) || golesRival < 0) { mostrarAlerta('Dato Inválido', 'Introduce un número válido de goles para el rival.'); return; } const golesNuestros = datosDelEquipo.jugadores.reduce((total, j) => total + j.statsPartido.goles, 0); const resultado = golesNuestros > golesRival ? 'victoria' : golesNuestros < golesRival ? 'derrota' : 'empate'; const partido = { fecha: datosDelEquipo.proximoPartido.fecha, rival: datosDelEquipo.proximoPartido.rival, golesNuestros, golesRival, resultado }; registrarResultado(partido); document.getElementById('rival-score-input').value = '0'; }
function registrarResultado(partido) { datosDelEquipo.partidos[partido.resultado === 'victoria' ? 'ganados' : partido.resultado === 'empate' ? 'empatados' : 'perdidos']++; datosDelEquipo.historial.push(partido); datosDelEquipo.jugadores.forEach(j => { Object.keys(j.statsTotales).forEach(stat => j.statsTotales[stat] += j.statsPartido[stat]); j.statsPartido = { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }; }); datosDelEquipo.proximoPartido = { fecha: "A definir", rival: "A definir" }; actualizarVista(); guardarDatos(); }

// --- ACTUALIZACIÓN DE VISTAS Y GRÁFICOS ---
function actualizarVista() {
    ['ganados', 'empatados', 'perdidos'].forEach(tipo => { document.getElementById(`partidos-${tipo}`).textContent = datosDelEquipo.partidos[tipo]; });
    document.getElementById('fecha-proximo').textContent = datosDelEquipo.proximoPartido.fecha; document.getElementById('rival-proximo').textContent = datosDelEquipo.proximoPartido.rival;
    const golesNuestros = datosDelEquipo.jugadores.reduce((total, j) => total + j.statsPartido.goles, 0);
    document.getElementById('nuestros-goles').textContent = golesNuestros; document.getElementById('rival-actual').textContent = datosDelEquipo.proximoPartido.rival || 'Rival';
    
    const tbody = document.querySelector('#tabla-jugadores tbody'); tbody.innerHTML = '';
    const iconosPosicion = {'POR':'<i class="fa-solid fa-mitten"></i>','DEF':'<i class="fa-solid fa-shield-halved"></i>','LAT':'<i class="fa-solid fa-arrows-left-right"></i>','MCD':'<i class="fa-solid fa-anchor"></i>','VOL':'<i class="fa-solid fa-arrows-up-down"></i>','EXT':'<i class="fa-solid fa-plane"></i>','DEL':'<i class="fa-solid fa-person-running"></i>'};
    datosDelEquipo.jugadores.forEach((j, i) => { const fila = document.createElement('tr'); fila.innerHTML = `<td>${iconosPosicion[j.posicion] || ''}</td><td>${j.nombre}</td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'goles','restar')">-</button><span class="stat-value">${j.statsPartido.goles}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'goles','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'asistencias','restar')">-</button><span class="stat-value">${j.statsPartido.asistencias}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'asistencias','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'amarillas','restar')">-</button><span class="stat-value">${j.statsPartido.amarillas}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'amarillas','sumar')">+</button></div></td><td><div class="stat-controls"><button class="stat-btn" onclick="actualizarEstadistica(${i},'rojas','restar')">-</button><span class="stat-value">${j.statsPartido.rojas}</span><button class="stat-btn" onclick="actualizarEstadistica(${i},'rojas','sumar')">+</button></div></td><td><button class="btn-eliminar" onclick="abrirModalConfirmacion(${i},'${j.nombre.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button></td>`; tbody.appendChild(fila); });
    
    popularSelectorJugadores();
}
function actualizarGraficoRendimiento() { const ctx = document.getElementById('rendimiento-chart').getContext('2d'); const style = getComputedStyle(document.documentElement); const colores = ['--color-victoria', '--color-empate', '--color-derrota'].map(c => style.getPropertyValue(c).trim()); const bordeColor = style.getPropertyValue('--color-superficie').trim(); const labelColor = style.getPropertyValue('--color-texto-secundario').trim(); if (rendimientoChart) { rendimientoChart.destroy(); } rendimientoChart = new Chart(ctx, { type: 'pie', data: { labels: ['Ganados', 'Empatados', 'Perdidos'], datasets: [{ data: [datosDelEquipo.partidos.ganados, datosDelEquipo.partidos.empatados, datosDelEquipo.partidos.perdidos], backgroundColor: colores, borderColor: bordeColor, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: labelColor } } } } }); }

// --- UTILIDADES Y DATOS LOCALES ---
function guardarDatos() { localStorage.setItem('datosDelEquipoArsenalFC', JSON.stringify(datosDelEquipo)); }
function cargarDatos() { const datosGuardados = localStorage.getItem('datosDelEquipoArsenalFC'); datosDelEquipo = datosGuardados ? JSON.parse(datosGuardados) : datosPorDefecto; }
function actualizarEstadistica(index, tipo, accion) { if (datosDelEquipo.proximoPartido.rival === 'A definir' || datosDelEquipo.proximoPartido.fecha === 'A definir') { mostrarAlerta('Acción no permitida', 'Debes programar un partido para poder añadir estadísticas a los jugadores.'); return; } const j = datosDelEquipo.jugadores[index]; if (accion === 'sumar') j.statsPartido[tipo]++; else if (accion === 'restar' && j.statsPartido[tipo] > 0) j.statsPartido[tipo]--; actualizarVista(); guardarDatos(); }
function actualizarProximoPartido() { const f = document.getElementById('input-fecha'), r = document.getElementById('input-rival'); if (f.value && r.value.trim()) { datosDelEquipo.proximoPartido.fecha = new Date(f.value + 'T00:00:00').toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); datosDelEquipo.proximoPartido.rival = r.value.trim(); f.value = ''; r.value = ''; actualizarVista(); guardarDatos(); } else { mostrarAlerta('Datos incompletos', 'Por favor, completa la fecha y el nombre del rival.'); } }