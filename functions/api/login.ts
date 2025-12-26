export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // 1. ננסה למצוא את המשתמש
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // =========================================================
    // תרחיש א': המשתמש כבר קיים במערכת
    // =========================================================
    if (user) {
      // בדיקת סיסמה
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }

      // --- התיקון הגדול ---
      // אם המשתמש הוא כבר PRO, לא מעניין אותנו איזה קוד הוא הזין.
      // אנחנו מכניסים אותו ישר, כדי לא לקבל שגיאת "קוד משומש".
      if (user.plan === 'PRO') {
         // מחזירים את המשתמש כמו שהוא
         return new Response(JSON.stringify(user));
      }

      // אם הוא עדיין FREE ומנסה להשתדרג עכשיו עם קוד
      if (promoCode) {
        try {
          // בודקים אם הקוד תקין ולא נוצל
          const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
          
          if (codeRecord) {
            // יש! קוד תקין. משדרגים את המשתמש.
            await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
            // מסמנים את הקוד כמשומש
            await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            
            // מעדכנים את האובייקט בזיכרון כדי להחזיר תשובה מעודכנת
            user.plan = 'PRO';
            user.token_limit = 1000000;
          } else {
             return new Response(JSON.stringify({ error: "קוד ההטבה אינו תקין או שכבר נוצל" }), { status: 400 });
          }
        } catch (e) {
          // מתעלמים משגיאות טבלה
        }
      }

      return new Response(JSON.stringify(user));
    }

    // =========================================================
    // תרחיש ב': משתמש חדש לגמרי (הרשמה)
    // =========================================================
    let plan = 'FREE';
    let tokenLimit = 5000;

    // בדיקת קוד הטבה למשתמש חדש
    if (promoCode) {
      try {
        const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
        
        if (codeRecord) {
          plan = 'PRO';
          tokenLimit = 1000000;
          await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
        } else {
           return new Response(JSON.stringify({ error: "קוד ההטבה שגוי או שכבר נוצל" }), { status: 400 });
        }
      } catch (e) {}
    }

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
