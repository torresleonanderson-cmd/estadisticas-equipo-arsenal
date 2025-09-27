const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Borrar todo el historial de partidos
    const { error: deleteError } = await supabase
      .from('historial_partidos')
      .delete()
      .neq('id', -1); // Condición para borrar todo

    if (deleteError) throw deleteError;

    // 2. Reiniciar las estadísticas de TODOS los jugadores a cero
    const { error: updateError } = await supabase
      .from('jugadores')
      .update({
        goles_totales: 0,
        asistencias_totales: 0,
        amarillas_totales: 0,
        rojas_totales: 0
      })
      .neq('id', -1); // Condición para actualizar a todos

    if (updateError) throw updateError;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Todas las estadísticas han sido reiniciadas con éxito." }),
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};