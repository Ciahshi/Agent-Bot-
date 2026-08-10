const TELEGRAM_BOT_TOKEN = "Enter your Bot Token"; 
const MY_TELEGRAM_ID = 123456789; // آیدی عددی تلگرام خودت
const OFFLINE_TIMEOUT_MINUTES = 1; // مدت زمانی که ربات بعد از افلاین شدن شما پیام دهد"به دقیقه وارد کنید"م
const MISTRAL_API_KEY = "Enter your AI token";
const MISTRAL_BASE_URL = "https://Base url/v1/chat/completions";
const MISTRAL_MODEL = "Model";


export default {
    async fetch(request, env, ctx) {
        if (request.method !== "POST") return new Response("OK", { status: 200 });

        try {
            const update = await request.json();

            if (update.business_message) {
                const msg = update.business_message;
                const chatId = msg.chat.id.toString();
                const fromId = msg.from.id;
                const text = msg.text || "";
                const businessConnectionId = msg.business_connection_id;

                const firstName = msg.from.first_name || "";
                const lastName = msg.from.last_name || "";
                const userName = `${firstName} ${lastName}`.trim() || "کاربر";

                if (!text) return new Response("OK", { status: 200 });


                if (fromId === MY_TELEGRAM_ID) {
                    if (text.includes("ربات")) {
                        await sendTelegramMessage(chatId, "بله ارباب من", businessConnectionId);
                        return new Response("OK", { status: 200 });
                    }


                    if (env.BOT_KV) {
                        await env.BOT_KV.put(`pause_${chatId}`, Date.now().toString());
                        await updateHistory(env.BOT_KV, chatId, { role: "assistant", content: text });
                        
                        await sendDebugLog(`ℹ️ لاگ: شما در چت ${chatId} پیام دادید. ربات برای 1 دقیقه در این چت سکوت کرد تا دخالت نکند.`);
                    } else {
                        await sendDebugLog("⚠️ خطا: دیتابیس KV در کلودفلر متصل نیست! حافظه ربات کار نمی‌کند.");
                    }
                    return new Response("OK", { status: 200 });
                }

                let chatHistory = [];
                if (env.BOT_KV) {
                    chatHistory = await updateHistory(env.BOT_KV, chatId, { role: "user", content: text });
                    
                    const lastActiveStr = await env.BOT_KV.get(`pause_${chatId}`);
                    if (lastActiveStr) {
                        const lastActive = parseInt(lastActiveStr);
                        const minutesPassed = (Date.now() - lastActive) / (1000 * 60);
                        
                        if (minutesPassed < OFFLINE_TIMEOUT_MINUTES) {
                            await sendDebugLog(`ℹ️ لاگ: کاربر پیام داد، اما چون شما به تازگی پیام داده بودید (حالت سکوت)، ربات جواب او را نداد.`);
                            return new Response("OK", { status: 200 });
                        } else {
                            await env.BOT_KV.delete(`pause_${chatId}`);
                        }
                    }
                } else {
                    chatHistory = [{ role: "user", content: text }];
                }

                await sendChatAction(chatId, businessConnectionId);

                const aiReply = await askMistral(chatHistory, userName);
                
                if (aiReply) {
                    await sendTelegramMessage(chatId, aiReply, businessConnectionId);
                    if (env.BOT_KV) {
                        await updateHistory(env.BOT_KV, chatId, { role: "assistant", content: aiReply });
                    }
                }
            }
        } catch (err) {
            await sendDebugLog(`❌ خطای پیش‌بینی نشده در کد:\n${err.message}`);
        }

        return new Response("OK", { status: 200 });
    }
};


async function sendChatAction(chatId, businessConnectionId) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            action: "typing", // به تلگرام می‌گوید وضعیت را روی "در حال تایپ" قرار بده
            business_connection_id: businessConnectionId // برای چت‌های بیزینسی الزامی است
        })
    });
}

// این بخش لاگ همه چیو براتون تو شخصی بات میفرسته ااگه میخواین خاموشش کنید
async function sendDebugLog(text) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: MY_TELEGRAM_ID, 
            text: text
        })
    });
}


async function updateHistory(kv, chatId, newMessage) {
    const historyKey = `history_${chatId}`;
    let history = [];
    
    const existingHistory = await kv.get(historyKey);
    if (existingHistory) {
        try { history = JSON.parse(existingHistory); } catch (e) {}
    }

    history.push(newMessage);
    if (history.length > 6) history = history.slice(history.length - 6); // اینجا میتونید تعیین کنید که به عنوان تاریخچه چند پیام آخرو برای مدل ارسال کنه

    await kv.put(historyKey, JSON.stringify(history));
    return history;
}


async function sendTelegramMessage(chatId, text, businessConnectionId) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            business_connection_id: businessConnectionId
        })
    });
}


async function askMistral(chatHistory, userName) {
    const systemPrompt = `تو یک انسان واقعی هستی که در حال چت در تلگرام شخصی‌اش است. 
وظایف تو:
۱. پیام کاربر را درک کن و دقیقا مطابق با لحن او پاسخ بده.
۲. طول پاسخ‌هایت متوسط و طبیعی باشد.
۳. نام کاربری که با او چت می‌کنی "${userName}" است. سعی کن به صورت طبیعی و دوستانه در لابه‌لای حرف‌هایت از اسمش استفاده کنی (اما زیاده‌روی نکن).
4.اگر کاربر پرسید چه کسی تو را  ساخته است تو میدانی که توسط @Ciah_am  یا همون امیر ساخته شده ای.حتما بگو @Ciah_am  یا امیر.
۵. تاریخچه ۶ پیام اخیر بین تو و کاربر به تو داده شده است تا بتوانی روند مکالمه را درک کنی.`;

    const messages = [{ role: "system", content: systemPrompt }, ...chatHistory];

    try {
        const response = await fetch(MISTRAL_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: MISTRAL_MODEL,
                messages: messages
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0].message.content;
        } else {
            const errorText = await response.text();
            await sendDebugLog(`❌ خطای API میسترال:\nوضعیت: ${response.status}\nجزئیات: ${errorText}`);
            return null;
        }
    } catch (error) {
        await sendDebugLog(`❌ خطای ارتباط با سرور میسترال:\n${error.message}`);
    }
    
    return null;
}
