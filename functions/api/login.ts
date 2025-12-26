export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    let { email, password, promoCode } = await request.json();

    if (!email) return new Response(JSON.stringify({ error: "חסר אימייל" }), { status: 400 });

    // --- ניקוי והכנה ---
    email = email.trim().toLowerCase();
    password = password.trim();
    
    // קריטי: המרה לאותיות קטנות כדי להתאים למסד הנתונים החדש
    if (promoCode) {
        promoCode = promoCode.trim().toLowerCase(); 
    }

    // 1. בדיקת משתמש
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        // יצירת משתמש זמני בזיכרון
        user = { email, password, plan: 'FREE', role: 'USER', tokens_used: 0, token_limit: 5000 };
    } else {
        if (user.password && user.password !== password) {
            return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
        }
    }

    // זיהוי מנהל (אתה)
    if (email === 'mgilady@gmail.com') {
        user.role = 'ADMIN';
        user.plan = 'PRO';
    }

    // 2. בדיקת קוד הטבה
    if (promoCode && user.role !== 'ADMIN' && user.plan !== 'PRO') {
        try {
            // שים לב: אנחנו מחפשים קוד זהה בדיוק (באותיות קטנות)
            const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
            
            if (!codeRecord) {
                return new Response(JSON.stringify({ error: "קוד לא קיים במערכת" }), { status: 400 });
            }
            
            // בדיקה אם נוצל (למעט קוד המאסטר שלך)
            if (codeRecord.is_used === 1 && promoCode !== 'meir12321') {
                return new Response(JSON.stringify({ error: "הקוד הזה כבר נוצל" }), { status: 400 });
            }

            // קוד תקין! משדרגים
            user.plan = 'PRO';
            user.token_limit = 1000000;

            // מסמנים כמשומש
            if (promoCode !== 'meir12321') {
                await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            }

        } catch (e) {
            return new Response(JSON.stringify({ error: "שגיאה בבדיקת הקוד" }), { status: 500 });
        }
    }

    // 3. שמירה/עדכון במסד הנתונים
    if (isNewUser) {
        await env.DB.prepare("INSERT INTO users (email, password, plan, tokens_used, token_limit, role) VALUES (?, ?, ?, 0, ?, ?)")
            .bind(user.email, user.password, user.plan, user.token_limit, user.role).run();
    } else {
        await env.DB.prepare("UPDATE users SET plan = ?, token_limit = ?, role = ? WHERE email = ?")
            .bind(user.plan, user.token_limit, user.role, user.email).run();
    }

    return new Response(JSON.stringify(user));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאת שרת: " + e.message }), { status: 500 });
  }
}
