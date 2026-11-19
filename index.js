require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'new_pixel_moi_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const DB_FILE = path.join(__dirname, 'records.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

const readRecords = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return []; }
};
const saveRecords = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const bot = new Client({
    intents: [GatewayIntentBits.Guilds]
});

bot.once('ready', () => console.log(`✅ البوت متصل: ${bot.user.tag}`));
if (process.env.DISCORD_BOT_TOKEN) {
    bot.login(process.env.DISCORD_BOT_TOKEN).catch(err => console.error('❌ خطأ توكن البوت:', err.message));
}

const ENTRY_TYPES = {
    leave_short: { category: 'إجازة', label: 'إجازة عسكرية (3 أيام)', days: 3, color: 0x10B981 },
    leave_long:  { category: 'إجازة', label: 'إجازة عسكرية (7 أيام)', days: 7, color: 0x059669 },
    warn_verbal: { category: 'إنذار', label: 'إنذار شفهي (5 أيام)', days: 5, color: 0xF59E0B },
    warn_first:  { category: 'إنذار', label: 'إنذار عسكري أول (7 أيام)', days: 7, color: 0xEF4444 },
    warn_second: { category: 'إنذار', label: 'إنذار عسكري ثاني (15 يوم)', days: 15, color: 0xA855F7 }
};

const SECTOR_NAMES = {
    discipline: 'وحدة الانضباط',
    lspd: 'شرطة لوس سانتوس',
    sheriff: 'شرطة الشيرف'
};

