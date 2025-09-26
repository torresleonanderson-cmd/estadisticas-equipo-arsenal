const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { partido, jugadoresDelPartido } = JSON.parse(event.body);

    // 1. Guardar el resultado del partido en el historial
    const { error: errorPartido } = await supabase.from('historial_partidos').insert([partido]);
    if (errorPartido) throw errorPartido;

    // 2. Actualizar las estadísticas de cada jugador que participó
    for (const jugador of jugadoresDelPartido) {
      if (jugador.statsPartido.goles > 0 || jugador.statsPartido.asistencias > 0 || jugador.statsPartido.amarillas > 0 || jugador.statsPartido.rojas > 0) {
        
        // Obtenemos las stats actuales del jugador desde la BD
        const { data: statsActuales, error: getError } = await supabase
          .from('jugadores')
          .select('goles_totales, asistencias_totales, amarillas_totales, rojas_totales')
          .eq('nombre', jugador.nombre)
          .single();

        if (getError) throw getError;

        // Calculamos las nuevas stats
        const nuevasStats = {
          goles_totales: statsActuales.goles_totales + jugador.statsPartido.goles,
          asistencias_totales: statsActuales.asistencias_totales + jugador.statsPartido.asistencias,
          amarillas_totales: statsActuales.amarillas_totales + jugador.statsPartido.amarillas,
          rojas_totales: statsActuales.rojas_totales + jugador.statsPartido.rojas,
        };

        // Actualizamos al jugador en la BD
        const { error: updateError } = await supabase
          .from('jugadores')
          .update(nuevasStats)
          .eq('nombre', jugador.nombre);
        
        if (updateError) throw updateError;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Partido finalizado y guardado con éxito" }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};