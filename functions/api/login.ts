export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // 1. בדיקה אם המשתמש כבר קיים
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // 2. משתמש קיים (התחברות רגילה)
    if (user) {
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }
      return new Response(JSON.stringify(user));
    }

    // 3. משתמש חדש (הרשמה)
    let plan = 'FREE';
    let tokenLimit = 5000;

    // --- בדיקת קוד הטבה (אם הוזן) ---
    if (promoCode) {
      // נניח שיש טבלה בשם 'promo_codes' עם עמודות 'code' ו-'is_used'
      // הערה: וודא שהטבלה קיימת ב-D1. אם לא, מחק את הבלוק הזה או צור את הטבלה.
      try {
        const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
        
        if (codeRecord) {
          plan = 'PRO';
          tokenLimit = 1000000; // המון טוקנים למנוי פרו
          
          // סימון הקוד כמשומש
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
        } else {
          return new Response(JSON.stringify({ error: "קוד הטבה שגוי או שכבר נוצל" }), { status: 400 });
        }
      } catch (e) {
        console.log("Promo code error (maybe table missing):", e);
        // מתעלמים משגיאה אם הטבלה לא קיימת, וממשיכים כחינם
      }
    }
    // -------------------------------

    if (!password || password.length < 4) {
       return new Response(JSON.stringify({ error: "סיסמה חייבת להכיל לפחות 4 תווים" }), { status: 400 });
    }

    // יצירת המשתמש
    await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, ?, 0, ?)")
      .bind(email, password, plan, tokenLimit).run();
      
    return new Response(JSON.stringify({ email, plan, role: 'USER', tokens_used: 0 }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