async function sendDiscordNotice(title, record, statusText, color = 0x3B82F6) {
    if (!process.env.LOG_CHANNEL_ID) return;
    try {
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        const channel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .addFields(
                { name: 'القطاع', value: record.sectorName, inline: true },
                { name: 'التصنيف', value: record.category, inline: true },
                { name: 'النوع / المدة', value: record.typeLabel, inline: true },
                { name: 'كود العسكري', value: record.officerCode, inline: true },
                { name: 'المسؤول', value: `<@${record.issuedById}>`, inline: true },
                { name: 'الحالة', value: statusText, inline: true },
                { name: 'السبب / الملاحظات', value: record.reason, inline: false }
            )
            .setFooter({ text: 'وزارة داخلية نيو بكسل • إشعارات الإجازات والإنذارات' })
            .setTimestamp();

        await channel.send({
            content: `<@${record.issuedById}>`,
            embeds: [embed]
        });
    } catch (err) {
        console.error('❌ خطأ إرسال إشعار الديسكورد:', err.message);
    }
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>وزارة داخلية نيو بكسل - الإجازات والإنذارات</title>
    <script src="https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.prod.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg: #070b14; --panel: #111827; --panel-2: #0d1320; --border: #1f2937;
            --accent: #3b82f6; --accent-2: #1d4ed8; --danger: #ef4444;
            --warning: #f59e0b; --purple: #a855f7; --success: #10b981;
            --text: #f9fafb; --muted: #9ca3af;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
        body {
            background: radial-gradient(circle at top right, rgba(59,130,246,0.14), transparent 45%), var(--bg);
            color: var(--text); min-height: 100vh; display: flex; flex-direction: column;
        }
        header {
            background: rgba(17,24,39,0.95); border-bottom: 1px solid var(--border);
            padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .shield {
            width: 44px; height: 44px; border-radius: 12px;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            display: flex; align-items: center; justify-content: center; font-size: 1.25rem; color: #fff;
        }
        .brand h1 { font-size: 1.1rem; font-weight: 900; }
        .brand span { font-size: 0.8rem; color: var(--muted); }
        .user-box { display: flex; align-items: center; gap: 10px; }
        .pill {
            display: flex; align-items: center; gap: 8px; background: var(--panel-2);
            border: 1px solid var(--border); padding: 6px 12px; border-radius: 999px;
        }
        .pill img { width: 30px; height: 30px; border-radius: 50%; }
        .logout {
            color: var(--danger); text-decoration: none; font-size: 0.85rem; font-weight: 700;
            padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.3);
        }
        main { flex: 1; width: 100%; max-width: 1180px; margin: 26px auto; padding: 0 16px; }
        .login-box {
            max-width: 480px; margin: 70px auto; background: var(--panel);
            border: 1px solid var(--border); border-radius: 18px; padding: 36px 24px; text-align: center;
        }
        .login-box h2 { margin-top: 14px; font-weight: 900; }
        .login-box p { color: var(--muted); margin: 12px 0 24px; font-size: 0.94rem; line-height: 1.7; }
        .btn-discord {
            display: inline-flex; align-items: center; gap: 10px; background: #5865F2;
            color: #fff; text-decoration: none; font-weight: 800; padding: 13px 26px; border-radius: 10px;
        }
        .grid { display: grid; grid-template-columns: 370px 1fr; gap: 20px; align-items: start; }
        @media(max-width: 880px) { .grid { grid-template-columns: 1fr; } }
        .card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
        .card h3 { font-size: 1.05rem; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
        .fg { margin-bottom: 13px; }
        .fg label { display: block; margin-bottom: 5px; font-size: 0.86rem; color: var(--muted); font-weight: 600; }
        .ctrl {
            width: 100%; background: var(--panel-2); border: 1px solid var(--border);
            color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 0.94rem;
        }
        .note {
            background: rgba(59,130,246,0.08); border: 1px dashed rgba(59,130,246,0.4);
            border-radius: 10px; padding: 10px; margin-bottom: 14px; font-size: 0.84rem; color: #bfdbfe;
        }
        .btn-add {
            width: 100%; border: none; border-radius: 10px; padding: 12px; color: #fff;
            background: linear-gradient(135deg, var(--accent), var(--accent-2)); font-weight: 800; cursor: pointer;
        }
        .r-item {
            background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px;
            padding: 14px; margin-bottom: 12px; display: flex; justify-content: space-between; gap: 12px;
        }
        .tag { font-size: 0.76rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
        .tag-leave_short, .tag-leave_long { background: rgba(16,185,129,0.15); color: var(--success); }
        .tag-warn_verbal { background: rgba(245,158,11,0.15); color: var(--warning); }
        .tag-warn_first { background: rgba(239,68,68,0.15); color: var(--danger); }
        .tag-warn_second { background: rgba(168,85,247,0.15); color: var(--purple); }
        .btn-del {
            background: rgba(239,68,68,0.12); color: var(--danger); border: 1px solid rgba(239,68,68,0.35);
            border-radius: 8px; padding: 7px 11px; cursor: pointer; font-weight: 700; height: fit-content;
        }
    </style>
</head>
<body>
    <div id="app">
        <header v-if="user">
            <div class="brand">
                <div class="shield"><i class="fa-solid fa-shield-halved"></i></div>
                <div>
                    <h1>وزارة داخلية نيو بكسل</h1>
                    <span>{{ user.sectorName }}</span>
                </div>
            </div>
            <div class="user-box">
                <div class="pill">
                    <img :src="user.avatar">
                    <span>{{ user.username }}</span>
                </div>
                <a href="/auth/logout" class="logout">خروج</a>
            </div>
        </header>

        <main>
            <div v-if="loading" style="text-align:center;padding:60px;color:var(--muted);">جاري التحميل...</div>

            <div v-else-if="!user" class="login-box">
                <div class="shield" style="margin:0 auto;"><i class="fa-solid fa-shield-halved"></i></div>
                <h2>وزارة داخلية نيو بكسل</h2>
                <p>سجل دخولك بحساب ديسكورد للتحقق من رتبتك العسكرية وتوجيهك لقطاعك تلقائياً.</p>
                <a href="/auth/discord" class="btn-discord">
                    <i class="fa-brands fa-discord"></i> تسجيل الدخول بالديسكورد
                </a>
            </div>

            <div v-else class="grid">
                <div class="card">
                    <h3>إصدار إجازة أو إنذار</h3>
                    <form @submit.prevent="addRecord">
                        <div class="fg" v-if="user.sector === 'discipline'">
                            <label>القطاع</label>
                            <select v-model="form.sector" class="ctrl" required>
                                <option value="discipline">وحدة الانضباط</option>
                                <option value="lspd">شرطة لوس سانتوس</option>
                                <option value="sheriff">شرطة الشيرف</option>
                            </select>
                        </div>
                        <div class="fg">
                            <label>كود العسكري</label>
                            <input type="text" v-model="form.officerCode" class="ctrl" placeholder="مثال: 105" required>
                        </div>
                        <div class="fg">
                            <label>النوع والمدة</label>
                            <select v-model="form.type" class="ctrl" required>
                                <optgroup label="الإجازات">
                                    <option value="leave_short">إجازة عسكرية (3 أيام)</option>
                                    <option value="leave_long">إجازة عسكرية (7 أيام)</option>
                                </optgroup>
                                <optgroup label="الإنذارات">
                                    <option value="warn_verbal">إنذار شفهي (5 أيام)</option>
                                    <option value="warn_first">إنذار عسكري أول (7 أيام)</option>
                                    <option value="warn_second">إنذار عسكري ثاني (15 يوم)</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="note">
                            المدة المحددة: <strong>{{ daysCount }}</strong> أيام. يتم إرسال إشعار في روم الديسكورد باسم القطاع وتاغك بدون أي تعديل على الرتب.
                        </div>
                        <div class="fg">
                            <label>السبب / التفاصيل</label>
                            <textarea v-model="form.reason" rows="3" class="ctrl" required></textarea>
                        </div>
                        <button type="submit" class="btn-add" :disabled="busy">{{ busy ? 'جاري الإرسال...' : 'اعتماد وإرسال الإشعار' }}</button>
                    </form>
                </div>

                <div class="card">
                    <h3>السجلات النشطة ({{ records.length }})</h3>
                    <div v-if="records.length === 0" style="text-align:center;padding:40px;color:var(--muted);">لا توجد إجازات أو إنذارات نشطة حالياً.</div>
                    <div v-for="r in records" :key="r.id" class="r-item">
                        <div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
                                <span :class="['tag', 'tag-' + r.type]">{{ r.typeLabel }}</span>
                                <strong>كود: {{ r.officerCode }}</strong>
                                <span style="font-size:0.8rem;color:var(--muted);">• {{ r.sectorName }}</span>
                            </div>
                            <div style="font-size:0.92rem;margin-bottom:6px;">السبب: {{ r.reason }}</div>
                            <div style="font-size:0.78rem;color:var(--muted);line-height:1.6;">
                                البداية: {{ fmt(r.startDate) }}<br>
                                الانتهاء: {{ fmt(r.endDate) }}<br>
                                بواسطة: {{ r.issuedBy }}
                            </div>
                        </div>
                        <button @click="delRecord(r.id)" class="btn-del">إزالة</button>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        const { createApp, ref, computed, onMounted } = Vue;
        const DAYS_MAP = { leave_short: 3, leave_long: 7, warn_verbal: 5, warn_first: 7, warn_second: 15 };

        createApp({
            setup() {
                const loading = ref(true);
                const busy = ref(false);
                const user = ref(null);
                const records = ref([]);
                const form = ref({ sector: 'lspd', officerCode: '', type: 'leave_short', reason: '' });

                const daysCount = computed(() => DAYS_MAP[form.value.type] || 3);
                const fmt = (d) => new Date(d).toLocaleString('ar-SA');

                const load = async () => {
                    loading.value = true;
                    try {
                        const r = await fetch('/api/me');
                        if (!r.ok) return;
                        user.value = await r.json();
                        const listRes = await fetch('/api/records');
                        if (listRes.ok) records.value = await listRes.json();
                    } finally { loading.value = false; }
                };

                const addRecord = async () => {
                    busy.value = true;
                    try {
                        const r = await fetch('/api/records', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(form.value)
                        });
                        if (r.ok) {
                            form.value.officerCode = '';
                            form.value.reason = '';
                            const listRes = await fetch('/api/records');
                            if (listRes.ok) records.value = await listRes.json();
                        }
                    } finally { busy.value = false; }
                };

                const delRecord = async (id) => {
                    if (!confirm('إزالة هذا السجل وإرسال إشعار في الديسكورد؟')) return;
                    const r = await fetch('/api/records/' + id, { method: 'DELETE' });
                    if (r.ok) records.value = records.value.filter(x => x.id !== id);
                };

                onMounted(load);
                return { loading, busy, user, records, form, daysCount, fmt, addRecord, delRecord };
            }
        }).mount('#app');
    </script>
</body>
</html>`;

app.get('/', (req, res) => {
    res.type('html').send(HTML_PAGE);
});

app.get('/auth/discord', (req, res) => {
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/discord/callback`;
    const url = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(process.env.DISCORD_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('identify guilds.members.read')}`;
    res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/discord/callback`;

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const memberRes = await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const roles = memberRes.data.roles || [];
        let sector = null;
        if (roles.includes(process.env.ROLE_DISCIPLINE_ID)) sector = 'discipline';
        else if (roles.includes(process.env.ROLE_LSPD_ID)) sector = 'lspd';
        else if (roles.includes(process.env.ROLE_SHERIFF_ID)) sector = 'sheriff';

        if (!sector) {
            return res.status(403).send('<h2 dir="rtl" style="text-align:center;margin-top:50px;font-family:sans-serif;">عذراً، لا تمتلك رتبة عسكرية مصرح لها بالدخول.</h2>');
        }

        req.session.user = {
            id: userRes.data.id,
            username: userRes.data.global_name || userRes.data.username,
            avatar: userRes.data.avatar
                ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png',
            sector,
            sectorName: SECTOR_NAMES[sector]
        };

        res.redirect('/');
    } catch (err) {
        console.error('❌ خطأ OAuth2:', err.response?.data || err.message);
        res.status(500).send('<h2 dir="rtl" style="text-align:center;margin-top:50px;font-family:sans-serif;">فشل تسجيل الدخول بالديسكورد. تأكد من صحة Redirect URI والبيانات السرية.</h2>');
    }
});

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(req.session.user);
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/api/records', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const all = readRecords();
    if (req.session.user.sector === 'discipline') return res.json(all);
    res.json(all.filter(r => r.sector === req.session.user.sector));
});

