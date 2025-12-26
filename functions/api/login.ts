export async function onRequestPost(context) {
  const { env, request } = context;
  const { email, password } = await request.json();

  if (!email) return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });

  try {
    // שליפת המשתמש מהמסד
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // אם המשתמש לא קיים - יוצרים חדש (חינם)
    if (!user) {
      await env.DB.prepare("INSERT INTO users (email, plan, tokens_used, token_limit) VALUES (?, 'FREE', 0, 5000)")
        .bind(email).run();
      return new Response(JSON.stringify({ email, plan: 'FREE', role: 'USER' }));
    }

    // בדיקת סיסמה: אם יש למשתמש סיסמה (כמו למנהל) והיא לא תואמת -> שגיאה
    if (user.password && user.password !== password) {
      return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
    }

    // התחברות מוצלחת
    return new Response(JSON.stringify(user));
  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
