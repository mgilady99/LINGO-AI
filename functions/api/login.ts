export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password, promoCode } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "נא להזין אימייל" }), { status: 400 });
    }

    // שליפת המשתמש
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    // --- תרחיש: משתמש קיים ---
    if (user) {
      // 1. בדיקת סיסמה
      if (user.password && user.password !== password) {
         return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
      }

      // 2. תיקון קריטי: אם המשתמש כבר PRO, מתעלמים מהקוד ומכניסים אותו מיד
      if (user.plan === 'PRO') {
         return new Response(JSON.stringify(user));
      }

      // 3. אם הוא עדיין FREE ומנסה לשדרג עם קוד
      if (promoCode) {
        try {
          const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ? AND is_used = 0").bind(promoCode).first();
          if (codeRecord) {
            // שדרוג
            await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 1000000 WHERE email = ?").bind(email).run();
            await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            
            user.plan = 'PRO'; 
            user.token_limit = 1000000;
          } else {
             return new Response(JSON.stringify({ error: "קוד ההטבה אינו תקין או שכבר נוצל" }), { status: 400 });
          }
        } catch (e) {}
      }
      return new Response(JSON.stringify(user));
    }

    // --- תרחיש: משתמש חדש לגמרי ---
    let plan = 'FREE';
    let tokenLimit = 5000;

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

    await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit) VALUES (?, ?, ?, 0, ?)")
      .bind(email, password, plan, tokenLimit).run();
      
    return new Response(JSON.stringify({ email, plan, role: 'USER', tokens_used: 0 }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת" }), { status: 500 });
  }
}
