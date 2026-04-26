import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  // 🔥 مهم جدًا لـ Render
  max: 5, // عدد الاتصالات
  idleTimeoutMillis: 30000, // يفصل بعد 30 ثانية خمول
  connectionTimeoutMillis: 10000, // وقت انتظار الاتصال
  keepAlive: true, // يمنع انقطاع الاتصال
});

// ✅ عند الاتصال
pool.on("connect", () => {
  console.log("✅ PostgreSQL Connected");
});

// ❌ لو صار خطأ بالاتصال
pool.on("error", (err) => {
  console.error("❌ PostgreSQL Error:", err.message);
});

// ✅ دالة الاستعلام
export async function query(text, params = []) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error("❌ Query Error:", err.message);
    throw err;
  }
}
