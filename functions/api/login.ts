
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password } = await request.json();

    // בדיקת חובה: אימייל
    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // 1. ננסה למצוא את המשתמש במסד הנתונים
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // 2. תרחיש: משתמש חדש (הרשמה)
    if (!user) {
      // חובה שמשתמש חדש יספק סיסמה
      if (!password || password.length < 4) {
         return new Response(JSON.stringify({ error: "סיסמה חייבת להכיל לפחות 4 תווים" }), { status: 400 });
      }

      // יצירת המשתמש החדש עם הסיסמה
      await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, 'FREE', 0, 5000)")
        .bind(email, password).run();
        
      // החזרת נתונים למשתמש החדש
      return new Response(JSON.stringify({ email, plan: 'FREE', role: 'USER', tokens_used: 0 }));
    }

    // 3. תרחיש: משתמש קיים (התחברות)
    // אם למשתמש שמור סיסמה ב-DB, נבדוק שהיא תואמת
    if (user.password && user.password !== password) {
       return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
    }

    // אם הכל תקין - מחזירים את פרטי המשתמש
    return new Response(JSON.stringify(user));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
