export async function onRequestPost(context) {
  const { env, request } = context;
  const { email } = await request.json();

  try {
    // בדיקה אם המשתמש קיים
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user) {
      // לא מגלים אם המייל לא קיים מטעמי אבטחה
      return new Response(JSON.stringify({ message: "אם המייל קיים, נשלח אליו קישור" }));
    }

    // יצירת קוד איפוס ייחודי
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 3600000; // תקף לשעה

    // שמירה בטבלה
    await env.DB.prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)")
      .bind(email, token, expiresAt).run();

    // *** מכיוון שאין שרת מייל, אנחנו מחזירים את הלינק לתגובה לצורך הפיתוח ***
    return new Response(JSON.stringify({ 
      success: true, 
      devLink: `/?view=RESET&token=${token}` // זה הלינק שהיה אמור להישלח במייל
    }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת" }), { status: 500 });
  }
}
