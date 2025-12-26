export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // בדיקה מול מסד הנתונים
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // אם המשתמש לא קיים - יוצרים חדש
    if (!user) {
      await env.DB.prepare("INSERT INTO users (email, plan, tokens_used, token_limit) VALUES (?, 'FREE', 0, 5000)")
        .bind(email).run();
      return new Response(JSON.stringify({ email, plan: 'FREE', role: 'USER', tokens_used: 0 }));
    }

    // בדיקת סיסמה (אם קיימת בבסיס הנתונים)
    if (user.password && user.password !== password) {
       // אם הסיסמה ב-DB לא תואמת, נחזיר שגיאה (אלא אם זה המעקף שיטופל בצד לקוח)
       return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
    }

    return new Response(JSON.stringify(user));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
