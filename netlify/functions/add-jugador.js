const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { nombre, posicion } = JSON.parse(event.body);

    if (!nombre || !posicion) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nombre y posición son requeridos.' }) };
    }

    const { data, error } = await supabase
      .from('jugadores')
      .insert([{ nombre, posicion }])
      .select()
      .single(); // Devuelve el objeto creado, no un array

    if (error) throw error;

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    // Manejo de errores específicos de Supabase, como duplicados
    if (error.code === '23505') { // Código de violación de unicidad
        return { statusCode: 409, body: JSON.stringify({ error: 'Este jugador ya existe.' })};
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};