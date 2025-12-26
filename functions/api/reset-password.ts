export async function onRequestPost(context) {
  const { env, request } = context;
  const { token, newPassword } = await request.json();

  try {
    // חיפוש הטוקן
    const record = await env.DB.prepare("SELECT * FROM password_resets WHERE token = ?").bind(token).first();

    if (!record) {
      return new Response(JSON.stringify({ error: "קישור לא תקין או פג תוקף" }), { status: 400 });
    }

    if (Date.now() > record.expires_at) {
      return new Response(JSON.stringify({ error: "הקישור פג תוקף" }), { status: 400 });
    }

    // עדכון הסיסמה
    await env.DB.prepare("UPDATE users SET password = ? WHERE email = ?")
      .bind(newPassword, record.email).run();

    // מחיקת הטוקן המשומש
    await env.DB.prepare("DELETE FROM password_resets WHERE token = ?").bind(token).run();

    return new Response(JSON.stringify({ success: true }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאה באיפוס סיסמה" }), { status: 500 });
  }
}
