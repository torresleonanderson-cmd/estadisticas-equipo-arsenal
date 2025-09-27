const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Borrar todo el historial de partidos
    // Usamos una columna que sí existe, como 'rival', para asegurarnos de borrar todo
    const { error: deleteError } = await supabase
      .from('historial_partidos')
      .delete()
      .not('rival', 'is', null); // BORRA todas las filas que tengan un rival (o sea, todas)

    if (deleteError) throw deleteError;

    // 2. Reiniciar las estadísticas de TODOS los jugadores a cero
    // Usamos la columna 'nombre' que sabemos que existe en todos los jugadores
    const { error: updateError } = await supabase
      .from('jugadores')
      .update({
        goles_totales: 0,
        asistencias_totales: 0,
        amarillas_totales: 0,
        rojas_totales: 0
      })
      .not('nombre', 'is', null); // ACTUALIZA a todos los jugadores que tengan un nombre (o sea, todos)

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