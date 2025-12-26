export async function onRequest(context) {
  const { env, request } = context;

  // 1. קריאת נתונים (GET) - טוען את הפרסומות וההגדרות לאתר
  if (request.method === 'GET') {
    try {
      const ads = await env.DB.prepare("SELECT * FROM ads ORDER BY slot_id").all();
      const settings = await env.DB.prepare("SELECT * FROM settings").all();
      
      // ספירת משתמשים לסטטיסטיקה
      const stats = await env.DB.prepare("SELECT COUNT(*) as total_users FROM users").first();
      
      return new Response(JSON.stringify({ 
        ads: ads.results, 
        settings: settings.results,
        stats 
      }));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // 2. שמירת נתונים (POST) - עדכון פרסומת או הגדרה
  if (request.method === 'POST') {
    try {
      const { type, data } = await request.json();

      if (type === 'AD') {
        // עדכון פרסומת בודדת
        await env.DB.prepare(
          "UPDATE ads SET title = ?, image_url = ?, target_url = ? WHERE slot_id = ?"
        ).bind(data.title, data.image_url, data.target_url, data.slot_id).run();
        
        return new Response(JSON.stringify({ success: true }));
      }

      if (type === 'SETTING') {
        // עדכון הגדרה (כמו SEO)
        await env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?"
        ).bind(data.key, data.value, data.value).run();

        return new Response(JSON.stringify({ success: true }));
      }

    } catch (e) {
      return new Response(JSON.stringify({ error: "שגיאה בשמירה" }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