app.post('/api/records', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    const { officerCode, sector, type, reason } = req.body;
    const cfg = ENTRY_TYPES[type];
    if (!officerCode || !reason || !cfg) return res.status(400).json({ error: 'بيانات ناقصة' });

    const chosenSector = req.session.user.sector === 'discipline' && SECTOR_NAMES[sector] ? sector : req.session.user.sector;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + cfg.days * 24 * 60 * 60 * 1000);

    const item = {
        id: Date.now().toString(),
        officerCode: String(officerCode).trim(),
        sector: chosenSector,
        sectorName: SECTOR_NAMES[chosenSector],
        category: cfg.category,
        type,
        typeLabel: cfg.label,
        reason: String(reason).trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        issuedBy: req.session.user.username,
        issuedById: req.session.user.id
    };

    const list = readRecords();
    list.unshift(item);
    saveRecords(list);

    await sendDiscordNotice(
        `🛡️ إشعار ${item.category} عسكرية جديد`,
        item,
        `نشط (ينتهي بعد ${cfg.days} أيام)`,
        cfg.color
    );

    res.json(item);
});

app.delete('/api/records/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const list = readRecords();
    const idx = list.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'غير موجود' });

    const [removed] = list.splice(idx, 1);
    saveRecords(list);

    await sendDiscordNotice(
        `🛡️ إشعار إزالة ${removed.category} عسكرية`,
        removed,
        `تمت الإزالة بواسطة <@${req.session.user.id}>`,
        0x3B82F6
    );

    res.json({ success: true });
});

setInterval(async () => {
    const list = readRecords();
    const now = new Date();
    const active = [], expired = [];
    for (const r of list) (new Date(r.endDate) <= now ? expired : active).push(r);

    if (expired.length > 0) {
        saveRecords(active);
        for (const ex of expired) {
            await sendDiscordNotice(
                `🛡️ إشعار انتهاء مدة ${ex.category} عسكرية`,
                ex,
                'انتهت المدة المحددة تلقائياً',
                0x6B7280
            );
        }
    }
}, 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 النظام يعمل على المنفذ ${PORT}`));
