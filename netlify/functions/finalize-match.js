const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { partido, jugadoresDelPartido } = JSON.parse(event.body);

    // 1. Guardar el resultado del partido en el historial
    const { error: errorPartido } = await supabase.from('historial_partidos').insert([partido]);
    if (errorPartido) {
      console.error("Error insertando partido:", errorPartido);
      throw errorPartido;
    }

    // 2. Actualizar las estadísticas de cada jugador que participó
    for (const jugador of jugadoresDelPartido) {
      // Solo procedemos si el jugador tuvo alguna estadística en el partido
      if (jugador.statsPartido.goles > 0 || jugador.statsPartido.asistencias > 0 || jugador.statsPartido.amarillas > 0 || jugador.statsPartido.rojas > 0) {
        
        // Obtenemos las stats actuales del jugador desde la BD
        const { data: statsActuales, error: getError } = await supabase
          .from('jugadores')
          .select('goles_totales, asistencias_totales, amarillas_totales, rojas_totales')
          .eq('nombre', jugador.nombre)
          .single(); // .single() es importante para obtener un objeto, no un array

        if (getError) {
            console.error(`Error obteniendo stats para ${jugador.nombre}:`, getError);
            throw getError;
        }

        // Calculamos las nuevas stats
        const nuevasStats = {
          goles_totales: (statsActuales.goles_totales || 0) + jugador.statsPartido.goles,
          asistencias_totales: (statsActuales.asistencias_totales || 0) + jugador.statsPartido.asistencias,
          amarillas_totales: (statsActuales.amarillas_totales || 0) + jugador.statsPartido.amarillas,
          rojas_totales: (statsActuales.rojas_totales || 0) + jugador.statsPartido.rojas,
        };

        // Actualizamos al jugador en la BD
        const { error: updateError } = await supabase
          .from('jugadores')
          .update(nuevasStats)
          .eq('nombre', jugador.nombre);
        
        if (updateError) {
            console.error(`Error actualizando stats para ${jugador.nombre}:`, updateError);
            throw updateError;
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Partido finalizado y guardado con éxito" }),
    };

  } catch (error) {
    // Devolvemos un mensaje de error más detallado para ayudar a depurar
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};