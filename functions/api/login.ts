export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    let { email, password, promoCode } = await request.json();

    if (!email) return new Response(JSON.stringify({ error: "חסר אימייל" }), { status: 400 });

    // ניקוי קלטים
    email = email.trim().toLowerCase();
    password = password.trim(); // סיסמה היא רגישה לאותיות (לא הופכים לקטן)
    if (promoCode) promoCode = promoCode.trim().toLowerCase();

    // =================================================================
    // 1. דלת כניסה ראשית לאדמין (עוקף הכל)
    // =================================================================
    // אם האימייל הוא שלך והסיסמה היא הסיסמה הספציפית הזו - אתה נכנס מיד
    if (email === 'mgilady@gmail.com' && password === 'MEIR@mmmeir12321') {
        return new Response(JSON.stringify({
            email: email,
            plan: 'PRO',
            role: 'ADMIN',
            token_limit: 1000000,
            tokens_used: 0
        }));
    }
    // =================================================================

    // 2. בדיקת משתמש רגיל במסד הנתונים
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        // משתמש חדש מתחיל עם 10,000 טוקנים
        user = { email, password, plan: 'FREE', role: 'USER', tokens_used: 0, token_limit: 10000 };
    } else {
        // בדיקת סיסמה למשתמש קיים
        if (user.password && user.password !== password) {
            return new Response(JSON.stringify({ error: "סיסמה שגויה" }), { status: 401 });
        }
    }

    // אם במקרה נרשמת עם סיסמה אחרת אבל זה האימייל שלך - ניתן לך אדמין בכל זאת
    if (email === 'mgilady@gmail.com') {
        user.role = 'ADMIN';
        user.plan = 'PRO';
    }

    // 3. בדיקת קוד הטבה (אם הוזן)
    if (promoCode && user.role !== 'ADMIN' && user.plan !== 'PRO') {
        try {
            const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();
            
            if (!codeRecord) return new Response(JSON.stringify({ error: "קוד לא קיים" }), { status: 400 });
            
            // קוד המאסטר שלך תמיד עובד, אחרים נבדקים אם נוצלו
            if (codeRecord.is_used === 1 && promoCode !== 'meir12321') {
                return new Response(JSON.stringify({ error: "הקוד כבר נוצל" }), { status: 400 });
            }

            // שדרוג המשתמש
            user.plan = 'PRO';
            user.token_limit = 1000000;

            // סימון הקוד כמשומש
            if (promoCode !== 'meir12321') {
                await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: "שגיאה בבדיקת הקוד" }), { status: 500 });
        }
    }

    // 4. שמירה במסד הנתונים (כדי שבפעם הבאה תזוהה)
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
