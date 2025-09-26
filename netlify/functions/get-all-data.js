const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Obtenemos todos los jugadores y sus estadísticas totales
    const { data: jugadores, error: errorJugadores } = await supabase
      .from('jugadores')
      .select('*')
      .order('nombre', { ascending: true });

    if (errorJugadores) throw errorJugadores;

    // Obtenemos todo el historial de partidos
    const { data: historial, error: errorHistorial } = await supabase
      .from('historial_partidos')
      .select('*')
      .order('fecha', { ascending: false }); // Los más recientes primero

    if (errorHistorial) throw errorHistorial;

    return {
      statusCode: 200,
      body: JSON.stringify({ jugadores, historial }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};