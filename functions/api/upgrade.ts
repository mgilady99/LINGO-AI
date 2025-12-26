export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    let { email, promoCode } = await request.json();

    if (!email || !promoCode) {
      return new Response(JSON.stringify({ error: "חסר אימייל או קוד" }), { status: 400 });
    }

    email = email.trim().toLowerCase();
    
    // --- 1. מסלול בייסיק ($3.90) ---
    if (promoCode === 'PAYPAL_BASIC') {
         await env.DB.prepare("UPDATE users SET plan = 'BASIC', token_limit = 20000 WHERE email = ?").bind(email).run();
         return new Response(JSON.stringify({ success: true }));
    }

    // --- 2. מסלול מתקדם ($6.90) ---
    if (promoCode === 'PAYPAL_ADVANCED') {
         await env.DB.prepare("UPDATE users SET plan = 'ADVANCED', token_limit = 50000 WHERE email = ?").bind(email).run();
         return new Response(JSON.stringify({ success: true }));
    }

    // --- 3. מסלול פרימיום ($11.90) ---
    if (promoCode === 'PAYPAL_PREMIUM') {
         // שים לב: ביקשת 300,000 טוקנים
         await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 300000 WHERE email = ?").bind(email).run();
         return new Response(JSON.stringify({ success: true }));
    }

    // --- 4. קודי הטבה רגילים (Gift) ---
    // קוד הטבה נותן מעמד PRO (פרימיום)
    promoCode = promoCode.replace(/\s/g, '').toLowerCase(); 
    const codeRecord = await env.DB.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(promoCode).first();

    if (!codeRecord) return new Response(JSON.stringify({ error: "קוד לא קיים" }), { status: 400 });
    if (codeRecord.is_used === 1 && promoCode !== 'meir12321') return new Response(JSON.stringify({ error: "הקוד נוצל" }), { status: 400 });

    await env.DB.prepare("UPDATE users SET plan = 'PRO', token_limit = 300000 WHERE email = ?").bind(email).run();

    if (promoCode !== 'meir12321') {
      await env.DB.prepare("UPDATE promo_codes SET is_used = 1 WHERE code = ?").bind(promoCode).run();
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (e) {
    return new Response(JSON.stringify({ error: "שגיאה בשדרוג: " + e.message }), { status: 500 });
  }
}
